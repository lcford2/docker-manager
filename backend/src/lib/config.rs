//! Configuration module for application settings
//!
//! This module provides configuration structures for server, database,
//! and logging settings with support for environment variables and config files.

use serde::{Deserialize, Serialize};
use std::net::IpAddr;
use std::net::SocketAddr;

/// Main configuration structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    pub logging: LoggingConfig,
    pub database: DbConfig,
    #[serde(default)]
    pub retention: RetentionConfig,
    #[serde(default)]
    pub limits: LimitsConfig,
    #[serde(default)]
    pub workers: WorkersConfig,
    #[serde(default)]
    pub websocket: WebSocketConfig,
    #[serde(default)]
    pub auth: AuthConfig,
    #[serde(default)]
    pub ui: UIConfig,
}

/// Server configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
}

/// Database configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbConfig {
    pub host: String,
    pub port: u16,
    pub database_name: String,
    pub username: String,
    pub password: String,
}

/// Logging configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggingConfig {
    pub level: String,
    pub format: String,
}

/// Database retention configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetentionConfig {
    pub stats_retention_hours: i32,
}

impl Default for RetentionConfig {
    fn default() -> Self {
        Self {
            stats_retention_hours: 24,
        }
    }
}

/// Database query limits configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LimitsConfig {
    pub default_query_limit: i64,
    pub max_query_limit: i64,
    pub default_history_minutes: i64,
}

impl Default for LimitsConfig {
    fn default() -> Self {
        Self {
            default_query_limit: 100,
            max_query_limit: 500,
            default_history_minutes: 30,
        }
    }
}

impl LimitsConfig {
    /// Calculate sparkline points based on history window and collection interval
    pub fn sparkline_points(&self, collection_interval: u64) -> usize {
        let total_seconds = self.default_history_minutes * 60;
        (total_seconds as usize / collection_interval as usize).max(10)
    }

    /// Convenience accessor for container stats default (uses default_query_limit)
    pub fn container_stats_default(&self) -> i64 {
        self.default_query_limit
    }

    /// Convenience accessor for system stats default (uses default_query_limit)
    pub fn system_stats_default(&self) -> i64 {
        self.default_query_limit
    }
}

/// Background workers configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkersConfig {
    pub container_stats_interval: u64, // seconds
    pub system_info_interval: u64,     // seconds
}

impl Default for WorkersConfig {
    fn default() -> Self {
        Self {
            container_stats_interval: 30,
            system_info_interval: 15,
        }
    }
}

/// Helper function for serde default - max tail lines
fn default_max_tail_lines() -> usize {
    5000
}

/// Helper function for serde default - streaming buffer interval
fn default_streaming_buffer_ms() -> u64 {
    100
}

/// Helper function for serde default - streaming max batch size
fn default_streaming_max_batch() -> usize {
    100
}

/// Helper function for serde default - initial timeout
fn default_initial_timeout_ms() -> u64 {
    200
}

/// WebSocket configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebSocketConfig {
    pub broadcast_interval: u64, // seconds
    pub ping_interval: u64,      // milliseconds
    pub stale_timeout: u64,      // milliseconds
    pub max_reconnect_attempts: u32,

    // Log streaming configuration
    #[serde(default = "default_max_tail_lines")]
    pub max_tail_lines: usize,
    #[serde(default = "default_streaming_buffer_ms")]
    pub streaming_buffer_ms: u64,
    #[serde(default = "default_streaming_max_batch")]
    pub streaming_max_batch: usize,
    #[serde(default = "default_initial_timeout_ms")]
    pub initial_timeout_ms: u64,
}

impl Default for WebSocketConfig {
    fn default() -> Self {
        Self {
            broadcast_interval: 3,
            ping_interval: 30000,
            stale_timeout: 60000,
            max_reconnect_attempts: 10,
            max_tail_lines: default_max_tail_lines(),
            streaming_buffer_ms: default_streaming_buffer_ms(),
            streaming_max_batch: default_streaming_max_batch(),
            initial_timeout_ms: default_initial_timeout_ms(),
        }
    }
}

impl WebSocketConfig {
    /// Container broadcast interval (same as base broadcast_interval)
    pub fn container_broadcast_interval(&self) -> u64 {
        self.broadcast_interval
    }

    /// System broadcast interval (1.5x the base broadcast_interval)
    pub fn system_broadcast_interval(&self) -> u64 {
        ((self.broadcast_interval as f64) * 1.5).round() as u64
    }

    /// Stale connection check interval (same as stale_timeout)
    #[allow(dead_code)]
    pub fn stale_check_interval(&self) -> u64 {
        self.stale_timeout
    }

    /// Reconnection base delay (sensible default)
    #[allow(dead_code)]
    pub fn reconnect_base_delay(&self) -> u64 {
        2000 // 2 seconds
    }

    /// Reconnection maximum delay (sensible default)
    #[allow(dead_code)]
    pub fn reconnect_max_delay(&self) -> u64 {
        120000 // 120 seconds
    }

    /// Reconnection jitter (sensible default)
    #[allow(dead_code)]
    pub fn reconnect_jitter(&self) -> u64 {
        1000 // 1 second
    }

    /// Status update interval for UI (sensible default)
    #[allow(dead_code)]
    pub fn status_update_interval(&self) -> u64 {
        1000 // 1 second
    }
}

/// Authentication configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthConfig {
    pub jwt_expiration_hours: i64,
}

