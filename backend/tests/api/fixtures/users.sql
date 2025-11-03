-- Test users fixture
-- Provides three test users with different roles for integration tests

INSERT INTO users (username, email, password_hash, role, created_at, updated_at) VALUES
    ('admin_test', 'admin@test.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYzpLaEZhUm', 'Admin', NOW(), NOW()),
    ('operator_test', 'operator@test.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYzpLaEZhUm', 'Operator', NOW(), NOW()),
    ('viewer_test', 'viewer@test.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYzpLaEZhUm', 'Viewer', NOW(), NOW());

-- Password for all test users is 'password123'
