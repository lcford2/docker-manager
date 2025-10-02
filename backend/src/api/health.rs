use crate::api::RouteSpec;
use crate::api::middleware::require_bearer_auth_middleware;
use crate::api::types::generic::{DockerStatusResponse, HealthResponse};
use crate::lib::state::AppState;
use axum::{
    Json, Router, extract::State, http::StatusCode, middleware, response::IntoResponse,
    routing::get,
};
use chrono::Utc;
use std::sync::Arc;

/// Creates the router for health check endpoint
pub fn router() -> (Router<Arc<AppState>>, Vec<RouteSpec>) {
    let r = Router::new()
        .route("/health", get(health_check))
        .route("/docker-status", get(docker_status))
        .layer(middleware::from_fn(require_bearer_auth_middleware));

    let docs = vec![
        RouteSpec {
            method: "GET",
            path: "/health".to_string(),
        },
        RouteSpec {
            method: "GET",
            path: "/docker-status".to_string(),
        },
    ];

    (r, docs)
}

/// API Endpoint for a health check
///
/// # Arguments
/// * `State(state): State<Arc<AppState>>` - The application state.
///
/// # Returns
/// Returns a JSON response with the current status of the API.
#[utoipa::path(
    get,
    path = "/api/health",
    responses(
        (status = 200, description = "API is healthy", body = HealthResponse),
        (status = 401, description = "Unauthorized - Invalid or missing Bearer token"),
        (status = 500, description = "Internal Server Error", body=String)
    )
)]
pub async fn health_check(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let now = Utc::now();
    let message = String::from("API Healthy");
    let uptime = now.signed_duration_since(state.startup_time).num_seconds();

    let body = HealthResponse {
        message,
        current_time: now,
        startup_time: state.startup_time,
        uptime_seconds: uptime,
    };

    (StatusCode::OK, Json(body))
}

/// API Endpoint for getting docker daemon status
///
/// # Arguments
/// * `State(state): State<Arc<AppState>>` - The application state.
///
/// # Returns
/// Returns a JSON response with the current status of the docker daemon.
#[utoipa::path(
    get,
    path = "/api/docker-status",
    responses(
        (status = 200, description = "API is healthy", body = DockerStatusResponse),
    )
)]
pub async fn docker_status(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    // Try to get Docker version, but don't crash if it fails
    match state.docker_client.version().await {
        Ok(version_object) => {
            let version = version_object
                .api_version
                .unwrap_or_else(|| "unknown".to_string());
            let status_message = "connected".to_string();
            let body = DockerStatusResponse {
                status: status_message,
                docker_version: version,
                error: String::default(),
                current_time: Utc::now(),
            };

            (StatusCode::OK, Json(body))
        }
        Err(e) => {
            let status_message = "disconnected".to_string();
            let version = "unknown".to_string();
            let error_message = format!("Error: {}", e);
            let body = DockerStatusResponse {
                status: status_message,
                docker_version: version,
                error: error_message,
                current_time: Utc::now(),
            };

            (StatusCode::OK, Json(body))
        }
    }
}
