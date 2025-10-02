//! Background workers for collecting statistics
//!
//! This module contains background workers that periodically collect
//! container and system statistics and store them in the database.

use crate::lib::{docker, state::AppState};
use bollard::secret::{ContainerStatsResponse, ContainerSummary, ContainerSummaryStateEnum};
use chrono::{DateTime, SubsecRound, Utc};
use log::{error, trace};
use std::sync::Arc;
use sysinfo::System;
use tokio::time::{Duration, Instant};

/// Container statistics with summary information
#[derive(Debug)]
struct ContainerStatsInfo {
    summary: ContainerSummary,
    stats: ContainerStatsResponse,
}

/// System-wide Docker statistics
#[derive(Debug)]
struct SystemInfo {
    running_containers: i32,
    total_containers: i32,
    images: i32,
    volumes: i32,
    networks: i32,
    timestamp: DateTime<Utc>,
}

/// Fetches statistics for all containers
async fn get_all_container_stats(state: &AppState) -> Vec<ContainerStatsInfo> {
    use bollard::query_parameters::ListContainersOptionsBuilder;
    let opts = Some(ListContainersOptionsBuilder::default().all(true).build());
    match state.docker_client.list_containers(opts).await {
        Ok(containers) => {
            let futures = containers.iter().map(async |container| {
                let c_id: String = container.id.clone().unwrap_or(String::new());
                ContainerStatsInfo {
                    summary: container.clone(),
                    stats: docker::get_container_stats(&c_id, &state.docker_client).await,
                }
            });
            futures::future::join_all(futures).await
        }
        Err(err) => {
            trace!("Error fetching container stats: {}", err);
            Vec::new()
        }
    }
}

/// Collects system-wide Docker information
async fn get_system_info(state: &AppState) -> SystemInfo {
    SystemInfo {
        running_containers: docker::get_num_containers(state, false).await as i32,
        total_containers: docker::get_num_containers(state, true).await as i32,
        images: docker::get_num_images(state).await as i32,
        volumes: docker::get_num_volumes(state).await as i32,
        networks: docker::get_num_networks(state).await as i32,
        timestamp: Utc::now().round_subsecs(0),
    }
}

/// Writes container statistics to the database
async fn write_container_stats_to_db(stats: Vec<ContainerStatsInfo>, state: &AppState) {
    // Implementation to write stats to database
    trace!("Writing container stats to database: {}", stats.len());
    let mut query_builder = sqlx::QueryBuilder::new(
        "INSERT INTO container_stats (id, name, status, image, cpu_percent,
        memory_percent, memory_usage, memory_limit, network_rx,
        network_tx, timestamp, is_active) ",
    );

    let mut system = System::new_all();
    system.refresh_memory();

    query_builder.push_values(stats.iter(), |mut b, stats_obj| {
        let c_stats = &stats_obj.stats.clone();
        let c_summary = &stats_obj.summary.clone();
        b.push_bind(c_stats.id.as_ref().unwrap_or(&String::new()).clone());
        b.push_bind(c_stats.name.as_ref().unwrap_or(&String::new()).clone());
        b.push_bind(c_summary.status.as_ref().unwrap_or(&String::new()).clone());
        b.push_bind(c_summary.image.as_ref().unwrap_or(&String::new()).clone());
        let cpu_usage = c_stats
            .cpu_stats
            .as_ref()
            .and_then(|cpu| cpu.cpu_usage.as_ref())
            .and_then(|usage| usage.total_usage)
            .map(|val| val as f64)
            .unwrap_or_default();
        let system_usage = c_stats
            .cpu_stats
            .as_ref()
            .and_then(|cpu| cpu.system_cpu_usage)
            .map(|val| val as f64)
            .unwrap_or_default();
        let mut safe_system_usage = 1.0;
        if system_usage > 0.0 {
            safe_system_usage = system_usage;
        }
        let container_memory_usage = c_stats
            .memory_stats
            .as_ref()
            .and_then(|memory| memory.usage)
            .map(|val| val as f64)
            .unwrap_or_default();
        let system_memory_usage = system.total_memory();
        b.push_bind(cpu_usage / safe_system_usage);
        b.push_bind(container_memory_usage / (system_memory_usage as f64));
        b.push_bind(container_memory_usage);
        b.push_bind(
            c_stats
                .memory_stats
                .as_ref()
                .and_then(|memory| memory.limit)
                .map(|val| val as i64)
                .unwrap_or_default(),
        );
        let mut network_rx: i64 = 0;
        let mut network_tx: i64 = 0;
        if let Some(networks) = c_stats.networks.as_ref() {
            for network in networks.values() {
                network_rx += network.rx_bytes.map(|val| val as i64).unwrap_or_default();
                network_tx += network.tx_bytes.map(|val| val as i64).unwrap_or_default();
            }
        }
        b.push_bind(network_rx);
        b.push_bind(network_tx);
        b.push_bind(Utc::now().round_subsecs(0));
        b.push_bind(
            c_summary.state.unwrap_or(ContainerSummaryStateEnum::EXITED)
                == ContainerSummaryStateEnum::RUNNING,
        );
    });

    let query = query_builder.build();

    let mut transaction: sqlx::Transaction<'_, sqlx::Postgres> =
        match state.database_pool.begin().await {
            Ok(transaction) => transaction,
            Err(err) => {
                error!("Failed to begin transaction: {}", err);
                return;
            }
        };
    match query.execute(&mut *transaction).await {
        Ok(_) => {
            if let Err(err) = transaction.commit().await {
                error!("Failed to commit transaction: {}", err);
            }
        }
        Err(err) => {
            error!("Failed to execute query: {}", err);
            if let Err(rollback_err) = transaction.rollback().await {
                error!("Failed to rollback transaction: {}", rollback_err);
            }
        }
    }
}

