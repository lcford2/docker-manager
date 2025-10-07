use axum::{
    extract::{FromRequestParts, Request},
    http::{StatusCode, header::AUTHORIZATION, request::Parts},
    middleware::Next,
    response::Response,
};

use crate::lib::auth;

/// Struct that can be used as an extractor to get authenticated user info from JWT
#[derive(Clone, Debug)]
pub struct AuthenticatedUser {
    pub user_id: i32,
    pub username: String,
    pub permission: String,
}

impl<S> FromRequestParts<S> for AuthenticatedUser
where
    S: Send + Sync,
{
    type Rejection = StatusCode;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let auth_header = parts
            .headers
            .get(AUTHORIZATION)
            .and_then(|header| header.to_str().ok())
            .ok_or(StatusCode::UNAUTHORIZED)?;

        if !auth_header.starts_with("Bearer ") {
            return Err(StatusCode::UNAUTHORIZED);
        }

        let token = &auth_header[7..];
        let token_data = auth::verify_jwt_token(token).map_err(|_| StatusCode::UNAUTHORIZED)?;

        Ok(AuthenticatedUser {
            user_id: token_data.claims.user_id,
            username: token_data.claims.sub,
            permission: token_data.claims.permission,
        })
    }
}

// Middleware that requires authentication
pub async fn require_bearer_auth_middleware(
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Try to extract the Authorization header
    let auth_header = request
        .headers()
        .get(AUTHORIZATION)
        .and_then(|header| header.to_str().ok());

    if let Some(auth_header) = auth_header {
        if auth_header.starts_with("Bearer ") {
            let token = &auth_header[7..]; // Remove "Bearer " prefix
            match auth::verify_jwt_token(token) {
                Ok(token_data) => {
                    let username = &token_data.claims.sub;
                    request.extensions_mut().insert(username.clone());
                    return Ok(next.run(request).await);
                }
                Err(_) => {
                    return Err(StatusCode::UNAUTHORIZED);
                }
            }
        }
    }

    // No valid Bearer token found
    Err(StatusCode::UNAUTHORIZED)
}