impl Default for AuthConfig {
    fn default() -> Self {
        Self {
            jwt_expiration_hours: 24,
        }
    }
}

/// UI configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UIConfig {
    pub max_chart_data_points: usize,
}

impl Default for UIConfig {
    fn default() -> Self {
        Self {
            max_chart_data_points: 60,
        }
    }
}

impl UIConfig {
    /// Drawer width (hardcoded, rarely needs changing)
    #[allow(dead_code)]
    pub fn drawer_width(&self) -> u32 {
        240
    }
}

/// Provides default configuration values
impl Default for Config {
    fn default() -> Self {
        Self {
            server: ServerConfig {
                host: "127.0.0.1".to_string(),
                port: 3010,
            },
            logging: LoggingConfig {
                level: "info".to_string(),
                format: "simple".to_string(),
            },
            database: DbConfig {
                host: "127.0.0.1".to_string(),
                port: 5432,
                database_name: "docker_manager".to_string(),
                username: "lucas".to_string(),
                password: "test_db_password".to_string(),
            },
            retention: RetentionConfig::default(),
            limits: LimitsConfig::default(),
            workers: WorkersConfig::default(),
            websocket: WebSocketConfig::default(),
            auth: AuthConfig::default(),
            ui: UIConfig::default(),
        }
    }
}

impl Config {
    /// Loads configuration from defaults, config files, and environment variables
    pub fn load() -> Result<Self, Box<dyn std::error::Error>> {
        let settings = config::Config::builder()
            .add_source(config::Config::try_from(&Config::default())?)
            .add_source(config::File::with_name("config/default").required(false))
            .add_source(
                config::File::with_name(&format!(
                    "config/{}",
                    std::env::var("RUST_ENV").unwrap_or_else(|_| String::from("development"))
                ))
                .required(false),
            )
            .add_source(
                config::Environment::with_prefix("APP")
                    .separator("_")
                    .try_parsing(true),
            )
            .build()?;
        let mut config: Config = settings.try_deserialize()?;

        // Load secrets from environment variables
        if let Ok(db_password) = std::env::var("DB_PASSWORD") {
            config.database.password = db_password;
        }

        // Validate configuration
        config.validate()?;

        Ok(config)
    }

    /// Validates configuration values
    pub fn validate(&self) -> Result<(), String> {
        // Validate intervals
        if self.workers.container_stats_interval == 0 {
            return Err("workers.container_stats_interval must be > 0".to_string());
        }
        if self.workers.system_info_interval == 0 {
            return Err("workers.system_info_interval must be > 0".to_string());
        }

        // Validate ports
        if self.server.port == 0 {
            return Err("server.port must be > 0".to_string());
        }
        if self.database.port == 0 {
            return Err("database.port must be > 0".to_string());
        }

        // Validate JWT expiration
        if self.auth.jwt_expiration_hours == 0 {
            return Err("auth.jwt_expiration_hours must be > 0".to_string());
        }

        // Validate retention
        if self.retention.stats_retention_hours < 1 {
            return Err("retention.stats_retention_hours must be >= 1".to_string());
        }

        // Validate limits
        if self.limits.max_query_limit < 1 {
            return Err("limits.max_query_limit must be >= 1".to_string());
        }
        if self.limits.default_query_limit < 1 {
            return Err("limits.default_query_limit must be >= 1".to_string());
        }
        if self.limits.default_history_minutes < 1 {
            return Err("limits.default_history_minutes must be >= 1".to_string());
        }

        // Validate log streaming configuration
        if self.websocket.max_tail_lines == 0 {
            return Err("websocket.max_tail_lines must be > 0".to_string());
        }
        if self.websocket.max_tail_lines > 100_000 {
            return Err("websocket.max_tail_lines must be <= 100,000 (memory safety)".to_string());
        }
        if self.websocket.streaming_buffer_ms == 0 {
            return Err("websocket.streaming_buffer_ms must be > 0".to_string());
        }
        if self.websocket.streaming_buffer_ms > 10_000 {
            return Err(
                "websocket.streaming_buffer_ms must be <= 10,000 (max 10s latency)".to_string(),
            );
        }
        if self.websocket.streaming_max_batch == 0 {
            return Err("websocket.streaming_max_batch must be > 0".to_string());
        }
        if self.websocket.streaming_max_batch > 10_000 {
            return Err(
                "websocket.streaming_max_batch must be <= 10,000 (message size safety)".to_string(),
            );
        }
        if self.websocket.initial_timeout_ms == 0 {
            return Err("websocket.initial_timeout_ms must be > 0".to_string());
        }
        if self.websocket.initial_timeout_ms > 30_000 {
            return Err("websocket.initial_timeout_ms must be <= 30,000 (max 30s)".to_string());
        }

        Ok(())
    }

    /// Returns the server socket address
    pub fn server_addr(&self) -> Result<SocketAddr, String> {
        let ip: IpAddr = self
            .server
            .host
            .parse()
            .map_err(|_| format!("Invalid IP address: {}", self.server.host))?;
        Ok(SocketAddr::new(ip, self.server.port))
    }

    /// Converts the log level string to a log::Level
    pub fn log_level(&self) -> log::Level {
        match self.logging.level.as_str() {
            "trace" => log::Level::Trace,
            "debug" => log::Level::Debug,
            "info" => log::Level::Info,
            "warn" => log::Level::Warn,
            "error" => log::Level::Error,
            _ => log::Level::Info,
        }
    }
}
