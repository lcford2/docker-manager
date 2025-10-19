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
