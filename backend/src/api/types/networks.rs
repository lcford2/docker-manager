use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};

/// Query parameters for removing networks
#[derive(Debug, Serialize, Deserialize, IntoParams, ToSchema)]
pub struct BulkDeleteNetworksQueryParams {
    pub networks: Option<Vec<String>>,
}
