-- Container stats fixture
-- Provides sample container metrics for testing historical queries

INSERT INTO container_stats (
    container_id,
    container_name,
    cpu_usage,
    memory_usage,
    memory_limit,
    network_rx,
    network_tx,
    block_read,
    block_write,
    pids,
    timestamp
) VALUES
    ('abc123', 'test_container_1', 25.5, 536870912, 1073741824, 1024000, 512000, 2048000, 1024000, 10, NOW() - INTERVAL '1 hour'),
    ('abc123', 'test_container_1', 30.2, 625829120, 1073741824, 2048000, 1024000, 3072000, 2048000, 12, NOW() - INTERVAL '30 minutes'),
    ('abc123', 'test_container_1', 28.7, 598458368, 1073741824, 3072000, 1536000, 4096000, 3072000, 11, NOW() - INTERVAL '15 minutes'),
    ('def456', 'test_container_2', 15.3, 268435456, 536870912, 512000, 256000, 1024000, 512000, 5, NOW() - INTERVAL '1 hour'),
    ('def456', 'test_container_2', 18.9, 314572800, 536870912, 768000, 384000, 1536000, 768000, 6, NOW() - INTERVAL '30 minutes');
