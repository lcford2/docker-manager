-- Database initialization script for Docker Manager

-- Create database (this will be done by docker-compose)
-- CREATE DATABASE docker_manager;

-- Create user (this will be done by docker-compose)
-- CREATE USER docker_manager WITH PASSWORD 'docker_manager';
-- GRANT ALL PRIVILEGES ON DATABASE docker_manager TO docker_manager;

-- Connect to the database
\c docker_manager;

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- The tables will be created by SQLAlchemy, but we can add indexes for performance
-- This script ensures the database is ready for the application
