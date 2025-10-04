use crate::api::RouteSpec;
use crate::api::middleware::require_bearer_auth_middleware;
use crate::api::types;
use crate::lib::{errors::AppError, state::AppState};
use axum::{Json, Router, extract::State, middleware, routing::get};
use log::{info, trace};
use sqlx::Execute;
use std::sync::Arc;

// sub router for these endpoints
pub fn router() -> (Router<Arc<AppState>>, Vec<RouteSpec>) {
    let r = Router::new().nest(
        "/db",
        Router::new()
            .route("/system_stats", get(get_system_stats))
            .layer(middleware::from_fn(require_bearer_auth_middleware)),
    );

    let docs = vec![RouteSpec {
        method: "GET",
        path: "/db/system_stats".to_string(),
    }];
    (r, docs)
}

/// API endpoint allowing system statistics to be retrieved
///
/// # Arguments
/// * `State(state): State<Arc<AppState>>` - The application state
/// * `Query(params): Query<SystemStatsQuery>` - The query parameters
///
/// # Returns
/// * `Result<Json<SystemStatsResponse>, (StatusCode, Json<ApiError>)>` - The system statistics response or an error
#[utoipa::path(
    get,
    path = "/api/db/system_stats",
    responses(
        (status = 200, description = "System statistics retrieved successfully", body = types::db::SystemStatsResponse),
        (status = 400, description = "Invalid request parameters", body = types::db::ApiError),
        (status = 404, description = "System not found", body = types::db::ApiError),
        (status = 500, description = "Internal server error", body = types::db::ApiError)
    )
)]
pub async fn get_system_stats(
    State(state): State<Arc<AppState>>,
    Json(params): Json<types::db::SystemStatsQuery>,
) -> Result<Json<types::db::SystemStatsResponse>, AppError> {
    let response = fetch_system_stats(&state, params).await?;
    info!("Successfully fetched system stats");
    Ok(Json(response))
}

/// Fetches system statistics from the database
///
/// # Arguments
/// * `state` - The application state
/// * `params` - The query parameters
///
/// # Returns
/// * `Result<SystemStatsResponse, ApiError>` - The system statistics response or an error
async fn fetch_system_stats(
    state: &AppState,
    params: types::db::SystemStatsQuery,
) -> Result<types::db::SystemStatsResponse, AppError> {
    info!("Fetching system stats");
    let mut query_builder = sqlx::QueryBuilder::new(
        r#"SELECT id, containers_running, containers_total, images_count,
        volumes_count, networks_count, timestamp
        FROM system_info"#,
    );

    let mut conditions = Vec::new();
    let mut bind_values: Vec<Box<dyn sqlx::Encode<'_, sqlx::Postgres> + Send + Sync>> = Vec::new();

    if let Some(since) = params.since {
        conditions.push("timestamp >= $".to_string() + &(bind_values.len() + 1).to_string());
        bind_values.push(Box::new(since));
    }

    if let Some(until) = params.until {
        conditions.push("timestamp <= $".to_string() + &(bind_values.len() + 1).to_string());
        bind_values.push(Box::new(until));
    }

    // Add WHERE clause if we have conditions
    if !conditions.is_empty() {
        query_builder.push(" WHERE ");
        query_builder.push(conditions.join(" AND "));
    }

    // Add ORDER BY
    query_builder.push(" ORDER BY timestamp DESC");

    // Add LIMIT and OFFSET
    let default_limit = 3600 * 24 / 15; // one days worth of data at a 30 seconds collection interval
    let limit = params.limit.unwrap_or(default_limit).min(default_limit);
    let offset = params.offset.unwrap_or(0);

    query_builder.push(" LIMIT ");
    query_builder.push_bind(limit);
    query_builder.push(" OFFSET ");
    query_builder.push_bind(offset);
    let query = query_builder.build_query_as::<types::db::SystemStat>();
    let stats = query.fetch_all(&state.database_pool).await?;

    let total_count: i64 = build_and_execute_count_query(&params, &state.database_pool)
        .await
        .unwrap_or(0);

    Ok(types::db::SystemStatsResponse {
        data: stats,
        total_count,
        limit: Some(limit),
        offset: Some(offset),
    })
}

/// Builds and executes a SQL count query for system statistics with proper parameter binding
///
/// # Arguments
/// * `params` - The query parameters
/// * `pool` - The database connection pool
///
/// # Returns
/// * `Result<i64, sqlx::Error>` - The count result or an error
async fn build_and_execute_count_query(
    params: &types::db::SystemStatsQuery,
    pool: &sqlx::PgPool,
) -> Result<i64, sqlx::Error> {
    let mut query_builder = sqlx::QueryBuilder::new("SELECT COUNT(*) FROM system_info");

    let mut has_where = false;

    if let Some(since) = params.since {
        query_builder.push(" WHERE timestamp >= ");
        query_builder.push_bind(since);
        has_where = true;
    }

    if let Some(until) = params.until {
        if has_where {
            query_builder.push(" AND ");
        } else {
            query_builder.push(" WHERE ");
        }
        query_builder.push("timestamp <= ");
        query_builder.push_bind(until);
    }

    let query = query_builder.build_query_scalar::<i64>();
    trace!("Executing count query: {:?}", query.sql());

    query.fetch_one(pool).await
}

/// Fetch the latest system stats for WebSocket broadcasting
pub async fn fetch_latest_system_stats(
    pool: &sqlx::PgPool,
) -> Result<types::db::SystemStat, sqlx::Error> {
    sqlx::query_as::<_, types::db::SystemStat>(
        "SELECT * FROM system_info ORDER BY timestamp DESC LIMIT 1",
    )
    .fetch_one(pool)
    .await
}
