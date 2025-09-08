# Docker Manager - Simplified Backend

A simplified version of the Docker Manager backend with ~80% less code while maintaining core functionality.

## Architecture Comparison

### Original Backend (27 files, 5,100+ lines):
- Complex database access coordination
- Circuit breakers and sophisticated error handling
- Multiple service layers and abstractions
- Comprehensive caching with Redis + memory cache
- Full user management system
- Enterprise-level connection pooling
- Background task health monitoring
- Retention service with batch processing

### Simplified Backend (6 files, ~800 lines):
- Direct database operations (no coordination needed for small scale)
- Simple error handling and retries
- Single service layer
- Basic Redis pub/sub for WebSocket broadcasting
- Simple token-based auth (no user management)
- Standard connection pool
- Simple background tasks
- Basic cleanup every hour

## Files Overview

- `main.py` (300 lines) - FastAPI app, WebSocket endpoint, routes
- `docker_stats.py` (250 lines) - Docker API integration, data collection
- `models.py` (80 lines) - SQLAlchemy models and database setup
- `auth.py` (60 lines) - Simple token-based authentication
- `requirements.txt` (10 lines) - Dependencies
- `Dockerfile` (20 lines) - Container configuration

## Key Simplifications

1. **Database**: No read/write coordination - not needed for few clients
2. **Authentication**: Simple admin user only, no user registration/management
3. **Caching**: Simple in-memory cache with Redis pub/sub only
4. **Error Handling**: Basic retries, no circuit breakers
5. **Background Tasks**: Two simple loops (collection + cleanup)
6. **API**: Essential endpoints only (containers, system info, WebSocket)

## Running the Simplified Version

```bash
# Use the simplified docker-compose file
docker-compose -f docker-compose-simple.yml up --build

# Access the API at http://localhost:6501
# Frontend at http://localhost:3051
```

## API Endpoints

- `GET /api/health` - Health check
- `POST /api/auth/login` - Login (username: admin, password: admin123)
- `GET /api/containers` - Get container stats
- `GET /api/system/info` - Get system information
- `GET /api/containers/{id}/history` - Get container history
- `WebSocket /api/ws/connect?token=<token>` - Real-time updates

## Performance for Small Scale

This simplified version is perfectly suitable for:
- 1-5 concurrent frontend clients
- Personal/development Docker monitoring
- Small team deployments
- Learning and experimentation

The original complex version would be needed for:
- 50+ concurrent clients
- Enterprise deployments
- High availability requirements
- Complex permission systems
