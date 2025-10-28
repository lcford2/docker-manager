//! WebSocket message type definitions
//!
//! This module defines all message types that can be sent/received
//! over the WebSocket connection, matching the frontend TypeScript types.

use crate::api::types::db::ContainerStatWithSparkline;
use serde::{Deserialize, Serialize};

/// Base WebSocket message structure
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "snake_case")]
pub enum WebSocketMessage {
    /// Initial connection confirmation
    Connection(ConnectionData),
    /// Container statistics with history
    ContainerStats(ContainerStatsData),
    /// System-level Docker statistics
    SystemStats(SystemStatsData),
    /// Ping message for health check
    Ping(PingData),
    /// Pong response to ping
    Pong(PongData),
    /// Request container logs
    ContainerLogsRequest(ContainerLogsRequestData),
    /// Container logs data (batched)
    ContainerLogs(ContainerLogsData),
    /// Container logs stream ended
    ContainerLogsEnd(ContainerLogsEndData),
    /// Container logs error
    ContainerLogsError(ContainerLogsErrorData),
}

/// Connection message data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionData {
    pub status: String,
    pub user: String,
}

/// Container statistics message data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerStatsData {
    pub containers: Vec<ContainerStatWithSparkline>,
}

/// System statistics message data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemStatsData {
    pub containers_running: i64,
    pub containers_stopped: i64,
    pub containers_total: i64,
    pub images: i64,
    pub volumes: i64,
    pub networks: i64,
    pub server_version: String,
    pub total_memory: i64,
    pub cpus: i64,
}

/// Ping message data (empty)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PingData {}

/// Pong message data (empty)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PongData {}

/// Helper function for serde default
fn default_tail() -> usize {
    100
}

/// Helper function for serde default
fn default_true() -> bool {
    true
}

/// Individual log line
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogLine {
    pub line: String,
    pub stream: String, // "stdout" or "stderr"
    pub timestamp: Option<String>,
}

/// Container logs request data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerLogsRequestData {
    pub container_id: String,
    #[serde(default = "default_tail")]
    pub tail: usize,
    #[serde(default)]
    pub follow: bool,
    #[serde(default)]
    pub timestamps: bool,
    #[serde(default = "default_true")]
    pub stdout: bool,
    #[serde(default = "default_true")]
    pub stderr: bool,
}

/// Container logs message data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerLogsData {
    pub container_id: String,
    pub lines: Vec<LogLine>,
    pub is_initial: bool,
}

/// Container logs end message data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerLogsEndData {
    pub container_id: String,
}

/// Container logs error message data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerLogsErrorData {
    pub container_id: String,
    pub error: String,
}
