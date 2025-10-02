//! Manages WebSocket connections and broadcasts stats to all connected clients.

use super::messages::*;
use crate::lib::state::AppState;
use axum::extract::ws::Message;
use chrono::Utc;
use futures_util::stream::StreamExt;
use log::{error, info, warn};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, mpsc};
use tokio::time::{Duration, interval};

/// Client identifier
pub type ClientId = usize;

/// Broadcaster manages all active WebSocket connections
#[derive(Clone)]
pub struct Broadcaster {
    clients: Arc<RwLock<HashMap<ClientId, mpsc::UnboundedSender<Message>>>>,
    next_client_id: Arc<RwLock<ClientId>>,
    sparkline_history: Arc<RwLock<HashMap<String, ContainerHistory>>>,
}

/// Historical data for sparkline visualization
#[derive(Debug, Clone)]
struct ContainerHistory {
    cpu: Vec<f64>,
    memory: Vec<f64>,
    network_rx: Vec<i64>,
    network_tx: Vec<i64>,
    block_read: Vec<i64>,
    block_write: Vec<i64>,
}

impl ContainerHistory {
    fn new() -> Self {
        Self {
            cpu: Vec::new(),
            memory: Vec::new(),
            network_rx: Vec::new(),
            network_tx: Vec::new(),
            block_read: Vec::new(),
            block_write: Vec::new(),
        }
    }

    fn add_point(&mut self, stats: &ContainerStatsWithHistory, max_points: usize) {
        self.cpu.push(stats.cpu_percent);
        self.memory.push(stats.memory_percent);
        self.network_rx.push(stats.network_rx);
        self.network_tx.push(stats.network_tx);
        self.block_read.push(stats.block_read);
        self.block_write.push(stats.block_write);

        // Keep only the last N points
        if self.cpu.len() > max_points {
            self.cpu.remove(0);
            self.memory.remove(0);
            self.network_rx.remove(0);
            self.network_tx.remove(0);
            self.block_read.remove(0);
            self.block_write.remove(0);
        }
    }

    fn to_sparkline_data(&self) -> SparklineData {
        SparklineData {
            cpu: self.cpu.clone(),
            memory: self.memory.clone(),
            network_rx: self.network_rx.clone(),
            network_tx: self.network_tx.clone(),
            block_read: self.block_read.clone(),
            block_write: self.block_write.clone(),
        }
    }
}

