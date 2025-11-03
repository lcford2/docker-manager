# Docker Manager Backend - Test Suite

Comprehensive test suite for the Rust backend following 2025 best practices.

## Table of Contents

- [Quick Start](#quick-start)
- [Testing Stack](#testing-stack)
- [Test Organization](#test-organization)
- [Running Tests](#running-tests)
- [Code Coverage](#code-coverage)
- [Writing Tests](#writing-tests)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## Quick Start

### Option 1: Using the Test Scripts (Recommended)

```bash
# Run all tests (skips database tests)
./scripts/run-tests.sh

# Start test database and run ALL tests (including database tests)
./scripts/run-tests.sh --with-db

# Generate coverage report
./scripts/run-tests.sh --coverage --with-db
```

### Option 2: Manual Setup

```bash
# 1. Install testing tools
cargo install cargo-nextest cargo-llvm-cov

# 2. Start test database
./scripts/start-test-db.sh

# 3. Set environment variables
export DATABASE_URL="postgres://test_user:test_password@localhost:5433/docker_manager_test"
export JWT_SECRET="test_secret_key"

# 4. Run all tests
cargo nextest run

# 5. Generate coverage report
cargo llvm-cov --html --open
```

## Testing Stack

### Testing Frameworks

- **cargo-nextest** - Modern test runner with better output and parallelization
- **cargo-llvm-cov** - Code coverage tool with Codecov integration
- **tokio::test** - Async test runtime
- **axum-test** - HTTP endpoint testing for Axum
- **sqlx::test** - Database testing with automatic isolation

### Test Dependencies

```toml
[dev-dependencies]
tokio = { version = "1", features = ["test-util", "macros"] }
axum-test = "16"
tokio-tungstenite = "0.26"
pretty_assertions = "1"
http-body-util = "0.1"
async-trait = "0.1"
```

## Test Organization

```
backend/
├── src/
│   └── lib/
│       ├── config.rs           # 27 unit tests
│       ├── docker_trait.rs     # 2 trait tests
│       └── ...
├── tests/
│   ├── api/
│   │   ├── health_tests.rs     # HTTP endpoint tests
│   │   ├── database_tests.rs   # Database integration tests
│   │   └── websocket_tests.rs  # WebSocket/channel tests
│   ├── helpers/
│   │   └── mod.rs              # Test utilities and mocks
│   └── fixtures/
│       ├── users.sql           # Test user data
│       ├── container_stats.sql # Container metrics
│       └── system_stats.sql    # System metrics
```

### Test Types

1. **Unit Tests** (`#[test]` in source files)
   - Test individual functions and methods
   - No external dependencies
   - Fast execution
   - Example: config validation tests

2. **Integration Tests** (`tests/` directory)
   - Test API endpoints
   - Test database operations
   - Test WebSocket/channel logic
   - Example: health endpoint tests

3. **Database Tests** (`#[sqlx::test]`)
   - Automatic database isolation
   - Fixture support
   - Transaction rollback per test
   - Example: user query tests

## Running Tests

### Using Test Scripts (Easiest)

The `run-tests.sh` script handles database setup automatically:

```bash
# Run all non-database tests
./scripts/run-tests.sh

# Run ALL tests (including database tests)
./scripts/run-tests.sh --with-db

# Run only unit tests
./scripts/run-tests.sh --unit

# Run only integration tests
./scripts/run-tests.sh --integration --with-db

# Generate coverage report
./scripts/run-tests.sh --coverage --with-db
```

### Test Database Management

The `start-test-db.sh` script manages a PostgreSQL test database:

```bash
# Start test database
./scripts/start-test-db.sh

# Check database status
./scripts/start-test-db.sh status

# View database logs
./scripts/start-test-db.sh logs

# Connect with psql
./scripts/start-test-db.sh psql

# Restart database
./scripts/start-test-db.sh restart

# Stop database
./scripts/start-test-db.sh stop

# Remove database completely
./scripts/start-test-db.sh clean
```

**Test Database Details:**
- **Host:** localhost
- **Port:** 5433 (avoids conflict with production DB on 5432)
- **Database:** docker_manager_test
- **User:** test_user
- **Password:** test_password
- **Container:** docker-manager-test-db

### With cargo-nextest (Recommended)

```bash
# Run all tests (requires DATABASE_URL for DB tests)
cargo nextest run

# Run without database tests
cargo nextest run --filter-expr 'not test(database)'

# Run specific test
cargo nextest run test_name

# Run tests in a module
cargo nextest run config

# Run integration tests only
cargo nextest run --tests

# Run with output
cargo nextest run --nocapture

# Run tests matching a pattern
cargo nextest run --filter health
```

### With cargo test

```bash
# Run all tests
cargo test

# Run without database tests
cargo test -- --skip database

# Run specific test
cargo test test_name

# Run tests in a module
cargo test config

# Run with output
cargo test -- --nocapture

# Run doctests
cargo test --doc
```

### Environment Setup

Tests require these environment variables:

```bash
# Database connection
export DATABASE_URL="postgres://postgres:password@localhost:5432/postgres"

# JWT secret for token generation
export JWT_SECRET="test_secret_key"

# Optional: Database password override
export DB_PASSWORD="password"
```

## Code Coverage

### Generate HTML Report

```bash
# Install llvm-cov
cargo install cargo-llvm-cov

# Generate and open HTML report
cargo llvm-cov --html --open

# Generate with nextest
cargo llvm-cov nextest --html --open
```

### Generate Codecov JSON

```bash
# For CI/CD upload
cargo llvm-cov --codecov --output-path codecov.json
```

### Coverage Goals

| Component | Target | Status |
|-----------|--------|--------|
| Config | 90% | ✅ ~95% (27 tests) |
| Docker Trait | 80% | ✅ (2 tests) |
| API Endpoints | 70% | 🔨 In progress |
| WebSocket | 70% | ✅ (12 tests) |
| Database | 70% | ✅ (8 tests) |
| Overall | 70% | 🎯 Goal |

## Writing Tests

### Unit Tests

Add tests inline in the source file:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_validation() {
        let config = Config::default();
        assert!(config.validate().is_ok());
    }

    #[tokio::test]
    async fn test_async_function() {
        let result = async_operation().await;
        assert_eq!(result, expected);
    }
}
```

### Integration Tests

Create files in `tests/api/`:

```rust
use axum_test::TestServer;

#[tokio::test]
async fn test_health_endpoint() {
    let app = create_test_router();
    let server = TestServer::new(app).unwrap();

    let response = server.get("/health").await;
    assert_eq!(response.status_code(), StatusCode::OK);
}
```

### Database Tests

Use `sqlx::test` with fixtures:

```rust
#[sqlx::test(fixtures("users", "container_stats"))]
async fn test_user_query(pool: PgPool) -> sqlx::Result<()> {
    let users: Vec<User> = sqlx::query_as("SELECT * FROM users")
        .fetch_all(&pool)
        .await?;

    assert_eq!(users.len(), 3);
    Ok(())
}
```

### Using Mocks

Use the `MockDockerClient`:

```rust
use crate::lib::docker_trait::MockDockerClient;

#[tokio::test]
async fn test_with_mock_docker() {
    let mock = MockDockerClient::new()
        .with_containers(vec![mock_container()]);

    let containers = mock.list_containers(None).await.unwrap();
    assert_eq!(containers.len(), 1);

    // Verify operations
    assert!(mock.get_operations().contains(&"list_containers".to_string()));
}
```

### Test Helpers

Import test utilities:

```rust
mod helpers;
use helpers::{
    mock_container,
    mock_image,
    generate_test_token_admin,
};

#[test]
fn test_with_helpers() {
    let container = mock_container();
    assert_eq!(container.id.unwrap(), "abc123def456");

    let token = generate_test_token_admin();
    assert!(!token.is_empty());
}
```

## CI/CD Integration

Tests run automatically via GitHub Actions on:
- Push to `main`, `develop`, or `feature/*` branches
- Pull requests to `main`

### Workflow Jobs

1. **Test Suite** (Ubuntu + PostgreSQL)
   - Format check
   - Clippy linting
   - All tests with nextest
   - Doctests
   - Coverage generation
   - Codecov upload

2. **Cross-Platform Tests** (macOS, Windows)
   - Unit tests only (no database)

3. **Security Audit**
   - Dependency vulnerability scanning

See `.github/workflows/rust-test.yml` for details.

## Troubleshooting

### Database Connection Errors

```bash
# Check PostgreSQL is running
docker-compose up -d postgres

# Or start manually
docker run -d \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:15

# Verify connection
psql -h localhost -U postgres -d postgres
```

### JWT Token Errors

```bash
# Ensure JWT_SECRET is set
export JWT_SECRET="test_secret_key"

# Or add to .env file
echo "JWT_SECRET=test_secret_key" >> .env
```

### Compilation Errors

```bash
# Clean build artifacts
cargo clean

# Rebuild
cargo build

# Update dependencies
cargo update
```

### Test Isolation Issues

Database tests use `sqlx::test` which provides automatic isolation:
- Each test runs in its own transaction
- Changes are rolled back after test completes
- No cleanup code needed

### Coverage Not Generated

```bash
# Install LLVM tools
rustup component add llvm-tools-preview

# Verify installation
cargo llvm-cov --version

# Try with verbose output
cargo llvm-cov --html --verbose
```

## Best Practices

### DO ✅

- Use `cargo-nextest` for faster test execution
- Write descriptive test names: `test_validate_zero_port`
- Test error cases, not just happy paths
- Use fixtures for complex database setup
- Mock external dependencies (Docker, network)
- Keep tests independent and isolated
- Use `pretty_assertions` for better failure messages

### DON'T ❌

- Don't share state between tests
- Don't rely on test execution order
- Don't skip cleanup (use `sqlx::test` for auto cleanup)
- Don't hardcode credentials (use env vars)
- Don't test external services directly (use mocks)
- Don't ignore warnings from Clippy

### Performance Tips

- Use `cargo nextest run` instead of `cargo test` (2-3x faster)
- Run tests in parallel (nextest default behavior)
- Use `--filter` to run subset of tests during development
- Cache dependencies in CI (see GitHub Actions workflow)

### Code Coverage Tips

- Aim for 70%+ overall coverage
- 90%+ for critical paths (auth, validation)
- Use `cargo llvm-cov --ignore-filename-regex` to exclude generated code
- Review coverage reports regularly: `cargo llvm-cov --html --open`

## Additional Resources

- [Cargo Nextest Docs](https://nexte.st/)
- [Cargo LLVM-Cov](https://github.com/taiki-e/cargo-llvm-cov)
- [SQLx Testing Guide](https://docs.rs/sqlx/latest/sqlx/attr.test.html)
- [Axum Test Docs](https://docs.rs/axum-test/latest/axum_test/)
- [Rust Testing Book](https://doc.rust-lang.org/book/ch11-00-testing.html)

## Contributing

When adding new features:

1. Write tests first (TDD approach)
2. Ensure all tests pass: `cargo nextest run`
3. Check coverage: `cargo llvm-cov --html --open`
4. Run linter: `cargo clippy`
5. Format code: `cargo fmt`

## License

Same as main project.
