use crate::api::RouteSpec;
use crate::api::middleware::{require_bearer_auth_middleware, require_write_permission_middleware};
use crate::api::types;
use crate::api::types::generic::GenericResponse;
use crate::lib::{errors::AppError, state::AppState};
use axum::{
    Json, Router,
    extract::{Path, Query, State},
    middleware,
    routing::{delete, get, post},
};
use log::{info, trace};
use std::default::Default;
use std::sync::Arc;

/// Creates the router for Docker image endpoints
pub fn router() -> (Router<Arc<AppState>>, Vec<RouteSpec>) {
    // Read-only routes (any authenticated user)
    let read_routes = Router::new()
        .route("/images", get(get_images))
        .layer(middleware::from_fn(require_bearer_auth_middleware));

    // Write routes (readwrite or admin only)
    let write_routes = Router::new()
        .route("/images/prune", post(prune_images))
        .route("/images/{image_name}", delete(delete_image))
        .route("/images/bulk-delete", post(bulk_delete_images))
        .route("/images/pull/{image_name}", post(pull_image))
        .layer(middleware::from_fn(require_write_permission_middleware));

    let r = Router::new().nest("/docker", read_routes.merge(write_routes));

    let docs = vec![
        RouteSpec {
            method: "GET",
            path: "/docker/images".to_string(),
        },
        RouteSpec {
            method: "POST",
            path: "/docker/images/prune".to_string(),
        },
        RouteSpec {
            method: "POST",
            path: "/docker/images/pull/{name}".to_string(),
        },
        RouteSpec {
            method: "DELETE",
            path: "/docker/images/{image_name}".to_string(),
        },
        RouteSpec {
            method: "POST",
            path: "/docker/images/bulk-delete".to_string(),
        },
    ];
    (r, docs)
}

