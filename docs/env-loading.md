# Environment Variable Loading Guide

## Overview

Docker Manager uses environment variables for sensitive configuration (JWT secrets, passwords). The `.env` file is loaded **automatically** in both development and production.

## How It Works

### Development Mode (Local)

When running locally with `cargo run`:

```bash
cd backend
cargo run
```

**What happens:**
1. `main.rs` calls `dotenvy::dotenv()` on startup
2. This loads `.env` from the project root
3. All variables become available via `std::env::var()`

**No manual loading needed!** Just create `.env` and run.

---

### Production Mode (Docker)

When running with Docker Compose:

```bash
docker-compose up
```

**What happens:**
1. Docker Compose reads `.env` from project root
2. Variables are passed to containers via `environment:` section
3. Backend receives them as standard environment variables

**No manual loading needed!** Docker Compose handles it automatically.

---

## Both Methods Together

The implementation uses **both** approaches:

```rust
// backend/src/main.rs
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Load .env file if it exists (for development)
    // In production, environment variables are set by docker-compose
    dotenvy::dotenv().ok();

    // ... rest of initialization
}
```

```yaml
# docker-compose.yml
backend:
  environment:
    JWT_SECRET: ${JWT_SECRET}
    DB_PASSWORD: ${DB_PASSWORD}
    # ... other vars
```

**Benefits:**
- ✅ Works in development without Docker
- ✅ Works in Docker without changes
- ✅ Same `.env` file for both
- ✅ No manual steps required

---

## Required Environment Variables

### Backend Requires:

| Variable | Purpose | Example | Required |
|----------|---------|---------|----------|
| `JWT_SECRET` | JWT token signing | Random 32+ char string | ✅ Yes |
| `DB_PASSWORD` | Database password | Secure password | ✅ Yes |
| `RUST_ENV` | Environment mode | `development` or `production` | ⚠️ Optional (default: development) |

### Admin User Setup:

| Variable | Purpose | Default |
|----------|---------|---------|
| `ADMIN_USERNAME` | Initial admin username | `admin` |
| `ADMIN_EMAIL` | Initial admin email | `admin@localhost` |
| `ADMIN_PASSWORD` | Initial admin password | `changeme` |

---

## Creating Your .env File

### Using the init script (Recommended):

```bash
./scripts/init-config.sh
```

This will:
- Copy `.env.example` to `.env`
- Generate a random `JWT_SECRET` automatically
- Prompt you to set other values

### Manually:

```bash
# Copy template
cp .env.example .env

# Generate JWT secret
JWT_SECRET=$(openssl rand -base64 32)

# Edit .env
nano .env
```

Example `.env`:

```bash
JWT_SECRET=xK8mP2vR5nQ9wF3jL7hN4bV6cA1dE0tY2sX8mZ5pU3q=
DB_PASSWORD=my-secure-database-password-2024
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=my-secure-admin-password
RUST_ENV=production
```

---

## Verification

### Check if .env is being loaded:

**Development:**
```bash
cd backend
cargo run
# Should start without "JWT_SECRET must be set" error
```

**Docker:**
```bash
docker-compose up
# Check logs:
docker-compose logs backend | grep -i "jwt\|error"
```
---

## Rotate JWT Secret

Change secrets periodically:
```bash
# rotate secret
./scripts/rotate-jwt.sh

# Restart
docker-compose restart backend
```

**Note:** Users will need to log in again.

---

## Environment Variable Priority

Values are loaded in this order (later overrides earlier):

1. **Hardcoded defaults** (in config.rs)
2. **TOML config files** (config/default.toml, config/production.toml)
3. **TOML user config** (config/config.toml)
4. **.env file** (via dotenvy or docker-compose)
5. **System environment** (manually set `export VAR=value`)
6. **APP_* overrides** (docker-compose or shell)
