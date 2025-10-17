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
    pub cache: CacheConfig,
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

/// WebSocket configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebSocketConfig {
    pub broadcast_interval: u64, // seconds
    pub ping_interval: u64,      // milliseconds
    pub stale_timeout: u64,      // milliseconds
    pub max_reconnect_attempts: u32,
}

impl Default for WebSocketConfig {
    fn default() -> Self {
        Self {
            broadcast_interval: 3,
            ping_interval: 30000,
            stale_timeout: 60000,
            max_reconnect_attempts: 10,
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
    pub fn stale_check_interval(&self) -> u64 {
        self.stale_timeout
    }

    /// Reconnection base delay (sensible default)
    pub fn reconnect_base_delay(&self) -> u64 {
        2000 // 2 seconds
    }

    /// Reconnection maximum delay (sensible default)
    pub fn reconnect_max_delay(&self) -> u64 {
        120000 // 120 seconds
    }

    /// Reconnection jitter (sensible default)
    pub fn reconnect_jitter(&self) -> u64 {
        1000 // 1 second
    }

    /// Status update interval for UI (sensible default)
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

/// Cache configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheConfig {
    pub default_ttl: u64,       // milliseconds - for fast-changing resources
    pub slow_resource_ttl: u64, // milliseconds - for slow-changing resources
    pub retry_attempts: u32,    // retry count for failed API calls
}

impl Default for CacheConfig {
    fn default() -> Self {
        Self {
            default_ttl: 5000,
            slow_resource_ttl: 20000,
            retry_attempts: 3,
        }
    }
}

impl CacheConfig {
    /// Cache TTL for containers (fast-changing)
    pub fn containers_ttl(&self) -> u64 {
        self.default_ttl
    }

    /// Cache TTL for system info (fast-changing)
    pub fn system_info_ttl(&self) -> u64 {
        self.default_ttl
    }

    /// Cache TTL for metrics (fast-changing)
    pub fn metrics_ttl(&self) -> u64 {
        self.default_ttl
    }

    /// Cache TTL for networks (fast-changing)
    pub fn networks_ttl(&self) -> u64 {
        self.default_ttl
    }

    /// Cache TTL for volumes (slow-changing)
    pub fn volumes_ttl(&self) -> u64 {
        self.slow_resource_ttl
    }

    /// Cache TTL for images (slow-changing)
    pub fn images_ttl(&self) -> u64 {
        self.slow_resource_ttl
    }

    /// Cache cleanup interval (6x default_ttl)
    pub fn cleanup_interval(&self) -> u64 {
        self.default_ttl * 6
    }

    /// Retry attempts for all resources
    pub fn retry_containers(&self) -> u32 {
        self.retry_attempts
    }

    pub fn retry_system_info(&self) -> u32 {
        self.retry_attempts
    }

    pub fn retry_metrics(&self) -> u32 {
        self.retry_attempts
    }

    pub fn retry_volumes(&self) -> u32 {
        self.retry_attempts
    }

    pub fn retry_images(&self) -> u32 {
        self.retry_attempts
    }

    pub fn retry_networks(&self) -> u32 {
        self.retry_attempts
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
            cache: CacheConfig::default(),
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
