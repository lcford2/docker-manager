use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};

/// Query parameters for removing networks
#[derive(Debug, Serialize, Deserialize, IntoParams, ToSchema)]
pub struct BulkDeleteVolumesQueryParams {
    pub volumes: Option<Vec<String>>,
    pub force: Option<bool>,
}
