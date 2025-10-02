//! Application state module
//!
//! This module defines the shared application state that is passed
//! to all request handlers.

use crate::api::websocket::broadcaster::Broadcaster;
use crate::lib::{config::Config, errors::AppError};
use bollard::Docker;
use chrono::{DateTime, Utc};
use log::{error, info};
use std::sync::Arc;

/// Shared application state
#[derive(Clone)]
pub struct AppState {
    pub docker_client: Docker,
    pub database_pool: sqlx::PgPool,
    pub startup_time: DateTime<Utc>,
    pub config: Config,
    pub broadcaster: Arc<Broadcaster>,
}

impl AppState {
    /// Creates a new AppState instance with initialized connections
    pub async fn new() -> Result<Self, AppError> {
        let config = Config::load().map_err(|e| AppError::Config(e.to_string()))?;

        info!("Connecting to Docker...");
        let docker_client =
            Docker::connect_with_local_defaults().map_err(|e| AppError::Docker(e))?;

        let database_url = format!(
            "postgres://{}:{}@{}:{}/{}",
            config.database.username,
            config.database.password,
            config.database.host,
            config.database.port,
            config.database.database_name
        );

        info!(
            "Connecting to database at {}:{}...",
            config.database.host, config.database.port
        );
        let database_pool = sqlx::PgPool::connect(&database_url).await.map_err(|e| {
            error!("Failed to connect to database: {}", e);
            AppError::Database(e)
        })?;

        let startup_time = Utc::now();

        // Initialize broadcaster
        let broadcaster = Arc::new(Broadcaster::new());

        let state = Arc::new(Self {
            docker_client,
            database_pool,
            startup_time,
            config,
            broadcaster: broadcaster.clone(),
        });

        // Start background tasks for broadcasting stats
        Broadcaster::start_container_stats_task(Arc::clone(&broadcaster), state.clone());
        Broadcaster::start_system_stats_task(Arc::clone(&broadcaster), state.clone());

        Ok(Arc::try_unwrap(state).unwrap_or_else(|arc| (*arc).clone()))
    }
}
