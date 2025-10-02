//! Configuration module for application settings
//!
//! This module provides configuration structures for server, database,
//! and logging settings with support for environment variables and config files.

use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::net::{IpAddr, Ipv4Addr};

/// Main configuration structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    pub logging: LoggingConfig,
    pub database: DbConfig,
}

/// Server configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub host: IpAddr,
    pub port: u16,
}

/// Database configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbConfig {
    pub host: IpAddr,
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

/// Provides default configuration values
impl Default for Config {
    fn default() -> Self {
        Self {
            server: ServerConfig {
                host: IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)),
                port: 3010,
            },
            logging: LoggingConfig {
                level: "info".to_string(),
                format: "simple".to_string(),
            },
            database: DbConfig {
                host: IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)),
                port: 5432,
                database_name: "docker_manager".to_string(),
                username: "lucas".to_string(),
                password: "test_db_password".to_string(),
            },
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
        Ok(settings.try_deserialize()?)
    }

    /// Returns the server socket address
    pub fn server_addr(&self) -> SocketAddr {
        SocketAddr::new(self.server.host, self.server.port)
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