/// Writes system information to the database
async fn write_system_info_to_db(system_info: SystemInfo, state: &AppState) {
    // Implementation to write stats to database
    trace!("Writing system info to database");
    let mut query_builder = sqlx::QueryBuilder::new(
        "INSERT INTO system_info (containers_running, containers_total,
        images_count, volumes_count, networks_count, timestamp)",
    );

    query_builder.push_values([()], |mut b, _| {
        b.push_bind(system_info.running_containers)
            .push_bind(system_info.total_containers)
            .push_bind(system_info.images)
            .push_bind(system_info.volumes)
            .push_bind(system_info.networks)
            .push_bind(system_info.timestamp);
    });

    let query = query_builder.build();

    let mut transaction: sqlx::Transaction<'_, sqlx::Postgres> =
        match state.database_pool.begin().await {
            Ok(transaction) => transaction,
            Err(err) => {
                error!("Failed to begin transaction: {}", err);
                return;
            }
        };
    match query.execute(&mut *transaction).await {
        Ok(_) => {
            if let Err(err) = transaction.commit().await {
                error!("Failed to commit transaction: {}", err);
            }
        }
        Err(err) => {
            error!("Failed to execute query: {}", err);
            if let Err(rollback_err) = transaction.rollback().await {
                error!("Failed to rollback transaction: {}", rollback_err);
            }
        }
    }
}

/// Deletes statistics older than 24 hours from the database
async fn delete_old_rows(table: &str, state: &AppState) {
    trace!("Deleting old rows from table {}", table);
    let mut qb = sqlx::QueryBuilder::new("DELETE FROM ");
    match table {
        "container_stats" | "system_info" => {
            qb.push(table) // raw push for identifiers
                .push(" WHERE timestamp < NOW() - interval '24 hours'");
        }
        _ => {
            error!("Invalid table: {table}");
        }
    }

    let query = qb.build();

    let mut transaction: sqlx::Transaction<'_, sqlx::Postgres> =
        match state.database_pool.begin().await {
            Ok(transaction) => transaction,
            Err(err) => {
                error!("Failed to begin transaction: {}", err);
                return;
            }
        };
    match query.execute(&mut *transaction).await {
        Ok(_) => {
            if let Err(err) = transaction.commit().await {
                error!("Failed to commit transaction: {}", err);
            }
        }
        Err(err) => {
            error!("Failed to execute query: {}", err);
            if let Err(rollback_err) = transaction.rollback().await {
                error!("Failed to rollback transaction: {}", rollback_err);
            }
        }
    }
}

/// Background worker that collects container statistics every 30 seconds
pub async fn container_stats_worker(state: Arc<AppState>) {
    let interval = Duration::from_secs(30);
    let mut next_exe_time = Instant::now() + interval;

    loop {
        let delete_future = delete_old_rows("container_stats", &state);
        let stats_future = get_all_container_stats(&state);
        delete_future.await;
        write_container_stats_to_db(stats_future.await, &state).await;
        let now = Instant::now();
        if now < next_exe_time {
            tokio::time::sleep(next_exe_time - now).await;
        }
        next_exe_time += interval;
    }
}

/// Background worker that collects system information every 15 seconds
pub async fn system_info_worker(state: Arc<AppState>) {
    let interval = Duration::from_secs(15);
    let mut next_exe_time = Instant::now() + interval;

    loop {
        let delete_future = delete_old_rows("system_info", &state);
        let system_info_future = get_system_info(&state);
        delete_future.await;
        write_system_info_to_db(system_info_future.await, &state).await;
        let now = Instant::now();
        if now < next_exe_time {
            tokio::time::sleep(next_exe_time - now).await;
        }
        next_exe_time += interval;
    }
}
