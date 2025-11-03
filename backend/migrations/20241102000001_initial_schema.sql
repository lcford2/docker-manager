-- Initial database schema for Docker Manager

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Container stats table
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

-- System stats table
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
