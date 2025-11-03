//! Docker Manager API Server
//!
//! A REST API for managing Docker resources and collecting statistics.
//! Provides endpoints for containers, images, networks, volumes, and
//! historical performance data.

use crate::lib::auth;
use axum::Router;
use axum_login::{
    AuthManagerLayerBuilder,
    tower_sessions::{MemoryStore, SessionManagerLayer},
};
use log::info;
use std::net::SocketAddr;
use std::sync::Arc;

mod api;
mod lib {
    pub mod auth;
    pub mod config;
    pub mod docker;
    pub mod docker_trait;
    pub mod errors;
    pub mod macros;
    pub mod state;
    pub mod stats_workers;
}

/// Adds a prefix to all route paths
fn with_prefix(prefix: &str, routes: Vec<api::RouteSpec>) -> Vec<api::RouteSpec> {
    let p = prefix.trim_end_matches("/");
    routes
        .into_iter()
        .map(|r| api::RouteSpec {
            method: r.method,
            path: format!("{}/{}", p, r.path.trim_start_matches('/')),
        })
        .collect()
}

/// Application entry point
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Load .env file if it exists (for development)
    // In production, environment variables are set by docker-compose
    dotenvy::dotenv().ok();

    // Initialize logger early, but handle errors gracefully
    simple_logger::init_with_level(log::Level::Info)
        .map_err(|e| format!("Failed to initialize logger: {}", e))?;

    // Initialize application state
    let app_state = match lib::state::AppState::new().await {
        Ok(state) => {
            info!("Application state initialized successfully");
            Arc::new(state)
        }
        Err(e) => {
            eprintln!("Failed to initialize application state: {}", e);
            return Err(e.into());
        }
    };

    // Update logger level from config
    log::set_max_level(app_state.config.log_level().to_level_filter());

    // setup auth session
    let session_store = MemoryStore::default();
    let session_layer = SessionManagerLayer::new(session_store);

    let backend = auth::Backend {
        db_pool: app_state.database_pool.clone(),
    };
    let auth_layer = AuthManagerLayerBuilder::new(backend, session_layer).build();

    // Try to get Docker version, but don't crash if it fails
    match app_state.docker_client.version().await {
        Ok(version) => {
            info!(
                "Docker API version: {:?}",
                version.api_version.unwrap_or_else(|| "unknown".to_string())
            );
        }
        Err(e) => {
            log::warn!(
                "Could not connect to Docker daemon: {}. Container operations may be unavailable.",
                e
            );
        }
    }

    let stats_worker_handle = tokio::spawn(lib::stats_workers::container_stats_worker(
        app_state.clone(),
    ));
    let system_info_worker_handle =
        tokio::spawn(lib::stats_workers::system_info_worker(app_state.clone()));

    // setup router
    let (api_router, api_routes) = api::router(app_state.clone());
    let app = Router::new()
        .nest("/api", api_router)
        .with_state(app_state.clone())
        .layer(auth_layer);

    // print routes
    let routes = with_prefix("/api", api_routes);
    info!("Registered endpoints:");
    for r in &routes {
        info!("  {:6} {}", r.method, r.path);
    }

    // serve
    let addr: SocketAddr = app_state
        .config
        .server_addr()
        .map_err(|e| format!("Failed to parse server address: {}", e))?;
    info!("Listening on http://{addr}");

    let listener = tokio::net::TcpListener::bind(addr).await.map_err(|e| {
        format!(
            "Failed to bind to {}: {}. Is the port already in use?",
            addr, e
        )
    })?;

    axum::serve(listener, app)
        .await
        .map_err(|e| format!("Server error: {}", e))?;

    stats_worker_handle.abort();
    system_info_worker_handle.abort();

    Ok(())
}
