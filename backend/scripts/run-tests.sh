#!/usr/bin/env bash
#
# Run backend tests with optional database setup
#
# Usage:
#   ./scripts/run-tests.sh              # Run all tests (skip DB tests if no DATABASE_URL)
#   ./scripts/run-tests.sh --with-db    # Start test DB and run all tests
#   ./scripts/run-tests.sh --unit       # Run only unit tests
#   ./scripts/run-tests.sh --integration # Run only integration tests
#   ./scripts/run-tests.sh --coverage   # Run tests with coverage report

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

print_header() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Set test environment variables
setup_env() {
    if [ "${WITH_DB:-false}" = "true" ]; then
        export DATABASE_URL="${DATABASE_URL:-postgres://test_user:test_password@localhost:5433/docker_manager_test}"
    fi
    export JWT_SECRET="${JWT_SECRET:-test_secret_key}"
    export RUST_BACKTRACE="${RUST_BACKTRACE:-1}"
}

# Check for sqlx-cli
check_sqlx_cli() {
    if ! command -v sqlx &> /dev/null; then
        print_warn "sqlx-cli not installed - database fixture tests will be skipped"
        echo "  To enable all 52 tests, install with:"
        echo "  cargo install sqlx-cli --no-default-features --features postgres"
        echo ""
        return 1
    else
        print_info "sqlx-cli detected - all database tests will run"
        return 0
    fi
}

# Start test database
start_test_db() {
    print_info "Starting test database..."
    ./scripts/start-test-db.sh start
}

# Run unit tests
run_unit_tests() {
    print_header "Running Unit Tests"
    cargo test \
        --color=always \
        -- \
        lib:: \
        --nocapture
}

# Run integration tests without database
run_integration_tests_no_db() {
    print_header "Running Integration Tests (without database)"
    cargo test \
        --color=always \
        --test integration_tests \
        -- \
        --skip database \
        --nocapture
}

# Run all integration tests (with database)
run_integration_tests_with_db() {
    print_header "Running Integration Tests (with database)"
    cargo test \
        --color=always \
        --test integration_tests \
        -- \
        --nocapture
}

# Run all tests
run_all_tests() {
    if [ "${WITH_DB:-false}" = "true" ]; then
        print_header "Running All Tests (with database)"
        cargo test --color=always -- --nocapture
    else
        print_header "Running All Tests (without database)"
        cargo test --color=always -- --skip database --nocapture
    fi
}

# Run tests with coverage
run_coverage() {
    print_header "Running Tests with Coverage"

    # Check if cargo-llvm-cov is installed
    if ! command -v cargo-llvm-cov &> /dev/null; then
        print_warn "cargo-llvm-cov not found. Installing..."
        cargo install cargo-llvm-cov
    fi

    if [ "${WITH_DB:-false}" = "true" ]; then
        cargo llvm-cov --all-features --workspace --html --open
    else
        cargo llvm-cov --all-features --workspace --html --open -- --skip database
    fi
}

# Check for nextest and offer to use it
check_nextest() {
    if command -v cargo-nextest &> /dev/null; then
        print_info "Using cargo-nextest for faster test execution"
        return 0
    else
        print_warn "cargo-nextest not installed (optional, but faster)"
        echo "  Install with: cargo install cargo-nextest"
        return 1
    fi
}

# Run with nextest if available
run_with_nextest() {
    if [ "${WITH_DB:-false}" = "true" ]; then
        cargo nextest run --color=always --all-features
    else
        cargo nextest run --color=always --all-features --filter-expr 'not test(database)'
    fi
}

# Print summary
print_summary() {
    echo ""
    print_header "Test Summary"
    echo "  Test Mode: ${TEST_MODE}"
    if [ "${WITH_DB:-false}" = "true" ]; then
        echo "  Database:  Enabled (DATABASE_URL set)"
    else
        echo "  Database:  Disabled (skipping database tests)"
    fi
    echo "  JWT_SECRET: ${JWT_SECRET:0:20}..."
    echo ""
}

# Main script
main() {
    # Parse arguments
    TEST_MODE="all"
    WITH_DB=false
    USE_COVERAGE=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --with-db)
                WITH_DB=true
                shift
                ;;
            --unit)
                TEST_MODE="unit"
                shift
                ;;
            --integration)
                TEST_MODE="integration"
                shift
                ;;
            --coverage)
                USE_COVERAGE=true
                shift
                ;;
            --nextest)
                # Just for compatibility, we auto-detect nextest
                shift
                ;;
            -h|--help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --with-db      Start test database and run all tests (including database tests)"
                echo "  --unit         Run only unit tests"
                echo "  --integration  Run only integration tests"
                echo "  --coverage     Generate coverage report"
                echo "  -h, --help     Show this help message"
                echo ""
                echo "Examples:"
                echo "  $0                    # Run all tests, skip database tests"
                echo "  $0 --with-db          # Start DB and run all tests"
                echo "  $0 --unit             # Run only unit tests"
                echo "  $0 --with-db --coverage  # Run all tests with coverage"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                echo "Run '$0 --help' for usage information"
                exit 1
                ;;
        esac
    done

    # Setup environment
    setup_env

    # Start database if requested
    if [ "$WITH_DB" = "true" ]; then
        start_test_db
        echo ""
        # Check for sqlx-cli
        check_sqlx_cli
    fi

    # Print summary
    print_summary

    # Run tests based on mode
    if [ "$USE_COVERAGE" = "true" ]; then
        run_coverage
    else
        # Check for nextest
        HAS_NEXTEST=false
        if check_nextest; then
            HAS_NEXTEST=true
        fi
        echo ""

        case $TEST_MODE in
            unit)
                run_unit_tests
                ;;
            integration)
                if [ "$WITH_DB" = "true" ]; then
                    run_integration_tests_with_db
                else
                    run_integration_tests_no_db
                fi
                ;;
            all)
                if [ "$HAS_NEXTEST" = "true" ]; then
                    run_with_nextest
                else
                    run_all_tests
                fi
                ;;
        esac
    fi

    # Print results
    echo ""
    if [ $? -eq 0 ]; then
        print_header "✅ All Tests Passed!"
    else
        print_header "❌ Some Tests Failed"
        exit 1
    fi
}

main "$@"
