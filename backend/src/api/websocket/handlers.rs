//! WebSocket connection handlers
//!
//! Handles WebSocket upgrade requests, authentication, and message routing.

use super::broadcaster::Broadcaster;
use super::messages::*;
use crate::lib::auth;
use crate::lib::state::AppState;
use axum::{
    extract::{
        Query, State,
        ws::{WebSocket, WebSocketUpgrade},
    },
    http::StatusCode,
    response::IntoResponse,
};
use futures_util::{sink::SinkExt, stream::StreamExt};
use log::{error, info, warn};
use serde::Deserialize;
use std::sync::Arc;

/// Query parameters for WebSocket connection
#[derive(Debug, Deserialize)]
pub struct WebSocketQuery {
    pub token: String,
}

/// WebSocket connection handler
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Query(query): Query<WebSocketQuery>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    // Verify JWT token
    let username = match auth::verify_jwt_token(&query.token) {
        Ok(token_data) => token_data.claims.sub,
        Err(_) => {
            return (StatusCode::UNAUTHORIZED, "Invalid token").into_response();
        }
    };

    // Upgrade the connection
    ws.on_upgrade(move |socket| handle_socket(socket, username, state))
        .into_response()
}

/// Handle individual WebSocket connection
async fn handle_socket(socket: WebSocket, username: String, state: Arc<AppState>) {
    let (mut sender, mut receiver) = socket.split();

    let broadcaster = state.broadcaster.clone();

    // Subscribe to broadcaster
    let (client_id, mut rx) = broadcaster.subscribe().await;

    info!(
        "WebSocket connection established for user '{}' (client {})",
        username, client_id
    );

    // Send connection confirmation
    let connection_msg = WebSocketMessage::Connection(ConnectionData {
        status: "connected".to_string(),
        user: username.clone(),
    });

    if let Ok(json) = serde_json::to_string(&connection_msg)
        && let Err(e) = sender
            .send(axum::extract::ws::Message::Text(json.into()))
            .await
    {
        error!("Failed to send connection message: {}", e);
        broadcaster.unsubscribe(client_id).await;
        return;
    }

    // Spawn task to forward messages from broadcaster to client
    let mut send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sender.send(msg).await.is_err() {
                break;
            }
        }
    });

    // Spawn task to handle messages from client
    let broadcaster_clone = broadcaster.clone();
    let state_clone = state.clone();
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            if let Err(e) =
                handle_client_message(msg, client_id, &broadcaster_clone, &state_clone).await
            {
                warn!("Error handling client message: {}", e);
            }
        }
    });

    // Wait for either task to finish (disconnect)
    tokio::select! {
        _ = (&mut send_task) => {
            recv_task.abort();
        }
        _ = (&mut recv_task) => {
            send_task.abort();
        }
    }

    // Cleanup
    broadcaster.unsubscribe(client_id).await;
    info!(
        "WebSocket connection closed for user '{}' (client {})",
        username, client_id
    );
}

/// Handle messages from client
async fn handle_client_message(
    msg: axum::extract::ws::Message,
    client_id: usize,
    broadcaster: &Broadcaster,
    state: &Arc<AppState>,
) -> Result<(), String> {
    match msg {
        axum::extract::ws::Message::Text(text) => {
            // Parse the message
            let ws_msg: WebSocketMessage = serde_json::from_str(&text)
                .map_err(|e| format!("Failed to parse message: {}", e))?;

            match ws_msg {
                WebSocketMessage::Ping(_) => {
                    // Respond with pong
                    let pong_msg = WebSocketMessage::Pong(PongData {});
                    broadcaster.send_to_client(client_id, pong_msg).await;
                }
                WebSocketMessage::ContainerLogsRequest(request) => {
                    // Start streaming logs
                    info!(
                        "Client {} requested logs for container {}",
                        client_id, request.container_id
                    );
                    if let Err(e) = broadcaster
                        .start_log_stream(client_id, request.clone(), state.clone())
                        .await
                    {
                        error!("Failed to start log stream: {}", e);
                        broadcaster
                            .send_to_client(
                                client_id,
                                WebSocketMessage::ContainerLogsError(ContainerLogsErrorData {
                                    container_id: request.container_id,
                                    error: e,
                                }),
                            )
                            .await;
                    }
                }
                _ => {
                    // Ignore other message types from client for now
                    info!("Received message from client {}: {:?}", client_id, ws_msg);
                }
            }
        }
        axum::extract::ws::Message::Close(_) => {
            info!("Client {} requested close", client_id);
        }
        axum::extract::ws::Message::Pong(_) => {
            // Handle pong if needed
        }
        _ => {
            // Ignore other message types
        }
    }

    Ok(())
}
