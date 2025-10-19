use crate::api::RouteSpec;
use crate::api::middleware::{require_bearer_auth_middleware, require_write_permission_middleware};
use crate::api::types;
use crate::lib::{errors::AppError, state::AppState};
use axum::{
    Json, Router,
    extract::{Path, Query, State},
    middleware,
    routing::{delete, get, post},
};
use log::{info, trace};
use std::sync::Arc;

/// Creates the router for Docker volume endpoints
pub fn router() -> (Router<Arc<AppState>>, Vec<RouteSpec>) {
    // Read-only routes (any authenticated user)
    let read_routes = Router::new()
        .route("/volumes", get(get_volumes))
        .layer(middleware::from_fn(require_bearer_auth_middleware));

    // Write routes (readwrite or admin only)
    let write_routes = Router::new()
        .route("/volumes/{name}", delete(delete_volume))
        .route("/volumes/bulk-delete", post(bulk_delete_volumes))
        .route("/volumes/prune", post(prune_volumes))
        .layer(middleware::from_fn(require_write_permission_middleware));

    let r = Router::new().nest("/docker", read_routes.merge(write_routes));

    let docs = vec![
        RouteSpec {
            method: "GET",
            path: "/docker/volumes".to_string(),
        },
        RouteSpec {
            method: "POST",
            path: "/docker/volumes/prune".to_string(),
        },
        RouteSpec {
            method: "DELETE",
            path: "/docker/volumes".to_string(),
        },
        RouteSpec {
            method: "POST",
            path: "/docker/volumes/bulk-delete".to_string(),
        },
    ];
    (r, docs)
}

/// API Endpoint for getting a listing of the volumes on the system.
///
/// # Arguments
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

/// API Endpoint for deleting a volume
///
/// # Arguments
/// * Path(volume_name): `Path<String>`
/// * State(state): `State<Arc<AppState>>`
///
/// # Returns
/// JSON response indicating success or failure
#[utoipa::path(
    delete,
    path = "/api/docker/volumes/{volume_name}",
    params(
        ("volume_name", description = "Name of the volume to delete"),
        ("force", description = "Force deletion of the volume")
    ),
    responses(
        (status = 200, description = "Volume deleted successfully", body = types::generic::GenericResponse),
        (status = 500, description = "Failed to delete volume")
    )
)]
pub async fn delete_volume(
    Path(volume_name): Path<String>,
    State(state): State<Arc<AppState>>,
    Query(params): Query<types::volumes::DeleteVolumeQueryParams>,
) -> Result<Json<types::generic::GenericResponse>, AppError> {
    trace!("Deleting volume {}", volume_name);
    use bollard::query_parameters::RemoveVolumeOptionsBuilder;
    let opts = Some(
        RemoveVolumeOptionsBuilder::default()
            .force(params.force.unwrap_or(false))
            .build(),
    );
    state
        .docker_client
        .remove_volume(volume_name.as_str(), opts)
        .await?;
    info!("Deleted volume {}", volume_name);
    Ok(Json(types::generic::GenericResponse {
        success: true,
        error_message: String::new(),
    }))
}

/// API Endpoint for deleting multiple volumes
///
/// # Arguments
/// * `State(state)` - The application state
///
/// # Returns
/// JSON response with pruning results
#[utoipa::path(
    delete,
    path = "/api/docker/volumes/bulk-delete",
    params(types::volumes::BulkDeleteVolumesQueryParams),
    responses(
        (status = 200, description = "Volumes deleted successfully"),
        (status = 500, description = "Failed to delete volumes")
    )
)]
pub async fn bulk_delete_volumes(
    State(state): State<Arc<AppState>>,
    Json(params): Json<types::volumes::BulkDeleteVolumesQueryParams>,
) -> Result<Json<types::generic::GenericResponse>, AppError> {
    let volume_names = match params.volumes {
        Some(names) => names,
        None => {
            return Err(AppError::InvalidInput(
                "Volume names not provided".to_string(),
            ));
        }
    };
    let futures = volume_names.into_iter().map(|name| {
        let state = state.clone();
        let force = params.force.unwrap_or(false);
        use bollard::query_parameters::RemoveVolumeOptionsBuilder;
        let opts = Some(RemoveVolumeOptionsBuilder::default().force(force).build());
        async move { state.docker_client.remove_volume(name.as_str(), opts).await }
    });

    futures::future::join_all(futures).await;
    Ok(Json(types::generic::GenericResponse {
        success: true,
        error_message: String::new(),
    }))
}
