//! WebSocket module for real-time container and system statistics
//!
//! Provides WebSocket endpoint for streaming Docker container stats
//! and system information to connected clients.

pub mod broadcaster;
pub mod handlers;
pub mod messages;

use crate::api::RouteSpec;
use axum::{Router, routing::get};
use broadcaster::Broadcaster;
use handlers::ws_handler;
use std::sync::Arc;

/// Creates the WebSocket router
pub fn router() -> (Router<Arc<Broadcaster>>, Vec<RouteSpec>) {
    let r = Router::new().route("/ws", get(ws_handler));

    let docs = vec![RouteSpec {
        method: "GET",
        path: "/ws".to_string(),
    }];

    (r, docs)
}
