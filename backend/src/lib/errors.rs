use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::Serialize;
use thiserror::Error;

/// Main application error type
#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Docker error: {0}")]
    Docker(#[from] bollard::errors::Error),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

/// Error response structure for API responses
#[derive(Serialize)]
pub struct ErrorResponse {
    pub error: String,
    pub code: u16,
}

/// Convert AppError to HTTP responses for Axum
impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            AppError::Database(ref e) => {
                log::error!("Database error: {}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, self.to_string())
            }
            AppError::Docker(ref e) => {
                log::error!("Docker error: {}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, self.to_string())
            }
            AppError::Config(ref e) => {
                log::error!("Configuration error: {}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, self.to_string())
            }
            AppError::Io(ref e) => {
                log::error!("IO error: {}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, self.to_string())
            }
        };

        let body = Json(ErrorResponse {
            error: error_message,
            code: status.as_u16(),
        });

        (status, body).into_response()
    }
}
