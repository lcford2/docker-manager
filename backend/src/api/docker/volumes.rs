use crate::api::RouteSpec;
use crate::api::middleware::require_bearer_auth_middleware;
use crate::lib::{errors::AppError, state::AppState};
use axum::{
    Json, Router,
    extract::State,
    middleware,
    routing::{get, post},
};
use log::{info, trace};
use std::sync::Arc;

/// Creates the router for Docker volume endpoints
pub fn router() -> (Router<Arc<AppState>>, Vec<RouteSpec>) {
    let r = Router::new().nest(
        "/docker",
        Router::new()
            .route("/volumes", get(get_volumes))
            .layer(middleware::from_fn(require_bearer_auth_middleware))
            .route("/volumes/prune", post(prune_volumes))
            .layer(middleware::from_fn(require_bearer_auth_middleware)),
    );

    let docs = vec![
        RouteSpec {
            method: "GET",
            path: "/docker/volumes".to_string(),
        },
        RouteSpec {
            method: "POST",
            path: "/docker/volumes/prune".to_string(),
        },
    ];
    (r, docs)
}

/// API Endpoint for getting a listing of the volumes on the system.
///
/// # Arguments
/// * `State(state): State<Arc<AppState>>` - The application state.
///
/// # Returns
/// * JSON response with volume listing
#[utoipa::path(
    get,
    path = "/api/docker/volumes",
    params(),
    responses(
        (status = 200, description = "Successful response"),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn get_volumes(
    State(state): State<Arc<AppState>>,
) -> Result<Json<bollard::secret::VolumeListResponse>, AppError> {
    trace!("Getting volumes");
    use bollard::query_parameters::ListVolumesOptionsBuilder;
    let opts = Some(ListVolumesOptionsBuilder::default().build());
    let volumes = state.docker_client.list_volumes(opts).await?;
    let volume_count = volumes.volumes.as_ref().map_or(0, |v| v.len());
    let warning_count = volumes.warnings.as_ref().map_or(0, |w| w.len());
    info!(
        "Got {} volumes with {} warnings",
        volume_count, warning_count
    );
    Ok(Json(volumes))
}

/// API Endpoint for pruning volumes
///
/// # Arguments
/// * `State(state): State<Arc<AppState>>` - The application state.
///
/// # Returns
/// * JSON response with pruning results
#[utoipa::path(
    post,
    path="/api/docker/volumes/prune",
    params(),
    responses(
        (status = 200, description = "Volumes pruned successfully"),
        (status = 500, description = "Failed to prune volumes")
    )
)]
pub async fn prune_volumes(
    State(state): State<Arc<AppState>>,
) -> Result<Json<bollard::secret::VolumePruneResponse>, AppError> {
    trace!("Pruning volumes");
    use bollard::query_parameters::PruneVolumesOptionsBuilder;
    let opts = Some(PruneVolumesOptionsBuilder::default().build());
    let prune_response = state.docker_client.prune_volumes(opts).await?;
    let volumes_deleted = prune_response
        .volumes_deleted
        .as_ref()
        .unwrap_or(&Vec::new())
        .len();

    info!("Pruned {} volumes", volumes_deleted);
    Ok(Json(prune_response))
}
