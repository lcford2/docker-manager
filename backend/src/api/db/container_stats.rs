use crate::api::RouteSpec;
use crate::api::middleware::require_bearer_auth_middleware;
use crate::api::types;
use crate::lib::{errors::AppError, state::AppState};
use axum::{
    Json, Router,
    extract::{Query, State},
    middleware,
    routing::get,
};
use chrono::{Duration, Utc};
use log::{info, trace};
use sqlx::Execute;
use std::sync::Arc;

/// Format uptime in a human-readable format
fn format_uptime(seconds: i64) -> String {
    let days = seconds / 86400;
    let hours = (seconds % 86400) / 3600;
    let minutes = (seconds % 3600) / 60;
    let secs = seconds % 60;

    if days > 0 {
        format!("{}d {}h", days, hours)
    } else if hours > 0 {
        format!("{}h {}m", hours, minutes)
    } else if minutes > 0 {
        format!("{}m {}s", minutes, secs)
    } else {
        format!("{}s", secs)
    }
}

/// Creates the router for container statistics endpoints
pub fn router() -> (Router<Arc<AppState>>, Vec<RouteSpec>) {
    let r = Router::new().nest(
        "/db",
        Router::new()
            .route("/container_stats", get(get_container_stats))
            .layer(middleware::from_fn(require_bearer_auth_middleware))
            .route("/aggregate_metrics", get(get_aggregate_metrics))
            .layer(middleware::from_fn(require_bearer_auth_middleware)),
    );

    let docs = vec![
        RouteSpec {
            method: "GET",
            path: "/db/container_stats".to_string(),
        },
        RouteSpec {
            method: "GET",
            path: "/db/aggregate_metrics".to_string(),
        },
    ];
    (r, docs)
}

