# Docker Manager - Configuration Guide

## Overview

Docker Manager uses a **unified configuration system**. The system automatically calculates derived values to maintain proper relationships while keeping configuration simple.

---

## Configuration Sections

### `[server]`

```toml
[server]
host = "127.0.0.1"
port = 3010
```

---

### `[database]`

```toml
[database]
host = "127.0.0.1"
port = 5432
database_name = "docker_manager"
username = "docker_manager"
# password from DB_PASSWORD env var
```

---

### `[retention]`

```toml
[retention]
stats_retention_hours = 24
```

Controls how long historical data is kept. Older data is automatically deleted.

---

### `[limits]`

```toml
[limits]
default_query_limit = 100      # Default records returned
max_query_limit = 500          # Hard cap to prevent abuse
default_history_minutes = 30   # Time window for queries
```

**Auto-calculated:**

- `sparkline_points` = `(default_history_minutes * 60) / collection_interval`
  - At 30 min with 30s collection = 60 points

---

### `[workers]`

```toml
[workers]
container_stats_interval = 30  # Seconds
system_info_interval = 15      # Seconds
```

How often background workers collect data.

**Tuning:**

- Lower = more accurate, higher resource usage
- Higher = less resource usage, less granular data

---

### `[websocket]`

```toml
[websocket]
broadcast_interval = 3         # Base broadcast interval (seconds)
ping_interval = 30000          # Keepalive ping (milliseconds)
stale_timeout = 60000          # Connection stale detection (milliseconds)
max_reconnect_attempts = 10    # Max reconnection tries
```

**Auto-calculated:**

- `container_broadcast_interval` = `broadcast_interval` (3s)
- `system_broadcast_interval` = `broadcast_interval * 1.5` (4.5s)
- `stale_check_interval` = `stale_timeout` (60s)
- `reconnect_base_delay` = 2000ms
- `reconnect_max_delay` = 120000ms
- `reconnect_jitter` = 1000ms
- `status_update_interval` = 1000ms

---

### `[auth]`

```toml
[auth]
jwt_expiration_hours = 24
# jwt_secret from JWT_SECRET env var
```

**Security:** JWT secret MUST be in `JWT_SECRET` environment variable.

---

### `[cache]`

```toml
[cache]
default_ttl = 5000        # Fast-changing resources (milliseconds)
slow_resource_ttl = 20000 # Slow-changing resources (milliseconds)
retry_attempts = 3        # All resources
```

**Resource Mapping:**

**Fast-changing** (uses `default_ttl`):

- Containers
- Metrics
- Networks
- System info

**Slow-changing** (uses `slow_resource_ttl`):

- Images
- Volumes

**Auto-calculated:**

- `cleanup_interval` = `default_ttl * 6` (30s)
- All retry counts = `retry_attempts` (3)

---

### `[ui]`

```toml
[ui]
max_chart_data_points = 60
```

**Auto-calculated:**

- `drawer_width` = 240px (hardcoded)

---

### `[logging]`

```toml
[logging]
level = "info"    # trace, debug, info, warn, error
format = "simple" # simple, json
```

---

## Auto-Calculated Values Summary

| Base Parameter                                         | Derived Values                                                     | Formula/Logic               |
| ------------------------------------------------------ | ------------------------------------------------------------------ | --------------------------- |
| `broadcast_interval`                                   | `container_broadcast_interval`                                     | Same value                  |
|                                                        | `system_broadcast_interval`                                        | `broadcast_interval * 1.5`  |
| `stale_timeout`                                        | `stale_check_interval`                                             | Same value                  |
| `default_ttl`                                          | `containers_ttl`, `metrics_ttl`, `networks_ttl`, `system_info_ttl` | Same value                  |
|                                                        | `cleanup_interval`                                                 | `default_ttl * 6`           |
| `slow_resource_ttl`                                    | `images_ttl`, `volumes_ttl`                                        | Same value                  |
| `retry_attempts`                                       | All retry counts                                                   | Same value                  |
| `default_query_limit`                                  | `container_stats_default`, `system_stats_default`                  | Same value                  |
| `default_history_minutes` + `container_stats_interval` | `sparkline_points`                                                 | `(minutes * 60) / interval` |

**Hardcoded defaults:**

- Reconnection delays (2s, 120s, 1s jitter)
- Status update interval (1s)
- Drawer width (240px)

---

## Environment Variable Overrides

Any value can be overridden:

```bash
APP_SERVER_PORT=8080
APP_CACHE_DEFAULT_TTL=10000
APP_WEBSOCKET_BROADCAST_INTERVAL=5
```

Format: `APP_<SECTION>_<KEY>=value`

---

## Validation Rules

On startup, configuration is validated:

- All intervals must be > 0
- Ports must be > 0
- Limits must be >= 1
- JWT expiration must be > 0
- Retention must be >= 1 hour

Invalid configuration prevents startup with clear error message.
