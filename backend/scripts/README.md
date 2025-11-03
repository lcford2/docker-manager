# Test Scripts

Convenient scripts for managing the test database and running tests.

## Scripts Overview

| Script | Purpose |
|--------|---------|
| `start-test-db.sh` | Manage test PostgreSQL database |
| `run-tests.sh` | Run tests with optional database setup |

## Quick Start

```bash
# Start test database and run all tests
./scripts/run-tests.sh --with-db

# Just start the database (for manual testing)
./scripts/start-test-db.sh
```

## start-test-db.sh

Manages a PostgreSQL 15 database in a Docker container for testing.

### Usage

```bash
./scripts/start-test-db.sh [COMMAND]
```

### Commands

| Command | Description |
|---------|-------------|
| `start` (default) | Start or create the test database |
| `stop` | Stop the test database |
| `clean` | Stop and remove the database container |
| `restart` | Restart the database |
| `status` | Show database status and connection info |
| `logs` | View database logs (follow mode) |
| `psql` | Connect to database with psql |

### Examples

```bash
# Start the database
./scripts/start-test-db.sh

# Check if it's running
./scripts/start-test-db.sh status

# View logs
./scripts/start-test-db.sh logs

# Connect with psql
./scripts/start-test-db.sh psql

# Stop when done
./scripts/start-test-db.sh stop

# Remove completely
./scripts/start-test-db.sh clean
```

### Connection Details

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

### Schema Initialization

The script automatically:
1. Creates `users` table
2. Creates `container_stats` table
3. Creates `system_stats` table
4. Creates necessary indexes
5. Runs any SQL files from `../../database/` if they exist

## run-tests.sh

Runs backend tests with optional automatic database setup.

### Usage

```bash
./scripts/run-tests.sh [OPTIONS]
```

### Options

| Option | Description |
|--------|-------------|
| `--with-db` | Start test database and run all tests (including database tests) |
| `--unit` | Run only unit tests |
| `--integration` | Run only integration tests |
| `--coverage` | Generate coverage report with cargo-llvm-cov |
| `-h, --help` | Show help message |

### Examples

```bash
# Run all tests, skip database tests
./scripts/run-tests.sh

# Start DB and run ALL tests (including database tests)
./scripts/run-tests.sh --with-db

# Run only unit tests
./scripts/run-tests.sh --unit

# Run only integration tests (no database)
./scripts/run-tests.sh --integration

# Run integration tests with database
./scripts/run-tests.sh --integration --with-db

# Generate coverage report
./scripts/run-tests.sh --coverage --with-db

# Just unit tests (fastest)
./scripts/run-tests.sh --unit
```

### Features

- ✅ Automatic environment variable setup
- ✅ Colored output for better readability
- ✅ Auto-detects and uses `cargo-nextest` if installed
- ✅ Automatic test database startup with `--with-db`
- ✅ Coverage report generation with `--coverage`
- ✅ Clear test summary at the end

### Environment Variables

The script automatically sets:

```bash
DATABASE_URL="postgres://test_user:test_password@localhost:5433/docker_manager_test"  # when --with-db
JWT_SECRET="test_secret_key"
RUST_BACKTRACE="1"
```

You can override these by setting them before running the script.

## Typical Workflows

### Development Workflow

```bash
# 1. Start database once
./scripts/start-test-db.sh

# 2. Run tests as you develop (database stays running)
cargo test

# Or use the script
./scripts/run-tests.sh --with-db

# 3. When done, stop database
./scripts/start-test-db.sh stop
```

### CI/CD Workflow

```bash
# One command to rule them all
./scripts/run-tests.sh --with-db --coverage
```

### Quick Testing Workflow

```bash
# No database needed
./scripts/run-tests.sh

# Or just unit tests (fastest)
./scripts/run-tests.sh --unit
```

## Troubleshooting

### Database won't start

```bash
# Check Docker is running
docker info

# Check if port 5433 is in use
lsof -i :5433

# Clean up and try again
./scripts/start-test-db.sh clean
./scripts/start-test-db.sh
```

### Tests can't connect to database

```bash
# Verify database is running
./scripts/start-test-db.sh status

# Check connection manually
psql -h localhost -p 5433 -U test_user -d docker_manager_test

# Check environment variable
echo $DATABASE_URL
```

### Database has stale data

```bash
# Clean restart
./scripts/start-test-db.sh clean
./scripts/start-test-db.sh
```

## Notes

- The test database uses **port 5433** to avoid conflicts with production databases on port 5432
- The container is named `docker-manager-test-db` for easy identification
- Each test run with `sqlx::test` gets automatic transaction isolation
- The database schema is auto-initialized on first start
- Database data persists between `stop` and `start` (use `clean` to remove)

## See Also

- [Test Suite Documentation](../tests/README.md) - Comprehensive testing guide
- [Database Fixtures](../tests/fixtures/) - Test data SQL files
- [Integration Tests](../tests/api/) - Integration test examples
