use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};
///
/// Query parameters for removing volume
#[derive(Debug, Serialize, Deserialize, IntoParams, ToSchema)]
pub struct DeleteVolumeQueryParams {
    pub force: Option<bool>,
}

/// Query parameters for removing volumes
#[derive(Debug, Serialize, Deserialize, IntoParams, ToSchema)]
pub struct BulkDeleteVolumesQueryParams {
    pub volumes: Option<Vec<String>>,
    pub force: Option<bool>,
}
