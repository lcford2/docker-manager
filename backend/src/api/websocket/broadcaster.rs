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

/// Active log stream handle
pub struct ActiveLogStream {
    pub container_id: String,
    pub cancel_tx: tokio::sync::oneshot::Sender<()>,
}

/// Broadcaster manages all active WebSocket connections
#[derive(Clone)]
pub struct Broadcaster {
    clients: Arc<RwLock<HashMap<ClientId, mpsc::UnboundedSender<Message>>>>,
    next_client_id: Arc<RwLock<ClientId>>,
    active_log_streams: Arc<RwLock<HashMap<ClientId, ActiveLogStream>>>,
}

impl Broadcaster {
    /// Create a new broadcaster
    pub fn new() -> Self {
        Self {
            clients: Arc::new(RwLock::new(HashMap::new())),
            next_client_id: Arc::new(RwLock::new(0)),
            active_log_streams: Arc::new(RwLock::new(HashMap::new())),
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

        // Cancel any active log stream for this client
        if let Some(stream) = self.active_log_streams.write().await.remove(&client_id) {
            let _ = stream.cancel_tx.send(());
            info!("Cancelled log stream for client {}", client_id);
        }

        info!("WebSocket client {} disconnected", client_id);
    }

    /// Send a message to a specific client
    pub async fn send_to_client(&self, client_id: ClientId, message: WebSocketMessage) {
        if let Some(tx) = self.clients.read().await.get(&client_id)
            && let Ok(json) = serde_json::to_string(&message)
        {
            let _ = tx.send(Message::Text(json.into()));
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
            let mut interval = interval(Duration::from_secs(
                state.config.websocket.container_broadcast_interval(),
            ));

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
            let mut interval = interval(Duration::from_secs(
                state.config.websocket.system_broadcast_interval(),
            ));

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
        let sparkline_points = state
            .config
            .limits
            .sparkline_points(state.config.workers.container_stats_interval)
            as i64;

        let containers = container_stats::fetch_latest_stats_with_sparklines(
            &state.database_pool,
            sparkline_points,
            &state.docker_client,
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

    /// Start streaming container logs for a client
    pub async fn start_log_stream(
        &self,
        client_id: ClientId,
        request: ContainerLogsRequestData,
        state: Arc<AppState>,
    ) -> Result<(), String> {
        // Cancel any existing log stream for this client
        if let Some(old_stream) = self.active_log_streams.write().await.remove(&client_id) {
            let _ = old_stream.cancel_tx.send(());
            info!(
                "Cancelled existing log stream for client {} (container: {})",
                client_id, old_stream.container_id
            );
        }

        // Create cancellation channel
        let (cancel_tx, cancel_rx) = tokio::sync::oneshot::channel();

        // Store the stream handle
        self.active_log_streams.write().await.insert(
            client_id,
            ActiveLogStream {
                container_id: request.container_id.clone(),
                cancel_tx,
            },
        );

        // Spawn the log streaming task
        let broadcaster = self.clone();
        tokio::spawn(async move {
            if let Err(e) =
                Self::stream_logs(broadcaster, client_id, request, state, cancel_rx).await
            {
                error!("Log streaming error for client {}: {}", client_id, e);
            }
        });

        Ok(())
    }

    /// Stream container logs to a client
    async fn stream_logs(
        broadcaster: Broadcaster,
        client_id: ClientId,
        request: ContainerLogsRequestData,
        state: Arc<AppState>,
        mut cancel_rx: tokio::sync::oneshot::Receiver<()>,
    ) -> Result<(), String> {
        use bollard::container::LogOutput;
        use bollard::query_parameters::LogsOptionsBuilder;
        use futures_util::StreamExt;

        const MAX_TAIL_LINES: usize = 5000;
        const STREAMING_BUFFER_MS: u64 = 100;
        const STREAMING_MAX_BATCH: usize = 100;

        info!(
            "Starting log stream for client {} (container: {}, tail: {}, follow: {})",
            client_id, request.container_id, request.tail, request.follow
        );

        // Enforce max tail limit
        let tail = request.tail.min(MAX_TAIL_LINES);

        // Build log options using builder pattern
        let tail_str = tail.to_string();
        let options = Some(
            LogsOptionsBuilder::default()
                .stdout(request.stdout)
                .stderr(request.stderr)
                .follow(request.follow)
                .timestamps(request.timestamps)
                .tail(&tail_str)
                .build(),
        );

        // Get logs stream
        let mut logs_stream = state.docker_client.logs(&request.container_id, options);

        // Collect initial logs
        let mut initial_lines = Vec::new();
        let mut is_initial = true;
        let mut initial_sent = false;

        // Buffer for batching streaming updates
        let mut buffer = Vec::new();
        let mut interval = tokio::time::interval(Duration::from_millis(STREAMING_BUFFER_MS));

        // Timeout for detecting when initial logs have been fully loaded
        // If no logs arrive for this duration, we assume we've got all historical logs
        let mut initial_timeout = Box::pin(tokio::time::sleep(Duration::from_millis(200)));

        loop {
            tokio::select! {
                // Check for cancellation
                _ = &mut cancel_rx => {
                    info!("Log stream cancelled for client {}", client_id);
                    break;
                }

                // Initial logs timeout - send what we have and switch to streaming
                _ = &mut initial_timeout, if is_initial && request.follow && !initial_sent => {
                    broadcaster.send_to_client(
                        client_id,
                        WebSocketMessage::ContainerLogs(ContainerLogsData {
                            container_id: request.container_id.clone(),
                            lines: std::mem::take(&mut initial_lines),
                            is_initial: true,
                        }),
                    ).await;
                    initial_sent = true;
                    is_initial = false;
                }

                // Buffer flush interval (only during follow mode after initial)
                _ = interval.tick(), if !is_initial && request.follow && !buffer.is_empty() => {
                    broadcaster.send_to_client(
                        client_id,
                        WebSocketMessage::ContainerLogs(ContainerLogsData {
                            container_id: request.container_id.clone(),
                            lines: std::mem::take(&mut buffer),
                            is_initial: false,
                        }),
                    ).await;
                }

                // Read from log stream
                log_result = logs_stream.next() => {
                    match log_result {
                        Some(Ok(log_output)) => {
                            let (line, stream) = match log_output {
                                LogOutput::StdOut { message } => {
                                    (String::from_utf8_lossy(&message).to_string(), "stdout".to_string())
                                }
                                LogOutput::StdErr { message } => {
                                    (String::from_utf8_lossy(&message).to_string(), "stderr".to_string())
                                }
                                _ => continue,
                            };

                            // Parse timestamp if present
                            let (timestamp, clean_line) = if request.timestamps && line.len() > 30 {
                                // Docker timestamp format: 2024-01-01T12:00:00.000000000Z
                                if let Some(space_idx) = line.find(' ') {
                                    let ts = line[..space_idx].to_string();
                                    let rest = line[space_idx + 1..].to_string();
                                    (Some(ts), rest)
                                } else {
                                    (None, line)
                                }
                            } else {
                                (None, line)
                            };

                            let log_line = LogLine {
                                line: clean_line,
                                stream,
                                timestamp,
                            };

                            if is_initial {
                                initial_lines.push(log_line);

                                // For follow mode, if we have enough lines or a timeout, send them
                                // For non-follow mode, keep collecting until stream ends
                                if request.follow {
                                    // Reset the initial timeout since we're still receiving historical logs
                                    initial_timeout = Box::pin(tokio::time::sleep(Duration::from_millis(200)));

                                    // If we've collected a reasonable batch, send it early
                                    if initial_lines.len() >= tail.min(1000) && !initial_sent {
                                        broadcaster.send_to_client(
                                            client_id,
                                            WebSocketMessage::ContainerLogs(ContainerLogsData {
                                                container_id: request.container_id.clone(),
                                                lines: std::mem::take(&mut initial_lines),
                                                is_initial: true,
                                            }),
                                        ).await;
                                        initial_sent = true;
                                        is_initial = false;
                                    }
                                }
                            } else {
                                buffer.push(log_line);

                                // Send immediately if buffer is full
                                if buffer.len() >= STREAMING_MAX_BATCH {
                                    broadcaster.send_to_client(
                                        client_id,
                                        WebSocketMessage::ContainerLogs(ContainerLogsData {
                                            container_id: request.container_id.clone(),
                                            lines: std::mem::take(&mut buffer),
                                            is_initial: false,
                                        }),
                                    ).await;
                                }
                            }
                        }
                        Some(Err(e)) => {
                            error!("Error reading logs for client {}: {}", client_id, e);
                            broadcaster.send_to_client(
                                client_id,
                                WebSocketMessage::ContainerLogsError(ContainerLogsErrorData {
                                    container_id: request.container_id.clone(),
                                    error: format!("Error reading logs: {}", e),
                                }),
                            ).await;
                            break;
                        }
                        None => {
                            // Stream ended
                            if is_initial && !initial_sent {
                                // Send initial batch (even if empty) - only for non-follow mode
                                // In follow mode, the timeout will handle this
                                broadcaster.send_to_client(
                                    client_id,
                                    WebSocketMessage::ContainerLogs(ContainerLogsData {
                                        container_id: request.container_id.clone(),
                                        lines: std::mem::take(&mut initial_lines),
                                        is_initial: true,
                                    }),
                                ).await;
                                initial_sent = true;

                                if !request.follow {
                                    // Not following, we're done
                                    break;
                                }

                                // In follow mode, if we got None, the container might have stopped
                                is_initial = false;
                            } else {
                                // Following stream ended (container stopped?)
                                if !buffer.is_empty() {
                                    broadcaster.send_to_client(
                                        client_id,
                                        WebSocketMessage::ContainerLogs(ContainerLogsData {
                                            container_id: request.container_id.clone(),
                                            lines: std::mem::take(&mut buffer),
                                            is_initial: false,
                                        }),
                                    ).await;
                                }
                                break;
                            }
                        }
                    }
                }
            }
        }

        // Send end message
        broadcaster
            .send_to_client(
                client_id,
                WebSocketMessage::ContainerLogsEnd(ContainerLogsEndData {
                    container_id: request.container_id.clone(),
                }),
            )
            .await;

        // Clean up
        broadcaster
            .active_log_streams
            .write()
            .await
            .remove(&client_id);

        info!("Log stream ended for client {}", client_id);

        Ok(())
    }
}
