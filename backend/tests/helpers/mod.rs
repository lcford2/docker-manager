//! Test helper utilities
//!
//! Provides common test data builders and utilities used across integration tests.

use bollard::models::{ContainerSummary, ImageSummary};
use chrono::Utc;
use jsonwebtoken::{EncodingKey, Header, encode};
use serde::{Deserialize, Serialize};

/// JWT claims structure for test tokens
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub role: String,
    pub exp: usize,
}

/// Generate a JWT token for admin user
pub fn generate_test_token_admin() -> String {
    generate_test_token("admin_test", "Admin")
}

/// Generate a JWT token for operator user
pub fn generate_test_token_operator() -> String {
    generate_test_token("operator_test", "Operator")
}

/// Generate a JWT token for viewer user
pub fn generate_test_token_viewer() -> String {
    generate_test_token("viewer_test", "Viewer")
}

/// Generate a JWT token for a specific user and role
fn generate_test_token(username: &str, role: &str) -> String {
    let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "test_secret_key".to_string());

    let claims = Claims {
        sub: username.to_string(),
        role: role.to_string(),
        exp: (Utc::now() + chrono::Duration::hours(24)).timestamp() as usize,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .expect("Failed to generate test token")
}

/// Create a mock container summary for testing
pub fn mock_container() -> ContainerSummary {
    ContainerSummary {
        id: Some("abc123def456".to_string()),
        names: Some(vec!["/test_container".to_string()]),
        image: Some("nginx:latest".to_string()),
        ..Default::default()
    }
}

/// Create a mock image summary for testing
pub fn mock_image() -> ImageSummary {
    ImageSummary {
        id: "sha256:abc123def456".to_string(),
        repo_tags: vec!["nginx:latest".to_string()],
        ..Default::default()
    }
}

/// Create a mock volume for testing
pub fn mock_volume() -> bollard::models::Volume {
    bollard::models::Volume {
        name: "test_volume".to_string(),
        driver: "local".to_string(),
        mountpoint: "/var/lib/docker/volumes/test_volume/_data".to_string(),
        ..Default::default()
    }
}

/// Create a mock network for testing
pub fn mock_network() -> bollard::models::Network {
    bollard::models::Network {
        name: Some("test_network".to_string()),
        id: Some("net123".to_string()),
        ..Default::default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_admin_token() {
        let token = generate_test_token_admin();
        assert!(!token.is_empty());
    }

    #[test]
    fn test_mock_container() {
        let container = mock_container();
        assert_eq!(container.id.as_ref().unwrap(), "abc123def456");
        assert_eq!(container.names.as_ref().unwrap()[0], "/test_container");
    }

    #[test]
    fn test_mock_image() {
        let image = mock_image();
        assert_eq!(image.id, "sha256:abc123def456");
        assert!(image.repo_tags.contains(&"nginx:latest".to_string()));
    }

    #[test]
    fn test_mock_volume() {
        let volume = mock_volume();
        assert_eq!(volume.name, "test_volume");
        assert_eq!(volume.driver, "local");
    }
}
