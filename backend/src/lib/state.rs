//! Application state module
//!
//! This module defines the shared application state that is passed
//! to all request handlers.

use crate::api::websocket::broadcaster::Broadcaster;
use crate::lib::{config::Config, errors::AppError};
use bollard::Docker;
use chrono::{DateTime, Utc};
use log::{error, info, warn};
use std::sync::Arc;
use std::time::Duration;

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

        // Retry database connection with exponential backoff to handle DNS resolution delays
        let max_retries = 5;
        let mut retry_count = 0;
        let database_pool = loop {
            match sqlx::PgPool::connect(&database_url).await {
                Ok(pool) => break pool,
                Err(e) => {
                    retry_count += 1;
                    if retry_count >= max_retries {
                        error!("Failed to connect to database after {} retries: {}", max_retries, e);
                        return Err(AppError::Database(e));
                    }
                    let wait_time = Duration::from_secs(2u64.pow(retry_count));
                    warn!(
                        "Failed to connect to database (attempt {}/{}): {}. Retrying in {:?}...",
                        retry_count, max_retries, e, wait_time
                    );
                    tokio::time::sleep(wait_time).await;
                }
            }
        };

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
