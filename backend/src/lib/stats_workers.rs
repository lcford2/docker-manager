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
        "INSERT INTO container_stats (id, name, state, status, image, cpu_percent,
        memory_percent, memory_usage, memory_limit, network_rx,
        network_tx, block_read, block_write, uptime_seconds, timestamp, is_active) ",
    );

    let mut system = System::new_all();
    system.refresh_memory();

    query_builder.push_values(stats.iter(), |mut b, stats_obj| {
        let c_stats = &stats_obj.stats.clone();
        let c_summary = &stats_obj.summary.clone();
        b.push_bind(c_stats.id.as_ref().unwrap_or(&String::new()).clone());
        b.push_bind(c_stats.name.as_ref().unwrap_or(&String::new()).clone());
        b.push_bind(
            c_summary
                .state
                .as_ref()
                .unwrap_or(&bollard::secret::ContainerSummaryStateEnum::PAUSED)
                .clone()
                .to_string(),
        );
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

        // Extract block I/O
        let (block_read, block_write) = c_stats
            .blkio_stats
            .as_ref()
            .and_then(|bs| bs.io_service_bytes_recursive.as_ref())
            .map(|io_stats| {
                let read: u64 = io_stats
                    .iter()
                    .filter(|s| {
                        s.op.as_ref()
                            .map(|op| op.as_str() == "read" || op.as_str() == "Read")
                            .unwrap_or(false)
                    })
                    .filter_map(|s| s.value)
                    .sum();
                let write: u64 = io_stats
                    .iter()
                    .filter(|s| {
                        s.op.as_ref()
                            .map(|op| op.as_str() == "write" || op.as_str() == "Write")
                            .unwrap_or(false)
                    })
                    .filter_map(|s| s.value)
                    .sum();
                (read as i64, write as i64)
            })
            .unwrap_or((0, 0));

        b.push_bind(block_read);
        b.push_bind(block_write);

        // Calculate uptime
        let uptime_seconds = c_summary
            .created
            .map(|created| {
                let now = Utc::now().timestamp();
                now - created
            })
            .unwrap_or(0);

        b.push_bind(uptime_seconds);
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
    let retention_hours = state.config.retention.stats_retention_hours;
    let mut qb = sqlx::QueryBuilder::new("DELETE FROM ");
    match table {
        "container_stats" | "system_info" => {
            qb.push(table) // raw push for identifiers
                .push(" WHERE timestamp < NOW() - interval '")
                .push(retention_hours.to_string())
                .push(" hours'");
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

/// Cleans up stats for containers that no longer exist
/// This function marks stats as inactive for containers that are not in the current container list
async fn cleanup_deleted_container_stats(
    current_containers: &[ContainerStatsInfo],
    state: &AppState,
) {
    trace!("Cleaning up stats for deleted containers");

    // Get all currently existing container IDs
    let current_ids: Vec<String> = current_containers
        .iter()
        .filter_map(|c| c.summary.id.clone())
        .collect();

    if current_ids.is_empty() {
        return;
    }

    // Mark all containers not in the current list as inactive
    let mut query_builder = sqlx::QueryBuilder::new(
        "UPDATE container_stats SET is_active = false WHERE is_active = true AND id NOT IN (",
    );

    let mut separated = query_builder.separated(", ");
    for id in &current_ids {
        separated.push_bind(id);
    }
    separated.push_unseparated(")");

    let query = query_builder.build();

    let mut transaction: sqlx::Transaction<'_, sqlx::Postgres> =
        match state.database_pool.begin().await {
            Ok(transaction) => transaction,
            Err(err) => {
                error!("Failed to begin transaction for cleanup: {}", err);
                return;
            }
        };

    match query.execute(&mut *transaction).await {
        Ok(result) => {
            let rows_affected = result.rows_affected();
            if rows_affected > 0 {
                trace!("Marked {} container stats as inactive", rows_affected);
            }
            if let Err(err) = transaction.commit().await {
                error!("Failed to commit cleanup transaction: {}", err);
            }
        }
        Err(err) => {
            error!("Failed to execute cleanup query: {}", err);
            if let Err(rollback_err) = transaction.rollback().await {
                error!("Failed to rollback cleanup transaction: {}", rollback_err);
            }
        }
    }
}

/// Background worker that collects container statistics
pub async fn container_stats_worker(state: Arc<AppState>) {
    let interval = Duration::from_secs(state.config.workers.container_stats_interval);
    let mut next_exe_time = Instant::now() + interval;

    loop {
        let delete_future = delete_old_rows("container_stats", &state);
        let stats_future = get_all_container_stats(&state);
        delete_future.await;
        let container_stats = stats_future.await;

        // Cleanup stats for deleted containers before writing new stats
        cleanup_deleted_container_stats(&container_stats, &state).await;

        write_container_stats_to_db(container_stats, &state).await;
        let now = Instant::now();
        if now < next_exe_time {
            tokio::time::sleep(next_exe_time - now).await;
        }
        next_exe_time += interval;
    }
}

/// Background worker that collects system information
pub async fn system_info_worker(state: Arc<AppState>) {
    let interval = Duration::from_secs(state.config.workers.system_info_interval);
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
