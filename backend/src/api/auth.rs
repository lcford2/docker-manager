use crate::api::RouteSpec;
use crate::api::types::generic::LoginResponse;
use crate::lib::auth;
use crate::lib::state::AppState;
use axum::{Form, Json, Router, http::StatusCode, response::IntoResponse, routing::post};
use std::sync::Arc;

type AuthSession = axum_login::AuthSession<auth::Backend>;

/// Creates the router for authentication endpoints
pub fn router() -> (Router<Arc<AppState>>, Vec<RouteSpec>) {
    let r = Router::new().nest(
        "/auth",
        Router::new()
            .route("/login", post(login_form))
            .route("/token", post(login_json)),
    );

    let docs = vec![
        RouteSpec {
            method: "POST",
            path: "/auth/login".to_string(),
        },
        RouteSpec {
            method: "POST",
            path: "/auth/token".to_string(),
        },
    ];

    (r, docs)
}

/// Form-based login endpoint (accepts application/x-www-form-urlencoded)
/// Returns a JWT token on successful authentication
pub async fn login_form(
    auth_session: AuthSession,
    Form(creds): Form<auth::Credentials>,
) -> impl IntoResponse {
    let user = match auth_session.authenticate(creds.clone()).await {
        Ok(Some(user)) => user,
        Ok(None) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(LoginResponse {
                    success: false,
                    error_message: "Invalid credentials".to_string(),
                    token: None,
                    user: None,
                    user_id: None,
                    permission: None,
                }),
            );
        }
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(LoginResponse {
                    success: false,
                    error_message: "Internal server error".to_string(),
                    token: None,
                    user: None,
                    user_id: None,
                    permission: None,
                }),
            );
        }
    };

    // Generate JWT token
    match auth::generate_jwt_token(&user) {
        Ok(token) => (
            StatusCode::OK,
            Json(LoginResponse {
                success: true,
                error_message: "".to_string(),
                token: Some(token),
                user: Some(user.username.clone()),
                user_id: Some(user.id),
                permission: Some(user.permission.clone()),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(LoginResponse {
                success: false,
                error_message: "Failed to generate token".to_string(),
                token: None,
                user: None,
                user_id: None,
                permission: None,
            }),
        ),
    }
}

/// JSON-based login endpoint (accepts application/json)
/// Returns a JWT token on successful authentication
pub async fn login_json(
    auth_session: AuthSession,
    Json(creds): Json<auth::Credentials>,
) -> impl IntoResponse {
    let user = match auth_session.authenticate(creds.clone()).await {
        Ok(Some(user)) => user,
        Ok(None) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(LoginResponse {
                    success: false,
                    error_message: "Invalid credentials".to_string(),
                    token: None,
                    user: None,
                    user_id: None,
                    permission: None,
                }),
            );
        }
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(LoginResponse {
                    success: false,
                    error_message: "Internal server error".to_string(),
                    token: None,
                    user: None,
                    user_id: None,
                    permission: None,
                }),
            );
        }
    };

    // Generate JWT token
    match auth::generate_jwt_token(&user) {
        Ok(token) => (
            StatusCode::OK,
            Json(LoginResponse {
                success: true,
                error_message: "".to_string(),
                token: Some(token),
                user: Some(user.username.clone()),
                user_id: Some(user.id),
                permission: Some(user.permission.clone()),
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(LoginResponse {
                success: false,
                error_message: "Failed to generate token".to_string(),
                token: None,
                user: None,
                user_id: None,
                permission: None,
            }),
        ),
    }
}
