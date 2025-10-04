use bollard::secret as bollard_types;
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};

#[derive(Debug, Serialize, ToSchema)]
pub struct ContainerSummary {
    pub id: String,
    pub name: String,
    pub image: String,
    pub image_id: String,
    pub command: String,
    pub created: i64,
    pub size_rw: i64,
    pub size_root_fs: i64,
    pub status: String,
    pub state: String,
}

impl From<bollard_types::ContainerSummary> for ContainerSummary {
    fn from(summary: bollard_types::ContainerSummary) -> Self {
        ContainerSummary {
            id: summary.id.unwrap_or_default(),
            name: summary
                .names
                .unwrap_or_default()
                .first()
                .unwrap_or(&"".to_string())
                .clone(),
            image: summary.image.unwrap_or_default(),
            image_id: summary.image_id.unwrap_or_default(),
            command: summary.command.unwrap_or_default(),
            created: summary.created.unwrap_or_default(),
            size_rw: summary.size_rw.unwrap_or_default(),
            size_root_fs: summary.size_root_fs.unwrap_or_default(),
            status: summary.status.unwrap_or_default(),
            state: match summary.state {
                Some(state) => state.to_string(),
                None => "Unknown".to_string(),
            },
        }
    }
}

/// Query parameters for removing a container
#[derive(Debug, Deserialize, IntoParams, ToSchema)]
pub struct RemoveContainerQueryParams {
    pub force: Option<bool>,
    pub volumes: Option<bool>,
    pub links: Option<bool>,
}

/// Query parameters for container statistics
#[derive(Debug, Deserialize, IntoParams, ToSchema)]
pub struct ContainerStatsQueryParams {
    pub containers: Option<Vec<String>>,
}

#[derive(Debug, Deserialize, IntoParams, ToSchema)]
pub struct BulkStopContainersQueryParams {
    pub containers: Option<Vec<String>>,
    pub signal: Option<String>,
}

#[derive(Debug, Deserialize, IntoParams, ToSchema)]
pub struct BulkStartContainersQueryParams {
    pub containers: Option<Vec<String>>,
}

#[derive(Debug, Deserialize, IntoParams, ToSchema)]
pub struct BulkDeleteContainersQueryParams {
    pub containers: Option<Vec<String>>,
    pub force: Option<bool>,
    pub volumes: Option<bool>,
    pub links: Option<bool>,
}