impl Broadcaster {
    /// Create a new broadcaster
    pub fn new() -> Self {
        Self {
            clients: Arc::new(RwLock::new(HashMap::new())),
            next_client_id: Arc::new(RwLock::new(0)),
            sparkline_history: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Register a new client and return the client ID and receiver
    pub async fn subscribe(&self) -> (ClientId, mpsc::UnboundedReceiver<Message>) {
        let (tx, rx) = mpsc::unbounded_channel();
        let mut id = self.next_client_id.write().await;
        let client_id = *id;
        *id += 1;

        self.clients.write().await.insert(client_id, tx);
        info!("WebSocket client {} connected", client_id);

        (client_id, rx)
    }

    /// Unregister a client
    pub async fn unsubscribe(&self, client_id: ClientId) {
        self.clients.write().await.remove(&client_id);
        info!("WebSocket client {} disconnected", client_id);
    }

    /// Send a message to a specific client
    pub async fn send_to_client(&self, client_id: ClientId, message: WebSocketMessage) {
        if let Some(tx) = self.clients.read().await.get(&client_id) {
            if let Ok(json) = serde_json::to_string(&message) {
                let _ = tx.send(Message::Text(json.into()));
            }
        }
    }

    /// Broadcast a message to all connected clients
    pub async fn broadcast(&self, message: WebSocketMessage) {
        let clients = self.clients.read().await;
        if let Ok(json) = serde_json::to_string(&message) {
            for (client_id, tx) in clients.iter() {
                if tx.send(Message::Text(json.clone().into())).is_err() {
                    warn!("Failed to send message to client {}", client_id);
                }
            }
        }
    }

    /// Get the number of connected clients
    pub async fn client_count(&self) -> usize {
        self.clients.read().await.len()
    }

    /// Start background task to collect and broadcast container stats
    pub fn start_container_stats_task(self: Arc<Self>, state: Arc<AppState>) {
        tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(3));

            loop {
                interval.tick().await;

                // Only collect stats if there are connected clients
                if self.client_count().await == 0 {
                    continue;
                }

                match self.collect_container_stats(&state).await {
                    Ok(stats_data) => {
                        self.broadcast(WebSocketMessage::ContainerStats(stats_data))
                            .await;
                    }
                    Err(e) => {
                        error!("Failed to collect container stats: {}", e);
                    }
                }
            }
        });
    }

    /// Start background task to collect and broadcast system stats
    pub fn start_system_stats_task(self: Arc<Self>, state: Arc<AppState>) {
        tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(5));

            loop {
                interval.tick().await;

                // Only collect stats if there are connected clients
                if self.client_count().await == 0 {
                    continue;
                }

                match self.collect_system_stats(&state).await {
                    Ok(stats_data) => {
                        self.broadcast(WebSocketMessage::SystemStats(stats_data))
                            .await;
                    }
                    Err(e) => {
                        error!("Failed to collect system stats: {}", e);
                    }
                }
            }
        });
    }

    /// Collect container statistics
    async fn collect_container_stats(
        &self,
        state: &AppState,
    ) -> Result<ContainerStatsData, String> {
        // List all containers
        let containers = state
            .docker_client
            .list_containers(None::<bollard::query_parameters::ListContainersOptions>)
            .await
            .map_err(|e| format!("Failed to list containers: {}", e))?;

        let mut container_stats = Vec::new();
        let max_sparkline_points = 60; // Keep 3 minutes of data at 3-second intervals

        for container in containers {
            let container_id = container.id.as_ref().unwrap().clone();
            let container_name = container
                .names
                .as_ref()
                .and_then(|names| names.first())
                .map(|name| name.trim_start_matches('/').to_string())
                .unwrap_or_else(|| "unknown".to_string());

            let status = container
                .state
                .map(|s| format!("{:?}", s).to_lowercase())
                .unwrap_or_else(|| "unknown".to_string());

            // Only get stats for running containers
            if status != "running" {
                continue;
            }

            // Get stats for this container
            let mut stats_stream = state.docker_client.stats(
                &container_id,
                None::<bollard::query_parameters::StatsOptions>,
            );

            if let Some(Ok(stats)) = stats_stream.next().await {
                // Calculate CPU percentage
                let cpu_delta = stats
                    .cpu_stats
                    .as_ref()
                    .and_then(|cs| cs.cpu_usage.as_ref())
                    .and_then(|cu| cu.total_usage)
                    .unwrap_or(0) as f64
                    - stats
                        .precpu_stats
                        .as_ref()
                        .and_then(|pcs| pcs.cpu_usage.as_ref())
                        .and_then(|cu| cu.total_usage)
                        .unwrap_or(0) as f64;

                let system_delta = stats
                    .cpu_stats
                    .as_ref()
                    .and_then(|cs| cs.system_cpu_usage)
                    .unwrap_or(0) as f64
                    - stats
                        .precpu_stats
                        .as_ref()
                        .and_then(|pcs| pcs.system_cpu_usage)
                        .unwrap_or(0) as f64;

                let num_cpus = stats
                    .cpu_stats
                    .as_ref()
                    .and_then(|cs| cs.online_cpus)
                    .unwrap_or(1) as f64;

                let cpu_percent = if system_delta > 0.0 {
                    (cpu_delta / system_delta) * num_cpus * 100.0
                } else {
                    0.0
                };

                // Calculate memory
                let memory_usage = stats
                    .memory_stats
                    .as_ref()
                    .and_then(|ms| ms.usage)
                    .unwrap_or(0) as i64;

                let memory_limit = stats
                    .memory_stats
                    .as_ref()
                    .and_then(|ms| ms.limit)
                    .unwrap_or(1) as i64;

                let memory_percent = if memory_limit > 0 {
                    (memory_usage as f64 / memory_limit as f64) * 100.0
                } else {
                    0.0
                };

                // Calculate network I/O
                let (network_rx, network_tx) = if let Some(networks) = &stats.networks {
                    let rx: u64 = networks.values().filter_map(|n| n.rx_bytes).sum::<u64>();
                    let tx: u64 = networks.values().filter_map(|n| n.tx_bytes).sum::<u64>();
                    (rx as i64, tx as i64)
                } else {
                    (0, 0)
                };

                // Calculate block I/O
                let (block_read, block_write) = stats
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

                // Calculate uptime
                let uptime_seconds = if let Some(started_at) = container.created {
                    let now = Utc::now().timestamp();
                    now - started_at
                } else {
                    0
                };
                let uptime = format_uptime(uptime_seconds);

                let container_stat = ContainerStatsWithHistory {
                    id: container_id.clone(),
                    names: vec![container_name],
                    status,
                    uptime,
                    uptime_seconds,
                    cpu_percent,
                    memory_usage,
                    memory_limit,
                    memory_percent,
                    network_rx,
                    network_tx,
                    block_read,
                    block_write,
                    sparkline_data: SparklineData::default(),
                    timestamp: Utc::now().to_rfc3339(),
                };

                // Update sparkline history
                let mut history = self.sparkline_history.write().await;
                let container_history = history
                    .entry(container_id.clone())
                    .or_insert_with(ContainerHistory::new);
                container_history.add_point(&container_stat, max_sparkline_points);

                // Add sparkline data to the stat
                let mut stat_with_sparkline = container_stat;
                stat_with_sparkline.sparkline_data = container_history.to_sparkline_data();

                container_stats.push(stat_with_sparkline);
            }
        }

        Ok(ContainerStatsData {
            containers: container_stats,
        })
    }

    /// Collect system statistics
    async fn collect_system_stats(&self, state: &AppState) -> Result<SystemStatsData, String> {
        // Get system info
        let info = state
            .docker_client
            .info()
            .await
            .map_err(|e| format!("Failed to get system info: {}", e))?;

        // Get version
        let version = state
            .docker_client
            .version()
            .await
            .map_err(|e| format!("Failed to get version: {}", e))?;

        // Count containers by state
        let all_containers = state
            .docker_client
            .list_containers(None::<bollard::query_parameters::ListContainersOptions>)
            .await
            .map_err(|e| format!("Failed to list containers: {}", e))?;

        let mut running = 0;
        let mut paused = 0;
        let mut stopped = 0;

        for container in all_containers {
            if let Some(state_enum) = container.state {
                let state_str = format!("{:?}", state_enum).to_lowercase();
                match state_str.as_str() {
                    "running" => running += 1,
                    "paused" => paused += 1,
                    _ => stopped += 1,
                }
            } else {
                stopped += 1;
            }
        }

        Ok(SystemStatsData {
            containers_running: running,
            containers_paused: paused,
            containers_stopped: stopped,
            images: info.images.unwrap_or(0) as i64,
            server_version: version.version.unwrap_or_else(|| "unknown".to_string()),
            total_memory: info.mem_total.unwrap_or(0) as i64,
            cpus: info.ncpu.unwrap_or(0) as i64,
        })
    }
}

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
