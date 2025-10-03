use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;
///
/// Represents a container's statistics and metadata at a specific point in time.
///
/// This struct contains both static container information (like name and image) and
/// dynamic performance metrics (like CPU usage and memory statistics). It maps
/// directly to the `container_stats` database table.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct ContainerStat {
    /// Unique container identifier (Docker container ID)
    pub id: String,

    /// Human-readable container name
    pub name: String,

    /// Current state of the container (e.g., "running", "stopped", "paused")
    pub state: String,

    /// Human readable status
    pub status: String,

    /// Docker image name/tag the container was created from
    pub image: Option<String>,

    /// CPU usage as a percentage (0.0-100.0)
    pub cpu_percent: Option<f64>,

    /// Memory usage as a percentage of the container's memory limit (0.0-100.0)
    pub memory_percent: Option<f64>,

    /// Current memory usage in bytes
    pub memory_usage: Option<i64>,

    /// Memory limit configured for the container in bytes
    pub memory_limit: Option<i64>,

    /// Total bytes received over network interfaces
    pub network_rx: Option<i64>,

    /// Total bytes transmitted over network interfaces
    pub network_tx: Option<i64>,

    /// Total bytes read from block devices
    pub block_read: Option<i64>,

    /// Total bytes written to block devices
    pub block_write: Option<i64>,
    /// Container uptime in seconds
    pub uptime_seconds: i64,
    /// Timestamp when these statistics were collected
    pub timestamp: DateTime<Utc>,

    /// Whether the container is currently active/running
    pub is_active: Option<bool>,

    /// Database primary key for this statistics record
    pub stat_id: i64,
}

/// Query parameters for filtering container statistics
#[derive(Debug, Deserialize, ToSchema)]
pub struct ContainerStatsQuery {
    pub container_id: Option<String>,
    pub name: Option<String>,
    pub status: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub since: Option<DateTime<Utc>>,
    pub until: Option<DateTime<Utc>>,
    pub active_only: Option<bool>,
}

/// Response wrapper for container statistics API
#[derive(Debug, Serialize, ToSchema)]
pub struct ContainerStatsResponse {
    pub data: Vec<ContainerStat>,
    pub total_count: i64,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// A system statistics record from the `system_info` database table.
///
/// # Fields
///
/// * `id` - The unique identifier for this system statistics record
/// * `containers_running` - The number of containers that were running at the time of measurement
/// * `containers_total` - The total number of containers (running and stopped) at the time of measurement
/// * `images_count` - The total number of Docker images present on the system
/// * `volumes_count` - The total number of Docker volumes present on the system
/// * `networks_count` - The total number of Docker networks present on the system
/// * `timestamp` - The UTC timestamp when this system snapshot was recorded
#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct SystemStat {
    pub id: i32,
    pub containers_running: i32,
    pub containers_total: i32,
    pub images_count: i32,
    pub volumes_count: i32,
    pub networks_count: i32,
    pub timestamp: DateTime<Utc>,
}

/// Query parameters for filtering a call to get system statistics
///
/// # Fields
///
/// * `limit` - The maximum number of records to return
/// * `offset` - The number of records to skip before returning results
/// * `since` - The start date and time for filtering records
/// * `until` - The end date and time for filtering records
#[derive(Debug, Deserialize, ToSchema)]
pub struct SystemStatsQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub since: Option<DateTime<Utc>>,
    pub until: Option<DateTime<Utc>>,
}

/// System statistics response wrapper
///
/// # Fields
///
/// * `data` - The system statistics data
/// * `total_count` - The total number of system statistics records
/// * `limit` - The maximum number of records to return
/// * `offset` - The number of records to skip before returning results
#[derive(Debug, Serialize, ToSchema)]
pub struct SystemStatsResponse {
    pub data: Vec<SystemStat>,
    pub total_count: i64,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// Error type for API responses
#[derive(Debug, Serialize, ToSchema)]
pub struct ApiError {
    pub error: String,
    pub code: u16,
}

/// Converts a sqlx::Error into an ApiError
impl From<sqlx::Error> for ApiError {
    fn from(err: sqlx::Error) -> Self {
        Self {
            error: format!("Database error: {}", err),
            code: 500,
        }
    }
}

/// Sparkline data for visualizations
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SparklineData {
    pub cpu: Vec<f64>,
    pub memory: Vec<f64>,
    pub network_rx: Vec<i64>,
    pub network_tx: Vec<i64>,
    pub block_read: Vec<i64>,
    pub block_write: Vec<i64>,
}

impl Default for SparklineData {
    fn default() -> Self {
        Self {
            cpu: Vec::new(),
            memory: Vec::new(),
            network_rx: Vec::new(),
            network_tx: Vec::new(),
            block_read: Vec::new(),
            block_write: Vec::new(),
        }
    }
}

/// Container statistics with sparkline data for WebSocket broadcasting
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ContainerStatWithSparkline {
    #[serde(flatten)]
    pub stat: ContainerStat,
    /// Human-readable uptime string (computed from uptime_seconds)
    pub uptime: String,
    /// Historical sparkline data for visualization
    pub sparkline_data: SparklineData,
}
