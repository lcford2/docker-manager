# Docker Manager Configuration System

## 🎯 Quick Start

```bash
# 1. Initialize configuration
./scripts/init-config.sh

# 2. Edit your settings
vim backend/config/config.toml

# 3. Set your secrets
vim .env

# 4. Start the app
docker compose up -d
```

That's it! All settings are in one simple file.

## 📁 Configuration Files

| File                           | Purpose                             | Example                             |
| ------------------------------ | ----------------------------------- | ----------------------------------- |
| `backend/config/config.toml`   | **Main configuration** - Edit this! | All application settings            |
| `.env`                         | **Secrets only** - Never commit!    | JWT_SECRET, DB_PASSWORD             |
| `backend/config.toml.template` | Template with defaults              | Reference for all available options |

## 🔧 What's Configurable?

### Server & Database

- Server host/port
- Database connection
- Data retention period

### Workers

- Container stats collection interval
- System info collection interval

### WebSocket

- Broadcast interval (system broadcasts automatically 1.5x this)
- Ping interval
- Stale connection timeout
- Max reconnection attempts

### Cache

- Default TTL (fast-changing: containers, metrics, networks, system)
- Slow resource TTL (slow-changing: images, volumes)
- Retry attempts (applies to all resources)

### Query Limits

- Default query limit
- Maximum query limit
- Default history window

### Authentication

- JWT token expiration

### UI

- Max chart data points

### Logging

- Log level
- Log format

## 📝 Example Configuration

```toml
[server]
port = 3010

[workers]
container_stats_interval = 30
system_info_interval = 15

[websocket]
broadcast_interval = 3       # Container broadcasts = 3s, System = 4.5s
ping_interval = 30000

[cache]
default_ttl = 5000           # Used by: containers, metrics, networks, system_info
slow_resource_ttl = 20000    # Used by: images, volumes
retry_attempts = 3           # All resources retry 3 times

[limits]
default_query_limit = 100
max_query_limit = 500
default_history_minutes = 30

[auth]
jwt_expiration_hours = 24

[ui]
max_chart_data_points = 60

[logging]
level = "info"
format = "simple"
```

## 🎨 What Gets Calculated Automatically?

To keep configuration simple, some values are **derived** from base settings:

### From `broadcast_interval`:

- Container broadcast = `broadcast_interval` (3s)
- System broadcast = `broadcast_interval * 1.5` (4.5s → rounds to 5s)

### From `default_ttl`:

- Containers, metrics, networks, system_info all use `default_ttl`
- Cleanup interval = `default_ttl * 6` (30s)

### From `slow_resource_ttl`:

- Images and volumes use `slow_resource_ttl`

### From `retry_attempts`:

- All resources use the same retry count

### From `default_query_limit`:

- Both container stats and system stats queries use same default

### From `default_history_minutes` + `container_stats_interval`:

- Sparkline points = `(history_minutes * 60) / collection_interval`
- Example: (30 min \* 60) / 30s = 60 points

### Hardcoded sensible defaults:

- Reconnection base delay = 2s
- Reconnection max delay = 120s
- Reconnection jitter = 1s
- Status update interval = 1s
- Drawer width = 240px
- Stale check interval = same as stale_timeout

## 🔐 Secrets Management

Secrets are **never** in `config.toml`. They're in `.env`:

```bash
JWT_SECRET=$(openssl rand -base64 32)  # Auto-generated
DB_PASSWORD=your-secure-password
ADMIN_PASSWORD=changeme
```

## 🌍 Environment Overrides

Override any setting with environment variables:

```bash
APP_SERVER_PORT=8080
APP_CACHE_DEFAULT_TTL=10000
docker-compose up
```

Format: `APP_<SECTION>_<KEY>=value`

## 🚀 Common Scenarios

### Production (High Traffic)

```toml
[workers]
container_stats_interval = 15  # More frequent updates

[cache]
default_ttl = 2000  # Fresher data

[limits]
default_history_minutes = 60  # Longer history
```

### Development (Fast Iteration)

```toml
[workers]
container_stats_interval = 5  # Very frequent

[logging]
level = "debug"  # Verbose logs

[cache]
default_ttl = 1000  # Always fresh
```

### Low Resource (Raspberry Pi)

```toml
[workers]
container_stats_interval = 60  # Less frequent

[retention]
stats_retention_hours = 12  # Less history

[cache]
default_ttl = 10000  # Longer cache
slow_resource_ttl = 60000
```

## 📚 Full Documentation

See [`docs/configuration.md`](docs/configuration.md) for:

- Detailed explanation of every setting
- Performance tuning guidelines
- Security best practices
- Troubleshooting guide

See [`docs/env-loading.md`](docs/env-loading.md) for:

- Explanation of how environment variables are loaded
- Information about secret variables
- Recommendations for setting those variables

## 🛠️ Scripts

| Script                   | Purpose                                   |
| ------------------------ | ----------------------------------------- |
| `scripts/init-config.sh` | Initialize config and .env from templates |
| `scripts/rotate-jwt.sh` | Rotate the JWT secret             |
| `scripts/update-user.sh` | Update the username of a user |