/// API Endpoint for getting a listing of images
///
/// # Arguments
/// * `State(state): State<Arc<AppState>>` - The application state
///
/// # Returns
/// * JSON response containing the list of images
#[utoipa::path(
    get,
    path = "/api/docker/images",
    responses(
        (status = 200, description = "Successful response"),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn get_images(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<bollard::secret::ImageSummary>>, AppError> {
    use bollard::query_parameters::ListImagesOptionsBuilder;
    let opts = Some(ListImagesOptionsBuilder::default().all(false).build());
    trace!("Fetching images");
    let images = state.docker_client.list_images(opts).await?;
    info!("Fetched {} images", images.len());
    Ok(Json(images))
}

/// API Endpoint for pruning images
///
/// # Arguments
/// * `State(state): State<Arc<AppState>>` - The application state
///
/// # Returns
/// * JSON response containing the pruning result
#[utoipa::path(
    post,
    path = "/api/docker/images/prune",
    responses(
        (status = 200, description = "Successful response"),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn prune_images(
    State(state): State<Arc<AppState>>,
) -> Result<Json<bollard::secret::ImagePruneResponse>, AppError> {
    use bollard::query_parameters::PruneImagesOptionsBuilder;
    let opts = Some(PruneImagesOptionsBuilder::default().build());
    trace!("Pruning images");
    let prune_response = state.docker_client.prune_images(opts).await?;
    info!("Successfully pruned images");
    Ok(Json(prune_response))
}

/// API Endpoint for deleting an image
///
/// # Arguments
///
/// * `name` - The name or ID of the image to delete
/// * `params` - Query parameters controlling deletion behavior:
///   - `force`: If true, remove image even if a stopped container is using it
///   - `noprune`: If true, do not remove untagged parents.
/// * `state` - The application state
///
/// # Returns
///
/// Returns a JSON response indicating success or failure
#[utoipa::path(
    delete,
    path = "/api/docker/images/{name}",
    params(types::images::DeleteImageQueryParams),
    responses(
        (status = 200, description = "Image deleted successfully", body=types::generic::GenericResponse),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn delete_image(
    Path(name): Path<String>,
    State(state): State<Arc<AppState>>,
    Query(params): Query<types::images::DeleteImageQueryParams>,
) -> Result<Json<types::generic::GenericResponse>, AppError> {
    trace!("Deleting images");
    use bollard::query_parameters::RemoveImageOptionsBuilder;
    let opts = Some(
        RemoveImageOptionsBuilder::default()
            .force(params.force.unwrap_or(false))
            .noprune(params.noprune.unwrap_or(false))
            .build(),
    );
    state
        .docker_client
        .remove_image(name.as_str(), opts, None)
        .await?;
    info!("Successfully deleted image");
    Ok(Json(GenericResponse {
        success: true,
        error_message: String::new(),
    }))
}

/// API Endpoint for deleting several images
///
/// # Arguments
/// * `params` - The parameters for the request
/// * `state` - The application state
///
/// # Returns
/// Returns a JSON response indicating success or failure
#[utoipa::path(
    post,
    path = "/api/docker/images/bulk-delete",
    params(types::images::BulkDeleteImagesQueryParams),
    responses(
        (status = 200, description = "Images deleted successfully", body=types::generic::GenericResponse),
        (status = 500, description = "Internal server error")
    )
)]
async fn bulk_delete_images(
    State(state): State<Arc<AppState>>,
    Json(params): Json<types::images::BulkDeleteImagesQueryParams>,
) -> Result<Json<types::generic::GenericResponse>, AppError> {
    info!("Deleting images: {params}");
    let image_names: Vec<String> = match params.images {
        Some(images) => images,
        None => {
            return Err(AppError::InvalidInput("Images not provided.".to_string()));
        }
    };

    let force = params.force.unwrap_or(false);
    let noprune = params.noprune.unwrap_or(false);

    let futures = image_names.into_iter().map(|image_name| {
        let state = state.clone();
        // let force = force.clone();
        // let noprune = noprune.clone();
        async move {
            use bollard::query_parameters::RemoveImageOptionsBuilder;
            let opts = Some(
                RemoveImageOptionsBuilder::default()
                    .force(force)
                    .noprune(noprune)
                    .build(),
            );
            state
                .docker_client
                .remove_image(&image_name, opts, None)
                .await
        }
    });

    futures::future::join_all(futures).await;

    Ok(Json(types::generic::GenericResponse {
        success: true,
        error_message: String::new(),
    }))
}

/// API Endpoint for pulling an image
///
/// # Arguments
/// * `Path(image_name): Path<String>` - The name of the image to pull
/// * `Query(params): Query<ImagePullQueryParams>` - The query parameters for pulling the image
/// * `State(state): State<Arc<AppState>>` - The application state
///
/// # Returns
/// * JSON response indicating success
#[utoipa::path(
    post,
    path = "/api/docker/images/pull/{image_name}",
    params(
        ("image_name", Path, description="Name of image to pull" ),
        types::images::ImagePullQueryParams),
    responses(
        (status = 200, description = "Successful response", body = types::images::PullImageResponse),
        (status = 500, description = "Internal server error")
    )
)]
async fn pull_image(
    Path(image_name): Path<String>,
    State(state): State<Arc<AppState>>,
    Json(params): Json<types::images::ImagePullQueryParams>,
) -> Result<Json<types::images::PullImageResponse>, AppError> {
    use bollard::query_parameters::CreateImageOptionsBuilder;
    use futures_util::StreamExt;

    // Parse image name and tag
    let (repo, tag) = if image_name.contains(':') {
        // Image name includes tag like "rust:1-slim-bullseye"
        let parts: Vec<&str> = image_name.splitn(2, ':').collect();
        (
            parts[0].to_string(),
            parts
                .get(1)
                .map(|s| s.to_string())
                .unwrap_or_else(|| "latest".to_string()),
        )
    } else {
        // Image name without tag, use query param or default to "latest"
        (
            image_name.clone(),
            params.tag.unwrap_or_else(|| "latest".to_string()),
        )
    };

    info!("Pulling image {}:{}", repo, tag);
    let opts = Some(
        CreateImageOptionsBuilder::default()
            .from_image(repo.as_str())
            .tag(tag.as_str())
            .build(),
    );

    let mut pull_stream = state.docker_client.create_image(opts, None, None);
    while let Some(pull_result) = pull_stream.next().await {
        let output = pull_result?;
        info!("{output:?}");
    }

    Ok(Json(types::images::PullImageResponse { success: true }))
}
