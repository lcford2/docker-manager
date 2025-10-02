use chrono::{DateTime, Utc};
use serde::Serialize;
use utoipa::ToSchema;

/// Generic API response structure
#[derive(Serialize, ToSchema, Default)]
pub struct GenericResponse {
    pub success: bool,
    pub error_message: String,
}

/// Response structure for successful login
#[derive(Serialize, ToSchema)]
pub struct LoginResponse {
    pub success: bool,
    pub error_message: String,
    pub token: Option<String>,
    pub user: Option<String>,
}

/// Response structure for health check endpoint
#[derive(Serialize, ToSchema)]
pub struct HealthResponse {
    pub message: String,
    pub current_time: DateTime<Utc>,
    pub startup_time: DateTime<Utc>,
    pub uptime_seconds: i64,
}

/// Response structure for docker daemon status
#[derive(Serialize, ToSchema)]
pub struct DockerStatusResponse {
    pub status: String,
    pub docker_version: String,
    pub error: String,
    pub current_time: DateTime<Utc>,
}
