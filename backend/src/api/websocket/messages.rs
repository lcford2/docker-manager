//! WebSocket message type definitions
//!
//! This module defines all message types that can be sent/received
//! over the WebSocket connection, matching the frontend TypeScript types.

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
    pub containers: Vec<ContainerStatsWithHistory>,
}

/// System statistics message data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemStatsData {
    pub containers_running: i64,
    pub containers_paused: i64,
    pub containers_stopped: i64,
    pub images: i64,
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

/// Container statistics with historical sparkline data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerStatsWithHistory {
    pub id: String,
    pub names: Vec<String>,
    pub status: String,
    pub uptime: String,
    pub uptime_seconds: i64,
    pub cpu_percent: f64,
    pub memory_usage: i64,
    pub memory_limit: i64,
    pub memory_percent: f64,
    pub network_rx: i64,
    pub network_tx: i64,
    pub block_read: i64,
    pub block_write: i64,
    pub sparkline_data: SparklineData,
    pub timestamp: String,
}

/// Sparkline data for visualizations
#[derive(Debug, Clone, Serialize, Deserialize)]
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
