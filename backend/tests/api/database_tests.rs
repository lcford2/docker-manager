//! Database integration tests
//!
//! Tests database connectivity and queries using sqlx::test with fixtures.

use sqlx::PgPool;

#[sqlx::test]
async fn test_database_connection(pool: PgPool) -> sqlx::Result<()> {
    // Simple query to verify database connectivity
    let result: (i32,) = sqlx::query_as("SELECT 1").fetch_one(&pool).await?;

    assert_eq!(result.0, 1);
    Ok(())
}

#[sqlx::test]
async fn test_users_table_exists(pool: PgPool) -> sqlx::Result<()> {
    // Verify users table exists
    let result: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM information_schema.tables
         WHERE table_name = 'users'",
    )
    .fetch_one(&pool)
    .await?;

    assert_eq!(result.0, 1);
    Ok(())
}

#[sqlx::test(fixtures("fixtures/users"))]
async fn test_query_with_fixtures(pool: PgPool) -> sqlx::Result<()> {
    // Query users loaded from fixture
    let result: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users")
        .fetch_one(&pool)
        .await?;

    // users.sql fixture has 3 users
    assert_eq!(result.0, 3);
    Ok(())
}

#[sqlx::test(fixtures("fixtures/users"))]
async fn test_query_specific_user(pool: PgPool) -> sqlx::Result<()> {
    // Query specific user from fixture
    let result: (String,) =
        sqlx::query_as("SELECT username FROM users WHERE username = 'admin_test'")
            .fetch_one(&pool)
            .await?;

    assert_eq!(result.0, "admin_test");
    Ok(())
}

#[sqlx::test(fixtures("fixtures/users", "fixtures/container_stats"))]
async fn test_multiple_fixtures(pool: PgPool) -> sqlx::Result<()> {
    // Verify both fixtures are loaded
    let user_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users")
        .fetch_one(&pool)
        .await?;

    let stats_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM container_stats")
        .fetch_one(&pool)
        .await?;

    assert_eq!(user_count.0, 3);
    assert!(stats_count.0 > 0); // At least some stats records
    Ok(())
}

#[sqlx::test]
async fn test_insert_and_query(pool: PgPool) -> sqlx::Result<()> {
    // Insert a test user
    sqlx::query(
        "INSERT INTO users (username, email, password_hash, role)
         VALUES ($1, $2, $3, $4)",
    )
    .bind("test_user")
    .bind("test@example.com")
    .bind("hashed_password")
    .bind("Viewer")
    .execute(&pool)
    .await?;

    // Query it back
    let result: (String, String) =
        sqlx::query_as("SELECT username, email FROM users WHERE username = 'test_user'")
            .fetch_one(&pool)
            .await?;

    assert_eq!(result.0, "test_user");
    assert_eq!(result.1, "test@example.com");
    Ok(())
}

#[sqlx::test(fixtures("fixtures/container_stats"))]
async fn test_aggregate_container_stats(pool: PgPool) -> sqlx::Result<()> {
    // Test aggregation query
    let result: (f64,) =
        sqlx::query_as("SELECT AVG(cpu_usage) FROM container_stats WHERE container_id = 'abc123'")
            .fetch_one(&pool)
            .await?;

    // Average should be positive
    assert!(result.0 > 0.0);
    Ok(())
}

#[sqlx::test]
async fn test_transaction_isolation(pool: PgPool) -> sqlx::Result<()> {
    // Each test gets its own isolated database
    // Insert something in this test
    sqlx::query(
        "INSERT INTO users (username, email, password_hash, role)
         VALUES ($1, $2, $3, $4)",
    )
    .bind("isolated_user")
    .bind("isolated@example.com")
    .bind("hashed_password")
    .bind("Admin")
    .execute(&pool)
    .await?;

    // Verify it exists in this test
    let result: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM users WHERE username = 'isolated_user'")
            .fetch_one(&pool)
            .await?;

    assert_eq!(result.0, 1);
    Ok(())
}
