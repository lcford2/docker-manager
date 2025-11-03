-- System stats fixture
-- Provides sample system-wide metrics for testing

INSERT INTO system_stats (
    total_memory,
    used_memory,
    total_swap,
    used_swap,
    cpu_count,
    cpu_usage,
    timestamp
) VALUES
    (17179869184, 8589934592, 4294967296, 1073741824, 8, 45.5, NOW() - INTERVAL '1 hour'),
    (17179869184, 9663676416, 4294967296, 1342177280, 8, 52.3, NOW() - INTERVAL '30 minutes'),
    (17179869184, 8858370048, 4294967296, 1207959552, 8, 48.7, NOW() - INTERVAL '15 minutes');