/// API endpoint for retrieving container statistics
#[utoipa::path(
    get,
    path="/api/db/container_stats",
    responses(
        (status = 200, description = "Container statistics retrieved successfully", body = types::db::ContainerStatsResponse),
        (status = 400, description = "Invalid request parameters"),
        (status = 404, description = "Container not found"),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn get_container_stats(
    State(state): State<Arc<AppState>>,
    Json(params): Json<types::db::ContainerStatsQuery>,
) -> Result<Json<types::db::ContainerStatsResponse>, AppError> {
    let response = fetch_container_stats(&state, params).await?;
    info!("Successfully fetched container stats");
    Ok(Json(response))
}

/// Fetches container statistics from the database
async fn fetch_container_stats(
    state: &AppState,
    params: types::db::ContainerStatsQuery,
) -> Result<types::db::ContainerStatsResponse, AppError> {
    info!("Fetching container stats");
    let mut query_builder = sqlx::QueryBuilder::new(
        r#"SELECT id, name, state, status, image, cpu_percent, memory_percent,
        memory_usage, memory_limit, network_rx, network_tx, block_read,
        block_write, timestamp, is_active, stat_id
        FROM container_stats"#,
    );

    let mut conditions = Vec::new();
    let mut bind_values: Vec<Box<dyn sqlx::Encode<'_, sqlx::Postgres> + Send + Sync>> = Vec::new();

    if let Some(container_id) = &params.container_id {
        conditions.push("id = $".to_string() + &(bind_values.len() + 1).to_string());
        bind_values.push(Box::new(container_id.clone()));
    }

    if let Some(name) = &params.name {
        conditions.push("name = $".to_string() + &(bind_values.len() + 1).to_string());
        bind_values.push(Box::new(name.clone()));
    }

    if let Some(status) = &params.status {
        conditions.push("status = $".to_string() + &(bind_values.len() + 1).to_string());
        bind_values.push(Box::new(status.clone()));
    }

    if let Some(since) = params.since {
        conditions.push("timestamp >= $".to_string() + &(bind_values.len() + 1).to_string());
        bind_values.push(Box::new(since));
    }

    if let Some(until) = params.until {
        conditions.push("timestamp <= $".to_string() + &(bind_values.len() + 1).to_string());
        bind_values.push(Box::new(until));
    }

    if let Some(true) = params.active_only {
        conditions.push("is_active = true".to_string());
    }

    // Add WHERE clause if we have conditions
    if !conditions.is_empty() {
        query_builder.push(" WHERE ");
        query_builder.push(conditions.join(" AND "));
    }

    // Add ORDER BY
    query_builder.push(" ORDER BY timestamp DESC");

    // Add LIMIT and OFFSET
    let default_limit = 3600 * 24 / 30; // one days worth of data at a 30 seconds collection interval
    let limit = params.limit.unwrap_or(default_limit).min(default_limit);
    let offset = params.offset.unwrap_or(0);

    query_builder.push(" LIMIT ");
    query_builder.push_bind(limit);
    query_builder.push(" OFFSET ");
    query_builder.push_bind(offset);
    let query = query_builder.build_query_as::<types::db::ContainerStat>();
    let stats = query.fetch_all(&state.database_pool).await?;

    let total_count: i64 = build_and_execute_count_query(&params, &state.database_pool).await?;

    Ok(types::db::ContainerStatsResponse {
        data: stats,
        total_count,
        limit: Some(limit),
        offset: Some(offset),
    })
}

/// Builds and executes a SQL count query for container statistics with proper parameter binding
async fn build_and_execute_count_query(
    params: &types::db::ContainerStatsQuery,
    pool: &sqlx::PgPool,
) -> Result<i64, sqlx::Error> {
    let mut query_builder = sqlx::QueryBuilder::new("SELECT COUNT(*) FROM container_stats");

    let mut conditions = Vec::new();

    if let Some(container_id) = &params.container_id {
        conditions.push(("id = ", container_id.clone()));
    }
    if let Some(name) = &params.name {
        conditions.push(("name = ", name.clone()));
    }
    if let Some(status) = &params.status {
        conditions.push(("status = ", status.clone()));
    }

    // Add WHERE clause for string conditions
    if !conditions.is_empty() {
        query_builder.push(" WHERE ");
        let mut first = true;
        for (condition, value) in conditions {
            if !first {
                query_builder.push(" AND ");
            }
            query_builder.push(condition);
            query_builder.push_bind(value);
            first = false;
        }
    }

    // Add timestamp conditions
    let has_where =
        params.container_id.is_some() || params.name.is_some() || params.status.is_some();

    if let Some(since) = params.since {
        if has_where {
            query_builder.push(" AND ");
        } else {
            query_builder.push(" WHERE ");
        }
        query_builder.push("timestamp >= ");
        query_builder.push_bind(since);
    }

    if let Some(until) = params.until {
        if has_where || params.since.is_some() {
            query_builder.push(" AND ");
        } else {
            query_builder.push(" WHERE ");
        }
        query_builder.push("timestamp <= ");
        query_builder.push_bind(until);
    }

    if let Some(true) = params.active_only {
        if has_where || params.since.is_some() || params.until.is_some() {
            query_builder.push(" AND ");
        } else {
            query_builder.push(" WHERE ");
        }
        query_builder.push("is_active = true");
    }

    let query = query_builder.build_query_scalar::<i64>();
    trace!("Executing count query: {:?}", query.sql());

    query.fetch_one(pool).await
}

/// Fetch latest stats for all active containers with sparkline data
/// This is optimized for WebSocket broadcasting
/// Cross-references database with Docker API to ensure only existing containers are returned
pub async fn fetch_latest_stats_with_sparklines(
    pool: &sqlx::PgPool,
    sparkline_points: i64,
    docker_client: &bollard::Docker,
) -> Result<Vec<types::db::ContainerStatWithSparkline>, sqlx::Error> {
    // First, get all current container IDs from Docker
    use bollard::query_parameters::ListContainersOptionsBuilder;
    let opts = Some(ListContainersOptionsBuilder::default().all(true).build());

    let current_containers = match docker_client.list_containers(opts).await {
        Ok(containers) => containers,
        Err(e) => {
            log::error!("Failed to list containers from Docker: {}", e);
            return Ok(Vec::new());
        }
    };

    let current_container_ids: Vec<String> = current_containers
        .iter()
        .filter_map(|c| c.id.clone())
        .collect();

    if current_container_ids.is_empty() {
        return Ok(Vec::new());
    }

    // Delete stats for containers that no longer exist in Docker
    delete_non_existent_containers(pool, &current_container_ids).await?;

    // Query: Get latest stat per container, filtered to only current containers
    let mut query_builder = sqlx::QueryBuilder::new(
        r#"
        SELECT DISTINCT ON (id)
            id, name, state, status, image, cpu_percent, memory_percent,
            memory_usage, memory_limit, network_rx, network_tx,
            block_read, block_write, uptime_seconds, timestamp, is_active, stat_id
        FROM container_stats
        WHERE id IN (
        "#,
    );

    let mut separated = query_builder.separated(", ");
    for id in &current_container_ids {
        separated.push_bind(id);
    }
    separated.push_unseparated(")");

    query_builder.push(" ORDER BY id, timestamp DESC");

    let latest_stats = query_builder
        .build_query_as::<types::db::ContainerStat>()
        .fetch_all(pool)
        .await?;

    // For each container, fetch sparkline history
    let mut results = Vec::new();
    for stat in latest_stats {
        let sparkline = fetch_sparkline_for_container(&stat.id, sparkline_points, pool).await?;
        results.push(types::db::ContainerStatWithSparkline {
            uptime: format_uptime(stat.uptime_seconds),
            sparkline_data: sparkline,
            stat,
        });
    }

    Ok(results)
}

/// Delete stats for containers that no longer exist in Docker
async fn delete_non_existent_containers(
    pool: &sqlx::PgPool,
    current_container_ids: &[String],
) -> Result<(), sqlx::Error> {
    if current_container_ids.is_empty() {
        return Ok(());
    }

    let mut query_builder =
        sqlx::QueryBuilder::new("DELETE FROM container_stats WHERE id NOT IN (");

    let mut separated = query_builder.separated(", ");
    for id in current_container_ids {
        separated.push_bind(id);
    }
    separated.push_unseparated(")");

    let query = query_builder.build();

    match query.execute(pool).await {
        Ok(result) => {
            let rows_deleted = result.rows_affected();
            if rows_deleted > 0 {
                log::info!(
                    "Deleted {} stats for containers that no longer exist",
                    rows_deleted
                );
            }
            Ok(())
        }
        Err(e) => {
            log::error!("Failed to delete non-existent container stats: {}", e);
            Err(e)
        }
    }
}

/// Sparkline row from query
#[derive(sqlx::FromRow)]
struct SparklineRow {
    cpu_percent: Option<f64>,
    memory_percent: Option<f64>,
    network_rx: Option<i64>,
    network_tx: Option<i64>,
    block_read: Option<i64>,
    block_write: Option<i64>,
}

/// Fetch sparkline data for a single container
async fn fetch_sparkline_for_container(
    container_id: &str,
    points: i64,
    pool: &sqlx::PgPool,
) -> Result<types::db::SparklineData, sqlx::Error> {
    let rows = sqlx::query_as::<_, SparklineRow>(
        r#"
        SELECT cpu_percent, memory_percent, network_rx, network_tx, block_read, block_write
        FROM container_stats
        WHERE id = $1
        ORDER BY timestamp DESC
        LIMIT $2
        "#,
    )
    .bind(container_id)
    .bind(points)
    .fetch_all(pool)
    .await?;

    // Reverse to get chronological order (oldest to newest)
    Ok(types::db::SparklineData {
        cpu: rows.iter().rev().filter_map(|r| r.cpu_percent).collect(),
        memory: rows.iter().rev().filter_map(|r| r.memory_percent).collect(),
        network_rx: rows.iter().rev().filter_map(|r| r.network_rx).collect(),
        network_tx: rows.iter().rev().filter_map(|r| r.network_tx).collect(),
        block_read: rows.iter().rev().filter_map(|r| r.block_read).collect(),
        block_write: rows.iter().rev().filter_map(|r| r.block_write).collect(),
    })
}

/// API endpoint for retrieving aggregate metrics history
/// Returns the sum of CPU and memory usage across all containers over time
#[utoipa::path(
    get,
    path="/api/db/aggregate_metrics",
    params(types::db::AggregateMetricsQuery),
    responses(
        (status = 200, description = "Aggregate metrics retrieved successfully", body = types::db::AggregateMetricsResponse),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn get_aggregate_metrics(
    State(state): State<Arc<AppState>>,
    Query(params): Query<types::db::AggregateMetricsQuery>,
) -> Result<Json<types::db::AggregateMetricsResponse>, AppError> {
    let minutes = params.minutes.unwrap_or(30);
    let limit = params.limit.unwrap_or(100).min(500); // Cap at 500 points

    let since = Utc::now() - Duration::minutes(minutes);

    // Query to get aggregate metrics grouped by timestamp
    let data = sqlx::query_as::<_, types::db::AggregateMetricsPoint>(
        r#"
        SELECT
            timestamp,
            COALESCE(SUM(cpu_percent), 0.0) as total_cpu,
            COALESCE(SUM(memory_percent), 0.0) as total_memory
        FROM container_stats
        WHERE timestamp >= $1
        GROUP BY timestamp
        ORDER BY timestamp ASC
        LIMIT $2
        "#,
    )
    .bind(since)
    .bind(limit)
    .fetch_all(&state.database_pool)
    .await?;

    let total_count = data.len() as i64;

    Ok(Json(types::db::AggregateMetricsResponse {
        data,
        total_count,
    }))
}
