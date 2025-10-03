//! Manages WebSocket connections and broadcasts stats to all connected clients.

use super::messages::*;
use crate::api::db::{container_stats, system_stats};
use crate::lib::state::AppState;
use axum::extract::ws::Message;
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
}

impl Broadcaster {
    /// Create a new broadcaster
    pub fn new() -> Self {
        Self {
            clients: Arc::new(RwLock::new(HashMap::new())),
            next_client_id: Arc::new(RwLock::new(0)),
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

    /// Collect container statistics from database
    async fn collect_container_stats(
        &self,
        state: &AppState,
    ) -> Result<ContainerStatsData, String> {
        // Sparkline points: 30s collection interval, want ~30 minutes of history
        let sparkline_points = 60;

        let containers = container_stats::fetch_latest_stats_with_sparklines(
            &state.database_pool,
            sparkline_points,
        )
        .await
        .map_err(|e| format!("DB query failed: {}", e))?;

        Ok(ContainerStatsData { containers })
    }

    /// Collect system statistics from database and Docker API
    async fn collect_system_stats(&self, state: &AppState) -> Result<SystemStatsData, String> {
        // Get latest stats from DB
        let db_stats = system_stats::fetch_latest_system_stats(&state.database_pool)
            .await
            .map_err(|e| format!("DB query failed: {}", e))?;

        // Get system metadata from Docker API (static/semi-static info)
        let info = state
            .docker_client
            .info()
            .await
            .map_err(|e| format!("Failed to get system info: {}", e))?;

        let version = state
            .docker_client
            .version()
            .await
            .map_err(|e| format!("Failed to get version: {}", e))?;

        Ok(SystemStatsData {
            containers_running: db_stats.containers_running as i64,
            containers_stopped: (db_stats.containers_total - db_stats.containers_running) as i64,
            containers_total: db_stats.containers_total as i64,
            images: db_stats.images_count as i64,
            volumes: db_stats.volumes_count as i64,
            networks: db_stats.networks_count as i64,
            server_version: version.version.unwrap_or_else(|| "unknown".to_string()),
            total_memory: info.mem_total.unwrap_or(0) as i64,
            cpus: info.ncpu.unwrap_or(0) as i64,
        })
    }
}
