use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};

/// Response structure for image pull operations
#[derive(Serialize, ToSchema)]
pub struct PullImageResponse {
    pub success: bool,
}

/// Query parameters for pulling Docker images
#[derive(Debug, Deserialize, ToSchema, IntoParams)]
pub struct ImagePullQueryParams {
    pub tag: Option<String>,
}
