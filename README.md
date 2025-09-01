# Docker Manager

A comprehensive web application for managing Docker containers, images, volumes, and networks with real-time monitoring and role-based access control.

## Features

- **Real-time Monitoring**: Live CPU, memory, and network statistics via WebSocket
- **Container Management**: Start, stop, restart containers with detailed inspect views
- **Log Viewing**: Real-time log streaming with filtering capabilities
- **Volume & Image Management**: Inspect volumes and manage Docker images
- **Network Visualization**: View and manage Docker networks
- **Role-based Authentication**: Admin, operator, and viewer roles with granular permissions
- **Modern UI**: Professional Material-UI interface designed for sys-admins
- **Dockerized Deployment**: Complete containerized solution with Docker Compose

## Architecture

- **Frontend**: React TypeScript with Material-UI
- **Backend**: FastAPI Python with WebSocket support
- **Database**: PostgreSQL for user management
- **Cache**: Redis for session management
- **Proxy**: Nginx for reverse proxy and static file serving
- **Docker Integration**: Direct Docker API access via Unix socket

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- At least 2GB RAM available
- Port 8088 available on host

### Installation

1. Clone and navigate to the project:
```bash
cd docker-manager
```

2. Start the application:
```bash
docker-compose up -d
```

3. Initialize the admin user:
```bash
curl -X POST http://localhost:6500/api/auth/init-admin
```

4. Access the application:
- Open http://localhost:8088 in your browser
- Login with: `admin` / `admin123`

### Development Setup

For development with hot reload:

```bash
# Start only database services
docker-compose up -d postgres redis

# Install backend dependencies
cd backend
pip install -r requirements.txt

# Run backend
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 6500

# Install frontend dependencies  
cd frontend
npm install

# Run frontend
npm start
```

## Configuration

### Environment Variables

Copy `.env` and modify as needed:

- `SECRET_KEY`: JWT secret (change in production!)
- `ADMIN_EMAIL`: Default admin email
- `ADMIN_PASSWORD`: Default admin password
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string

### User Roles

- **Admin**: Full access to all operations
- **Operator**: Container lifecycle management (start/stop/restart/logs/inspect)
- **Viewer**: Read-only access (inspect/logs/stats only)

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:6500/docs
- ReDoc: http://localhost:6500/redoc

## Security Considerations

- Change default admin credentials
- Use strong SECRET_KEY in production
- Restrict Docker socket access to authorized users only
- Configure firewall rules for network access
- Use HTTPS in production environments

## Monitoring

The application provides:
- Real-time container resource usage
- Docker daemon health status
- WebSocket connection monitoring
- Container lifecycle events
- System-wide Docker statistics

## Development

### Backend Structure
```
backend/
├── app/
│   ├── api/          # FastAPI route definitions
│   ├── core/         # Configuration and database
│   ├── models/       # Pydantic models and SQLAlchemy models
│   └── services/     # Business logic services
```

### Frontend Structure
```
frontend/
├── src/
│   ├── components/   # React components by feature
│   ├── hooks/        # Custom React hooks
│   ├── services/     # API client services
│   └── types/        # TypeScript type definitions
```

## Troubleshooting

### Common Issues

1. **Docker socket permission denied**
   - Ensure Docker daemon is running
   - Check user permissions for Docker socket

2. **Database connection errors**
   - Verify PostgreSQL container is healthy
   - Check DATABASE_URL environment variable

3. **WebSocket connection failures**
   - Verify backend container is running
   - Check browser network console for errors

### Logs

View service logs:
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Submit pull request

## License

MIT License - see LICENSE file for details. 
