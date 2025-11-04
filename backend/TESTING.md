# Docker Manager Backend - Complete Testing Guide

**Last Updated**: November 2024
**Status**: Production-ready with 54 passing tests

## Table of Contents

- [Quick Start](#quick-start)
- [Current Status](#current-status)
- [Testing Architecture](#testing-architecture)
- [Running Tests](#running-tests)
- [Test Database Management](#test-database-management)
- [Writing Tests](#writing-tests)
- [Code Coverage](#code-coverage)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

---

## Quick Start

### First Time Setup (2 minutes)

```bash
# 1. Install sqlx-cli (one-time, enables all 54 tests)
cargo install sqlx-cli --no-default-features --features postgres

# 2. Run all tests with automatic database setup
./scripts/run-tests.sh --with-db
```

That's it! The script automatically:
- ✅ Starts PostgreSQL in Docker (port 5433)
- ✅ Creates test database
- ✅ Runs migrations
- ✅ Executes all 54 tests
- ✅ Shows results

### Daily Usage

```bash
# Quick test
./scripts/run-tests.sh

# Full test suite
./scripts/run-tests.sh --with-db

# Just unit tests (fastest)
./scripts/run-tests.sh --unit

# Generate coverage report
./scripts/run-tests.sh --coverage --with-db
```

---

## Current Status

### Test Coverage Details

**Unit Tests (29 tests)** - `src/lib/config.rs`, `src/lib/docker_trait.rs`
- Configuration validation (all edge cases)
- Default value verification
- Log level parsing
- Server address parsing
- Docker client trait abstraction
- Mock implementations

**Integration Tests (16 tests)** - `tests/api/`
- Health check endpoints (3 tests)
- WebSocket channel communication (12 tests)
- Message broadcasting
- Concurrent operations
- Timeout handling
- Test helper utilities (1 test)

**Database Tests (8 tests)** - `tests/api/database_tests.rs`
- Basic connectivity
- Table existence verification
- Query with fixtures
- Specific user queries
- Multiple fixture loading
- Stats aggregation
- Insert and query
- Transaction isolation

### Requirements

**Minimum (44 tests - no database)**:
- Rust/Cargo
- Docker (for test database script)

**Full Suite (54 tests - includes database)**:
- Rust/Cargo
- Docker (for test database)
- **sqlx-cli** (one-time install):
  ```bash
  cargo install sqlx-cli --no-default-features --features postgres
  ```

**Optional (recommended for faster tests)**:
- cargo-nextest: `cargo install cargo-nextest`
- cargo-llvm-cov: `cargo install cargo-llvm-cov`

---

## Testing Architecture

### Testing Stack

- **cargo-nextest**: Modern test runner (2-3x faster than cargo test)
- **cargo-llvm-cov**: Code coverage tool with Codecov integration
- **tokio::test**: Async test runtime
- **axum-test**: HTTP endpoint testing for Axum
- **sqlx::test**: Database testing with automatic isolation and fixtures

### File Structure

```
backend/
├── src/
│   └── lib/
│       ├── config.rs              # 27 unit tests
│       ├── docker_trait.rs        # 2 tests + MockDockerClient
│       └── ...
├── tests/
│   ├── api/
│   │   ├── health_tests.rs        # 3 HTTP endpoint tests
│   │   ├── database_tests.rs      # 8 database tests
│   │   ├── websocket_tests.rs     # 12 WebSocket/channel tests
│   │   └── fixtures/              # SQL test data
│   │       ├── users              # 3 test users
│   │       ├── container_stats    # 5 container metrics
│   │       └── system_stats       # 3 system metrics
│   ├── helpers/
│   │   └── mod.rs                 # Test utilities (JWT, mocks)
│   └── integration_tests.rs       # Entry point
├── migrations/
│   └── 20241102000001_initial_schema.sql  # Database schema
├── scripts/
│   ├── start-test-db.sh           # Database management
│   └── run-tests.sh               # Intelligent test runner
└── TESTING_COMPLETE_GUIDE.md      # This file
```

### Key Infrastructure Components

**1. Docker Trait Abstraction** (`src/lib/docker_trait.rs`)
- Testable interface for Docker client
- `MockDockerClient` for testing
- Operation tracking for verification
- Zero-cost abstraction

**2. Test Fixtures** (`tests/api/fixtures/`)
- Pre-defined test data in SQL format
- Automatically loaded by sqlx::test
- 3 users (admin, operator, viewer)
- Container and system stats

**3. Migrations** (`migrations/`)
- Automatic schema setup
- Complete database initialization
- Tables: users, container_stats, system_stats

**4. Test Helpers** (`tests/helpers/`)
- JWT token generators (admin, operator, viewer)
- Mock data builders (containers, images, volumes, networks)
- Reusable test utilities

### How Database Tests Work

The database tests use `sqlx::test`, which provides automatic isolation:

1. **Before Each Test**:
   - Creates a fresh temporary database
   - Runs migrations from `migrations/` directory
   - Loads specified fixtures (e.g., `fixtures/users`)

2. **During Test**:
   - Test has exclusive access to the database
   - All changes are tracked in a transaction

3. **After Test**:
   - Database is automatically dropped
   - No cleanup code needed
   - Complete isolation from other tests

**Example**:
```rust
#[sqlx::test(fixtures("fixtures/users"))]
async fn test_query_with_fixtures(pool: PgPool) -> sqlx::Result<()> {
    // Automatic:
    // - Fresh database created
    // - Migrations run
    // - Fixtures loaded (3 users)

    let result: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users")
        .fetch_one(&pool)
        .await?;

    assert_eq!(result.0, 3);
    Ok(())

    // Database automatically dropped after test
}
```

---

### Environment Variables

Tests require these environment variables (automatically set by `run-tests.sh`):

```bash
# Database connection (for database tests)
export DATABASE_URL="postgres://test_user:test_password@localhost:5433/docker_manager_test"

# JWT secret for token generation
export JWT_SECRET="test_secret_key"

# Optional: Rust backtrace
export RUST_BACKTRACE="1"
```

---

## Test Database Management

The `start-test-db.sh` script manages a PostgreSQL test database in Docker.

### Commands

```bash
# Start database (with auto-migrations)
./scripts/start-test-db.sh

# Check status
./scripts/start-test-db.sh status

# View logs
./scripts/start-test-db.sh logs

# Connect with psql
./scripts/start-test-db.sh psql

# Restart (re-runs migrations)
./scripts/start-test-db.sh restart

# Stop database
./scripts/start-test-db.sh stop

# Remove completely
./scripts/start-test-db.sh clean
```

### Database Details

When you start the database, connection information is displayed:

```
Host:     localhost
Port:     5433
Database: docker_manager_test
User:     test_user
Password: test_password

Connection String:
postgres://test_user:test_password@localhost:5433/docker_manager_test
```

**Why port 5433?** To avoid conflicts with production databases on port 5432.

### Automatic Features

The script automatically:
1. Checks if Docker is running
2. Creates Docker container `docker-manager-test-db`
3. Initializes database schema
4. Runs sqlx migrations (if sqlx-cli is installed)
5. Shows helpful warnings if tools are missing

### Manual psql Access

```bash
# Via script
./scripts/start-test-db.sh psql

# Or directly
psql -h localhost -p 5433 -U test_user -d docker_manager_test
# Password: test_password
```

---

## Writing Tests

### Unit Tests

Add tests inline in source files:

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

**Location**: Same file as the code being tested (e.g., `src/lib/config.rs`)

### Integration Tests

Create files in `tests/api/`:

```rust
use axum_test::TestServer;
use http::StatusCode;

#[tokio::test]
async fn test_health_endpoint() {
    let app = create_test_router();
    let server = TestServer::new(app).unwrap();

    let response = server.get("/health").await;
    assert_eq!(response.status_code(), StatusCode::OK);
}
```

**Location**: `tests/api/*.rs`

### Database Tests

Use `sqlx::test` with fixtures:

```rust
use sqlx::PgPool;

#[sqlx::test]
async fn test_basic_connectivity(pool: PgPool) -> sqlx::Result<()> {
    let result: (i64,) = sqlx::query_as("SELECT 1")
        .fetch_one(&pool)
        .await?;
    assert_eq!(result.0, 1);
    Ok(())
}

#[sqlx::test(fixtures("fixtures/users"))]
async fn test_with_fixtures(pool: PgPool) -> sqlx::Result<()> {
    let users: Vec<User> = sqlx::query_as("SELECT * FROM users")
        .fetch_all(&pool)
        .await?;

    assert_eq!(users.len(), 3);  // Fixture loads 3 users
    Ok(())
}

#[sqlx::test(fixtures("fixtures/users", "fixtures/container_stats"))]
async fn test_multiple_fixtures(pool: PgPool) -> sqlx::Result<()> {
    // Both fixtures are loaded
    let user_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users")
        .fetch_one(&pool).await?;
    let stats_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM container_stats")
        .fetch_one(&pool).await?;

    assert_eq!(user_count.0, 3);
    assert_eq!(stats_count.0, 5);
    Ok(())
}
```

**Location**: `tests/api/database_tests.rs`

### WebSocket/Channel Tests

Test async channels and message broadcasting:

```rust
use tokio::sync::broadcast;
use tokio::time::{Duration, timeout};
use serde_json::Value;

#[tokio::test]
async fn test_broadcast_to_multiple_receivers() {
    let (tx, mut rx1) = broadcast::channel(16);
    let mut rx2 = tx.subscribe();

    tx.send("broadcast_message").unwrap();

    assert_eq!(rx1.recv().await.unwrap(), "broadcast_message");
    assert_eq!(rx2.recv().await.unwrap(), "broadcast_message");
}

#[tokio::test]
async fn test_json_message_serialization() {
    let (tx, mut rx) = broadcast::channel::<Value>(16);

    let message = serde_json::json!({
        "type": "container_stats",
        "data": {
            "container_id": "abc123",
            "cpu_usage": 25.5
        }
    });

    tx.send(message.clone()).unwrap();
    let received = rx.recv().await.unwrap();

    assert_eq!(received["type"], "container_stats");
    assert_eq!(received["data"]["container_id"], "abc123");
}
```

**Location**: `tests/api/websocket_tests.rs`

### Using Test Helpers

Import and use helper utilities:

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

**Available Helpers** (`tests/helpers/mod.rs`):
- `mock_container()` - Create test ContainerSummary
- `mock_image()` - Create test ImageSummary
- `mock_volume()` - Create test Volume
- `mock_network()` - Create test Network
- `generate_test_token_admin()` - JWT for admin user
- `generate_test_token_operator()` - JWT for operator user
- `generate_test_token_viewer()` - JWT for viewer user

### Using MockDockerClient

Test Docker operations without real Docker:

```rust
use crate::lib::docker_trait::MockDockerClient;

#[tokio::test]
async fn test_with_mock_docker() {
    let mock = MockDockerClient::new()
        .with_containers(vec![mock_container()]);

    let containers = mock.list_containers(None).await.unwrap();
    assert_eq!(containers.len(), 1);

    // Verify operations were called
    assert!(mock.get_operations().contains(&"list_containers".to_string()));
}
```

---

## Code Coverage

### Generate Coverage Reports

```bash
# Install llvm-cov (one-time)
cargo install cargo-llvm-cov

# HTML report (opens in browser)
./scripts/run-tests.sh --coverage --with-db

# Or manually
cargo llvm-cov --all-features --workspace --html --open

# Codecov JSON (for CI/CD)
cargo llvm-cov --all-features --workspace --codecov --output-path codecov.json

# With nextest (faster)
cargo llvm-cov nextest --all-features --workspace --html --open
```

### Coverage Goals

| Component | Target | Current Status |
|-----------|--------|----------------|
| Config | 90% | ✅ ~95% (27 tests) |
| Docker Trait | 80% | ✅ (2 tests) |
| API Endpoints | 70% | 🔨 In progress |
| WebSocket | 70% | ✅ (12 tests) |
| Database | 70% | ✅ (8 tests) |
| **Overall** | **70%** | 🎯 Goal |

---

## CI/CD Integration

Tests run automatically via GitHub Actions on:
- Push to `main`, `develop`, or `feature/*` branches
- Pull requests to `main`

### Workflow Jobs

**1. Test Suite** (Ubuntu + PostgreSQL)
- Format check (`cargo fmt`)
- Clippy linting (`cargo clippy`)
- All tests with nextest
- Doctests
- Coverage generation
- Codecov upload

**2. Cross-Platform Tests** (macOS, Windows)
- Unit tests only (no database)

**3. Security Audit**
- Dependency vulnerability scanning

See `.github/workflows/rust-test.yml` for details.

### CI Configuration

The workflow uses:
- PostgreSQL service container
- Rust dependency caching (`Swatinem/rust-cache`)
- Fast tool installation (`taiki-e/install-action`)
- Parallel test execution
- Coverage reports to Codecov

---

## Troubleshooting

### Tests Fail: "DATABASE_URL must be set"

**Solution**: Run with database setup:
```bash
./scripts/run-tests.sh --with-db
```

Or skip database tests:
```bash
./scripts/run-tests.sh
```

### Database Won't Start

**Check Docker is running**:
```bash
docker info
```

**Check port 5433**:
```bash
lsof -i :5433
```

**Clean restart**:
```bash
./scripts/start-test-db.sh clean
./scripts/start-test-db.sh
```

### Missing sqlx-cli

**Symptom**: Database tests are skipped with warning

**Solution**: Install sqlx-cli:
```bash
cargo install sqlx-cli --no-default-features --features postgres
```

Then restart database to run migrations:
```bash
./scripts/start-test-db.sh restart
```

### Tests Can't Connect to Database

**Verify database is running**:
```bash
./scripts/start-test-db.sh status
```

**Check connection manually**:
```bash
psql -h localhost -p 5433 -U test_user -d docker_manager_test
# Password: test_password
```

**Check environment variable**:
```bash
echo $DATABASE_URL
# Should be: postgres://test_user:test_password@localhost:5433/docker_manager_test
```

### Database Has Stale Data

**Solution**: Clean restart creates fresh database:
```bash
./scripts/start-test-db.sh clean
./scripts/start-test-db.sh
```

### Tests Are Slow

**Solution**: Install cargo-nextest for 2-3x faster execution:
```bash
cargo install cargo-nextest
./scripts/run-tests.sh  # Auto-detects and uses nextest
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

### Coverage Not Generated

```bash
# Install LLVM tools
rustup component add llvm-tools-preview

# Verify installation
cargo llvm-cov --version

# Try with verbose output
cargo llvm-cov --html --verbose
```

---

## Best Practices

### DO ✅

- **Use the test scripts** - They handle everything automatically
- **Run tests frequently** - Fast feedback loop with `./scripts/run-tests.sh`
- **Write descriptive test names** - `test_validate_zero_port` not `test1`
- **Test error cases** - Not just happy paths
- **Use fixtures** for complex database setup
- **Mock external dependencies** - Docker, network calls
- **Keep tests independent** - No shared state
- **Use `pretty_assertions`** - Better failure messages
- **Install cargo-nextest** - 2-3x faster tests
- **Generate coverage regularly** - `./scripts/run-tests.sh --coverage --with-db`

### DON'T ❌

- **Don't share state between tests** - Each test should be isolated
- **Don't rely on test execution order** - Tests should be independent
- **Don't skip cleanup** - Use sqlx::test for auto cleanup
- **Don't hardcode credentials** - Use env vars or helpers
- **Don't test external services directly** - Use mocks
- **Don't ignore warnings** - Run `cargo clippy` regularly
- **Don't commit with failing tests** - Always run `./scripts/run-tests.sh --with-db`

### Performance Tips

- Use `cargo nextest run` instead of `cargo test` (2-3x faster)
- Run tests in parallel (nextest default)
- Use `--filter` for subset during development:
  ```bash
  cargo nextest run config      # Just config tests
  cargo nextest run health      # Tests matching "health"
  ```
- Keep database running between test runs:
  ```bash
  ./scripts/start-test-db.sh    # Once
  cargo test                     # Many times
  ```
