#!/bin/bash

# # Server configuration
export APP_SERVER_HOST=0.0.0.0
export APP_SERVER_PORT=8080
export APP_SERVER_REQUEST_TIMEOUT_SECONDS=60

# Docker configuration
export APP_DOCKER_SOCKET_PATH=/var/run/docker.sock
export APP_DOCKER_OPERATION_TIMEOUT_SECONDS=45
export APP_DOCKER_STOP_SIGNAL=SIGKILL

# Logging configuration
export APP_LOGGING_LEVEL=debug
export APP_LOGGING_FORMAT=json

# Environment selection
export RUST_ENV=production
