use axum_login::{AuthUser, AuthnBackend, UserId};
use chrono::{Duration, Utc};
use jsonwebtoken::{DecodingKey, EncodingKey, Header, TokenData, Validation, decode, encode};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct User {
    pub id: i32,
    pub username: String,
    #[allow(dead_code)]
    pub email: String,
    pub password_hash: String,
    pub permission: String,
    #[allow(dead_code)]
    pub is_active: bool,
}

impl AuthUser for User {
    type Id = i32;

    fn id(&self) -> Self::Id {
        self.id
    }

    fn session_auth_hash(&self) -> &[u8] {
        self.password_hash.as_bytes()
    }
}

#[derive(Clone)]
pub struct Backend {
    pub db_pool: PgPool,
}

#[derive(Clone, Deserialize)]
pub struct Credentials {
    pub user_name: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,        // subject (username)
    pub user_id: i32,       // user ID
    pub permission: String, // user permission level
    pub exp: usize,         // expiration time (in seconds since Unix epoch)
    pub iat: usize,         // issued at (in seconds since Unix epoch)
}

impl AuthnBackend for Backend {
    type User = User;
    type Credentials = Credentials;
    type Error = sqlx::Error;

    async fn authenticate(
        &self,
        Credentials {
            user_name,
            password,
        }: Self::Credentials,
    ) -> Result<Option<Self::User>, Self::Error> {
        // Query user from database by username
        let user: Option<User> = sqlx::query_as(
            "SELECT id, username, email, password_hash, permission::text as permission, is_active
             FROM users
             WHERE username = $1 AND is_active = true",
        )
        .bind(&user_name)
        .fetch_optional(&self.db_pool)
        .await?;

        if let Some(user) = user {
            // Verify password using bcrypt
            match bcrypt::verify(&password, &user.password_hash) {
                Ok(true) => Ok(Some(user)),
                Ok(false) => Ok(None),
                Err(_) => Ok(None),
            }
        } else {
            Ok(None)
        }
    }

    async fn get_user(&self, user_id: &UserId<Self>) -> Result<Option<Self::User>, Self::Error> {
        let user: Option<User> = sqlx::query_as(
            "SELECT id, username, email, password_hash, permission::text as permission, is_active
             FROM users
             WHERE id = $1",
        )
        .bind(user_id)
        .fetch_optional(&self.db_pool)
        .await?;

        Ok(user)
    }
}

/// Get JWT secret from environment variable
fn get_jwt_secret() -> Vec<u8> {
    std::env::var("JWT_SECRET")
        .expect("JWT_SECRET environment variable must be set")
        .into_bytes()
}

pub fn generate_jwt_token(
    user: &User,
    jwt_expiration_hours: i64,
) -> Result<String, jsonwebtoken::errors::Error> {
    let now = Utc::now();
    let exp = now + Duration::hours(jwt_expiration_hours);

    let claims = Claims {
        sub: user.username.clone(),
        user_id: user.id,
        permission: user.permission.clone(),
        exp: exp.timestamp() as usize,
        iat: now.timestamp() as usize,
    };

    let secret = get_jwt_secret();
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(&secret),
    )
}

pub fn verify_jwt_token(token: &str) -> Result<TokenData<Claims>, jsonwebtoken::errors::Error> {
    let secret = get_jwt_secret();
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(&secret),
        &Validation::default(),
    )
}
