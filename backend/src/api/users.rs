use crate::api::RouteSpec;
use crate::api::middleware::AuthenticatedUser;
use crate::lib::state::AppState;
use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    routing::get,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// User response structure (without password hash)
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct UserResponse {
    pub id: i32,
    pub username: String,
    pub email: String,
    pub permission: String,
    pub is_active: bool,
}

/// Request structure for creating a new user
#[derive(Debug, Deserialize)]
pub struct CreateUserRequest {
    pub username: String,
    pub email: String,
    pub password: String,
    pub permission: String,
}

/// Request structure for updating an existing user
#[derive(Debug, Deserialize)]
pub struct UpdateUserRequest {
    pub username: Option<String>,
    pub email: Option<String>,
    pub password: Option<String>,
    pub permission: Option<String>,
    pub is_active: Option<bool>,
}

/// Creates the router for user management endpoints
pub fn router() -> (Router<Arc<AppState>>, Vec<RouteSpec>) {
    let r = Router::new()
        .route("/users", get(list_users).post(create_user))
        .route(
            "/users/{id}",
            get(get_user).put(update_user).delete(delete_user),
        );

    let docs = vec![
        RouteSpec {
            method: "GET",
            path: "/users".to_string(),
        },
        RouteSpec {
            method: "POST",
            path: "/users".to_string(),
        },
        RouteSpec {
            method: "GET",
            path: "/users/{id}".to_string(),
        },
        RouteSpec {
            method: "PUT",
            path: "/users/{id}".to_string(),
        },
        RouteSpec {
            method: "DELETE",
            path: "/users/{id}".to_string(),
        },
    ];

    (r, docs)
}

/// Check if the authenticated user has admin permission
fn require_admin(user: &AuthenticatedUser) -> Result<(), StatusCode> {
    if user.permission != "admin" {
        return Err(StatusCode::FORBIDDEN);
    }
    Ok(())
}

/// List all users (admin only)
async fn list_users(
    user: AuthenticatedUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<UserResponse>>, StatusCode> {
    require_admin(&user)?;

    let users: Vec<UserResponse> = sqlx::query_as(
        "SELECT id, username, email, permission::text as permission, is_active
         FROM users
         ORDER BY id",
    )
    .fetch_all(&state.database_pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(users))
}

/// Get a specific user by ID (admin only)
async fn get_user(
    user: AuthenticatedUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
) -> Result<Json<UserResponse>, StatusCode> {
    require_admin(&user)?;

    let user: UserResponse = sqlx::query_as(
        "SELECT id, username, email, permission::text as permission, is_active
         FROM users
         WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.database_pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(user))
}

/// Create a new user (admin only)
async fn create_user(
    user: AuthenticatedUser,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateUserRequest>,
) -> Result<(StatusCode, Json<UserResponse>), StatusCode> {
    require_admin(&user)?;

    // Validate permission level
    if !["readonly", "readwrite", "admin"].contains(&payload.permission.as_str()) {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Hash password using bcrypt
    let password_hash = bcrypt::hash(&payload.password, bcrypt::DEFAULT_COST)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let user: UserResponse = sqlx::query_as(
        "INSERT INTO users (username, email, password_hash, permission, is_active)
         VALUES ($1, $2, $3, $4::permission_level, true)
         RETURNING id, username, email, permission::text as permission, is_active",
    )
    .bind(&payload.username)
    .bind(&payload.email)
    .bind(&password_hash)
    .bind(&payload.permission)
    .fetch_one(&state.database_pool)
    .await
    .map_err(|e| {
        // Check for unique constraint violations
        if e.to_string().contains("duplicate key") {
            StatusCode::CONFLICT
        } else {
            StatusCode::INTERNAL_SERVER_ERROR
        }
    })?;

    Ok((StatusCode::CREATED, Json(user)))
}

/// Update an existing user (admin only)
async fn update_user(
    user: AuthenticatedUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
    Json(payload): Json<UpdateUserRequest>,
) -> Result<Json<UserResponse>, StatusCode> {
    require_admin(&user)?;

    // Validate permission level if provided
    if let Some(ref permission) = payload.permission
        && !["readonly", "readwrite", "admin"].contains(&permission.as_str())
    {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Build dynamic update query
    let mut query = String::from("UPDATE users SET updated_at = CURRENT_TIMESTAMP");
    let mut param_count = 1;

    if payload.username.is_some() {
        param_count += 1;
        query.push_str(&format!(", username = ${}", param_count));
    }
    if payload.email.is_some() {
        param_count += 1;
        query.push_str(&format!(", email = ${}", param_count));
    }
    if payload.password.is_some() {
        param_count += 1;
        query.push_str(&format!(", password_hash = ${}", param_count));
    }
    if payload.permission.is_some() {
        param_count += 1;
        query.push_str(&format!(
            ", permission = ${}::permission_level",
            param_count
        ));
    }
    if payload.is_active.is_some() {
        param_count += 1;
        query.push_str(&format!(", is_active = ${}", param_count));
    }

    query.push_str(
        &" WHERE id = $1 RETURNING id, username, email, permission::text as permission, is_active"
            .to_string(),
    );

    let mut query_builder = sqlx::query_as::<_, UserResponse>(&query).bind(id);

    if let Some(username) = payload.username {
        query_builder = query_builder.bind(username);
    }
    if let Some(email) = payload.email {
        query_builder = query_builder.bind(email);
    }
    if let Some(password) = payload.password {
        let password_hash = bcrypt::hash(&password, bcrypt::DEFAULT_COST)
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        query_builder = query_builder.bind(password_hash);
    }
    if let Some(permission) = payload.permission {
        query_builder = query_builder.bind(permission);
    }
    if let Some(is_active) = payload.is_active {
        query_builder = query_builder.bind(is_active);
    }

    let user = query_builder
        .fetch_optional(&state.database_pool)
        .await
        .map_err(|e| {
            if e.to_string().contains("duplicate key") {
                StatusCode::CONFLICT
            } else {
                StatusCode::INTERNAL_SERVER_ERROR
            }
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(user))
}

/// Delete a user (admin only)
async fn delete_user(
    auth_user: AuthenticatedUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
) -> Result<StatusCode, StatusCode> {
    require_admin(&auth_user)?;

    // Prevent admin from deleting themselves
    if auth_user.user_id == id {
        return Err(StatusCode::BAD_REQUEST);
    }

    let result = sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(id)
        .execute(&state.database_pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}
