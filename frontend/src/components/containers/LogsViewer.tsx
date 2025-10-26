import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Sheet,
  Typography,
  Select,
  Option,
  Checkbox,
  Button,
  ButtonGroup,
  CircularProgress,
  Alert,
} from '@mui/joy';
import { useWebSocketContext } from '../../contexts/WebSocketContext';
import {
  LogLine,
  ContainerLogsRequestData,
  ContainerLogsMessage,
  ContainerLogsEndMessage,
  ContainerLogsErrorMessage,
} from '../../types/websocket';
import RefreshIcon from '@mui/icons-material/Refresh';
import ClearIcon from '@mui/icons-material/Clear';
import DownloadIcon from '@mui/icons-material/Download';

interface LogsViewerProps {
  containerId: string;
  containerState: string;
}

const MAX_STORED_LOGS = 10000;

const LogsViewer: React.FC<LogsViewerProps> = ({ containerId, containerState }) => {
  const { send, subscribe, unsubscribe } = useWebSocketContext();
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [tail, setTail] = useState<number>(100);
  const [follow, setFollow] = useState<boolean>(false);
  const [timestamps, setTimestamps] = useState<boolean>(false);
  const [streamFilter, setStreamFilter] = useState<'all' | 'stdout' | 'stderr'>('all');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isStreamActive, setIsStreamActive] = useState<boolean>(false);
  const [userScrolledUp, setUserScrolledUp] = useState<boolean>(false);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive (if not scrolled up)
  useEffect(() => {
    if (!userScrolledUp && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, userScrolledUp]);

  // Detect if user has scrolled up
  const handleScroll = useCallback(() => {
    if (logsContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setUserScrolledUp(!isAtBottom);
    }
  }, []);

  // Add logs to state with max limit
  const addLogs = useCallback((newLines: LogLine[], isInitial: boolean) => {
    setLogs((prev) => {
      let updated = isInitial ? newLines : [...prev, ...newLines];

      // Trim to max size (keep most recent)
      if (updated.length > MAX_STORED_LOGS) {
        updated = updated.slice(updated.length - MAX_STORED_LOGS);
      }

      return updated;
    });
  }, []);

  // Request logs from backend
  const requestLogs = useCallback((overrideFollow?: boolean) => {
    setError(null);
    setLoading(true);

    const followMode = overrideFollow !== undefined ? overrideFollow : follow;

    const request: ContainerLogsRequestData = {
      container_id: containerId,
      tail,
      follow: followMode,
      timestamps,
      stdout: streamFilter === 'all' || streamFilter === 'stdout',
      stderr: streamFilter === 'all' || streamFilter === 'stderr',
    };

    const sent = send({
      type: 'container_logs_request',
      data: request,
    });

    if (!sent) {
      setError('Failed to send log request. WebSocket not connected.');
      setLoading(false);
    } else {
      setIsStreamActive(followMode);
    }
  }, [containerId, tail, follow, timestamps, streamFilter, send]);

  // Handle incoming log messages
  useEffect(() => {
    const handleLogsMessage = (data: ContainerLogsMessage['data']) => {
      if (data.container_id === containerId) {
        addLogs(data.lines, data.is_initial);
        setLoading(false);
      }
    };

    const handleLogsEnd = (data: ContainerLogsEndMessage['data']) => {
      if (data.container_id === containerId) {
        setIsStreamActive(false);
        setLoading(false);
      }
    };

    const handleLogsError = (data: ContainerLogsErrorMessage['data']) => {
      if (data.container_id === containerId) {
        setError(data.error);
        setIsStreamActive(false);
        setLoading(false);
      }
    };

    const logsSubscription = subscribe('container_logs', handleLogsMessage);
    const endSubscription = subscribe('container_logs_end', handleLogsEnd);
    const errorSubscription = subscribe('container_logs_error', handleLogsError);

    return () => {
      unsubscribe(logsSubscription);
      unsubscribe(endSubscription);
      unsubscribe(errorSubscription);
    };
  }, [containerId, subscribe, unsubscribe, addLogs]);

  // Initial load on mount
  useEffect(() => {
    requestLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Clear logs
  const handleClear = () => {
    setLogs([]);
    setError(null);
  };

  // Download logs as text file
  const handleDownload = () => {
    const logText = logs
      .map((log) => {
        const ts = log.timestamp ? `${log.timestamp} ` : '';
        return `${ts}${log.line}`;
      })
      .join('\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${containerId.substring(0, 12)}_logs.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Filter logs by stream type
  const filteredLogs = logs.filter((log) => {
    if (streamFilter === 'all') return true;
    return log.stream === streamFilter;
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 2 }}>
      {/* Controls */}
      <Sheet variant="outlined" sx={{ p: 2, borderRadius: 'sm' }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          {/* Tail lines selector */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography level="body-sm">Tail:</Typography>
            <Select
              value={tail}
              onChange={(_, value) => setTail(value as number)}
              size="sm"
              sx={{ minWidth: 100 }}
            >
              <Option value={100}>100 lines</Option>
              <Option value={500}>500 lines</Option>
              <Option value={1000}>1000 lines</Option>
              <Option value={5000}>All (5000)</Option>
            </Select>
          </Box>

          {/* Follow mode toggle */}
          <Checkbox
            label="Follow"
            checked={follow}
            onChange={(e) => {
              const newFollow = e.target.checked;
              setFollow(newFollow);
              // When enabling follow mode, request new logs with the new setting
              if (newFollow) {
                // Request with follow mode enabled - don't clear logs yet
                requestLogs(true); // Pass true to override follow state
              }
            }}
            disabled={containerState !== 'running'}
            size="sm"
          />

          {/* Timestamps toggle */}
          <Checkbox
            label="Show timestamps"
            checked={timestamps}
            onChange={(e) => setTimestamps(e.target.checked)}
            size="sm"
          />

          {/* Stream filter */}
          <ButtonGroup size="sm" variant="outlined">
            <Button
              variant={streamFilter === 'all' ? 'solid' : 'outlined'}
              onClick={() => setStreamFilter('all')}
            >
              All
            </Button>
            <Button
              variant={streamFilter === 'stdout' ? 'solid' : 'outlined'}
              onClick={() => setStreamFilter('stdout')}
            >
              STDOUT
            </Button>
            <Button
              variant={streamFilter === 'stderr' ? 'solid' : 'outlined'}
              onClick={() => setStreamFilter('stderr')}
              color="danger"
            >
              STDERR
            </Button>
          </ButtonGroup>

          {/* Action buttons */}
          <Box sx={{ marginLeft: 'auto', display: 'flex', gap: 1 }}>
            <Button
              size="sm"
              variant="outlined"
              startDecorator={<RefreshIcon />}
              onClick={() => requestLogs()}
              loading={loading}
            >
              Refresh
            </Button>
            <Button
              size="sm"
              variant="outlined"
              startDecorator={<ClearIcon />}
              onClick={handleClear}
              disabled={logs.length === 0}
            >
              Clear
            </Button>
            <Button
              size="sm"
              variant="outlined"
              startDecorator={<DownloadIcon />}
              onClick={handleDownload}
              disabled={logs.length === 0}
            >
              Download
            </Button>
          </Box>
        </Box>

        {/* Status indicators */}
        <Box sx={{ display: 'flex', gap: 2, mt: 1, alignItems: 'center' }}>
          <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
            {filteredLogs.length} / {logs.length} lines
            {logs.length >= MAX_STORED_LOGS && ' (max reached)'}
          </Typography>
          {isStreamActive && (
            <Typography level="body-xs" sx={{ color: 'success.500' }}>
              ● Live streaming...
            </Typography>
          )}
        </Box>
      </Sheet>

      {/* Error display */}
      {error && (
        <Alert color="danger" variant="soft">
          {error}
        </Alert>
      )}

      {/* Logs display */}
      <Sheet
        variant="outlined"
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 2,
          borderRadius: 'sm',
          backgroundColor: '#1e1e1e',
          color: '#d4d4d4',
          fontFamily: '"Fira Code", "Monaco", "Consolas", monospace',
          fontSize: '13px',
          lineHeight: 1.5,
        }}
        ref={logsContainerRef}
        onScroll={handleScroll}
      >
        {loading && logs.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
            <CircularProgress size="sm" />
          </Box>
        ) : filteredLogs.length === 0 ? (
          <Typography level="body-sm" sx={{ color: '#888', textAlign: 'center', mt: 4 }}>
            No logs available
          </Typography>
        ) : (
          <>
            {filteredLogs.map((log, index) => (
              <Box
                key={index}
                sx={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  color: log.stream === 'stderr' ? '#f48771' : '#d4d4d4',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  },
                }}
              >
                {log.timestamp && (
                  <span style={{ color: '#858585', marginRight: '8px' }}>
                    {log.timestamp}
                  </span>
                )}
                {log.line}
              </Box>
            ))}
            <div ref={logsEndRef} />
          </>
        )}
      </Sheet>
    </Box>
  );
};

export default LogsViewer;
