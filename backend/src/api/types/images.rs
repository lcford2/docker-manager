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

/// Query parameters for removing an imae
#[derive(Debug, Deserialize, IntoParams, ToSchema)]
pub struct DeleteImageQueryParams {
    pub force: Option<bool>,
    pub noprune: Option<bool>,
}

/// Query parameters for removing images
#[derive(Debug, Deserialize, IntoParams, ToSchema)]
pub struct BulkDeleteImagesQueryParams {
    pub images: Option<Vec<String>>,
    pub force: Option<bool>,
    pub noprune: Option<bool>,
}

impl std::fmt::Display for BulkDeleteImagesQueryParams {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "BulkDeleteImagesQueryParams {{ images: {:?}, force: {:?}, noprune: {:?} }}",
            self.images, self.force, self.noprune
        )
    }
}
