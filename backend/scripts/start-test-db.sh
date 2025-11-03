#!/usr/bin/env bash
#
# Start a test PostgreSQL database for running integration tests
#
# Usage:
#   ./scripts/start-test-db.sh          # Start the database
#   ./scripts/start-test-db.sh stop     # Stop the database
#   ./scripts/start-test-db.sh clean    # Stop and remove the database

set -euo pipefail

# Configuration
CONTAINER_NAME="docker-manager-test-db"
POSTGRES_VERSION="15"
POSTGRES_USER="test_user"
POSTGRES_PASSWORD="test_password"
POSTGRES_DB="docker_manager_test"
HOST_PORT="5433"  # Use 5433 to avoid conflicts with production DB on 5432

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Start the test database
start_db() {
    print_info "Starting test database..."

    # Check if container already exists
    if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
            print_warn "Database container is already running"
            print_connection_info
            return 0
        else
            print_info "Starting existing container..."
            docker start "${CONTAINER_NAME}"
        fi
    else
        print_info "Creating new database container..."
        docker run -d \
            --name "${CONTAINER_NAME}" \
            -e POSTGRES_USER="${POSTGRES_USER}" \
            -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
            -e POSTGRES_DB="${POSTGRES_DB}" \
            -p "${HOST_PORT}:5432" \
            postgres:${POSTGRES_VERSION}
    fi

    # Wait for database to be ready
    print_info "Waiting for database to be ready..."
    for i in {1..30}; do
        if docker exec "${CONTAINER_NAME}" pg_isready -U "${POSTGRES_USER}" > /dev/null 2>&1; then
            print_info "Database is ready!"
            break
        fi
        if [ $i -eq 30 ]; then
            print_error "Database failed to start within 30 seconds"
            exit 1
        fi
        sleep 1
    done

    # Initialize database schema
    print_info "Initializing database schema..."
    initialize_schema

    # Run sqlx migrations if available
    run_migrations

    print_info "Test database started successfully!"
    print_connection_info
}

# Initialize database schema
initialize_schema() {
    # Check if schema files exist
    if [ -f "../../database/init.sql" ]; then
        print_info "Running init.sql..."
        docker exec -i "${CONTAINER_NAME}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" < ../../database/init.sql || true
    fi

    if [ -f "../../database/create_users_table.sql" ]; then
        print_info "Running create_users_table.sql..."
        docker exec -i "${CONTAINER_NAME}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" < ../../database/create_users_table.sql || true
    fi

    # Create tables if they don't exist (minimal schema for tests)
    docker exec -i "${CONTAINER_NAME}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" << 'EOF' || true
-- Create users table if not exists
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create container_stats table if not exists
CREATE TABLE IF NOT EXISTS container_stats (
    id SERIAL PRIMARY KEY,
    container_id VARCHAR(255) NOT NULL,
    container_name VARCHAR(255),
    cpu_usage DOUBLE PRECISION,
    memory_usage BIGINT,
    memory_limit BIGINT,
    network_rx BIGINT,
    network_tx BIGINT,
    block_read BIGINT,
    block_write BIGINT,
    pids INTEGER,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Create system_stats table if not exists
CREATE TABLE IF NOT EXISTS system_stats (
    id SERIAL PRIMARY KEY,
    total_memory BIGINT,
    used_memory BIGINT,
    total_swap BIGINT,
    used_swap BIGINT,
    cpu_count INTEGER,
    cpu_usage DOUBLE PRECISION,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_container_stats_container_id ON container_stats(container_id);
CREATE INDEX IF NOT EXISTS idx_container_stats_timestamp ON container_stats(timestamp);
CREATE INDEX IF NOT EXISTS idx_system_stats_timestamp ON system_stats(timestamp);
EOF

    print_info "Database schema initialized"
}

# Run sqlx migrations
run_migrations() {
    # Check if migrations directory exists
    if [ ! -d "migrations" ]; then
        print_warn "No migrations directory found, skipping sqlx migrations"
        return 0
    fi

    # Check if sqlx-cli is installed
    if ! command -v sqlx &> /dev/null; then
        print_warn "sqlx-cli not installed. Database tests with fixtures will be skipped."
        print_warn "To enable all tests, install with: cargo install sqlx-cli --no-default-features --features postgres"
        return 0
    fi

    print_info "Running sqlx migrations..."

    # Set DATABASE_URL for migrations
    export DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${HOST_PORT}/${POSTGRES_DB}"

    # Create database if it doesn't exist (sqlx migrate needs this)
    sqlx database create 2>/dev/null || true

    # Run migrations
    if sqlx migrate run; then
        print_info "Migrations completed successfully"
    else
        print_warn "Migrations failed or had issues (this is OK if database already has schema)"
    fi
}

# Stop the database
stop_db() {
    print_info "Stopping test database..."
    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        docker stop "${CONTAINER_NAME}"
        print_info "Database stopped"
    else
        print_warn "Database is not running"
    fi
}

# Clean up (stop and remove)
clean_db() {
    print_info "Cleaning up test database..."
    if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        docker stop "${CONTAINER_NAME}" 2>/dev/null || true
        docker rm "${CONTAINER_NAME}"
        print_info "Database removed"
    else
        print_warn "Database container does not exist"
    fi
}

# Print connection information
print_connection_info() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Test Database Connection Info"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Host:     localhost"
    echo "  Port:     ${HOST_PORT}"
    echo "  Database: ${POSTGRES_DB}"
    echo "  User:     ${POSTGRES_USER}"
    echo "  Password: ${POSTGRES_PASSWORD}"
    echo ""
    echo "  Connection String:"
    echo "  postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${HOST_PORT}/${POSTGRES_DB}"
    echo ""
    echo "  Export for tests:"
    echo "  export DATABASE_URL=\"postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${HOST_PORT}/${POSTGRES_DB}\""
    echo "  export JWT_SECRET=\"test_secret_key\""
    echo ""
    echo "  psql command:"
    echo "  psql -h localhost -p ${HOST_PORT} -U ${POSTGRES_USER} -d ${POSTGRES_DB}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
}

# Show status
show_status() {
    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        print_info "Database is running"
        docker ps --filter "name=${CONTAINER_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        print_connection_info
    elif docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        print_warn "Database container exists but is not running"
        echo "Run './scripts/start-test-db.sh' to start it"
    else
        print_warn "Database container does not exist"
        echo "Run './scripts/start-test-db.sh' to create and start it"
    fi
}

# Main script
main() {
    check_docker

    case "${1:-start}" in
        start)
            start_db
            ;;
        stop)
            stop_db
            ;;
        clean)
            clean_db
            ;;
        status)
            show_status
            ;;
        restart)
            stop_db
            sleep 2
            start_db
            ;;
        logs)
            docker logs -f "${CONTAINER_NAME}"
            ;;
        psql)
            docker exec -it "${CONTAINER_NAME}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"
            ;;
        *)
            echo "Usage: $0 {start|stop|clean|restart|status|logs|psql}"
            echo ""
            echo "Commands:"
            echo "  start    - Start the test database (default)"
            echo "  stop     - Stop the test database"
            echo "  clean    - Stop and remove the test database"
            echo "  restart  - Restart the test database"
            echo "  status   - Show database status"
            echo "  logs     - Show database logs"
            echo "  psql     - Connect to database with psql"
            exit 1
            ;;
    esac
}

main "$@"
