import {
  PlayArrow,
  Stop,
  Refresh,
  Timeline,
  Delete,
  RestartAlt,
} from "@mui/icons-material";
import { LoadingButton } from "@mui/lab";
import {
  Box,
  Typography,
  Grid2 as Grid,
  Card,
  CardContent,
  Button,
  Chip,
  Divider,
  CircularProgress,
  Alert,
} from "@mui/material";
import React, { useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

import { dockerAPI } from "../../services/api";
import {
  ContainerStatsWithHistory,
  ContainerMetricsPoint,
} from "../../types/metrics";
import ModalManager from "../common/ModalManager";

interface ContainerMetricsModalProps {
  open: boolean;
  onClose: () => void;
  container: ContainerStatsWithHistory | null;
}

const ContainerMetricsModal: React.FC<ContainerMetricsModalProps> = ({
  open,
  onClose,
  container,
}) => {
  const [historicalData, setHistoricalData] = useState<ContainerMetricsPoint[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState(60); // minutes
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchHistoricalData = useCallback(async () => {
    if (!container) return;

    setLoading(true);
    setError(null);

    try {
      const response = await dockerAPI.getContainerMetricsHistory(
        container.id,
        timeRange,
      );
      setHistoricalData(response.data_points || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch historical data");
    } finally {
      setLoading(false);
    }
  }, [container, timeRange]);

  // Fetch historical data when modal opens or time range changes
  useEffect(() => {
    if (open && container) {
      fetchHistoricalData();
    }
  }, [open, container, fetchHistoricalData]);

  const formatBytes = (bytes: number): string => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
    } else if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    }
    return `${(bytes / 1024).toFixed(1)}KB`;
  };

  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const handleContainerAction = async (
    action: "start" | "stop" | "restart" | "remove",
    containerId: string,
  ) => {
    setActionLoading(action);
    setActionError(null);
    setActionSuccess(null);

    try {
      let result;
      switch (action) {
        case "start":
          result = await dockerAPI.startContainer(containerId);
          break;
        case "stop":
          result = await dockerAPI.stopContainer(containerId);
          break;
        case "restart":
          result = await dockerAPI.restartContainer(containerId);
          break;
        case "remove":
          result = await dockerAPI.removeContainer(containerId, false);
          break;
      }
      setActionSuccess(result.message);

      // Refresh data after successful action
      if (action !== "remove") {
        await fetchHistoricalData();
      } else {
        // Close modal after removal
        onClose();
      }
    } catch (err: any) {
      setActionError(err.message || `Failed to ${action} container`);
    } finally {
      setActionLoading(null);
    }
  };

  // Prepare chart data
  const chartData = historicalData.map((point) => ({
    time: formatTimestamp(point.timestamp),
    cpu: point.cpu_percent,
    memory: point.memory_percent,
    networkRx: point.network_rx / 1024, // Convert to KB
    networkTx: point.network_tx / 1024, // Convert to KB
  }));

  if (!container) return null;

  return (
    <ModalManager
      open={open}
      onClose={onClose}
      maxWidth="1200px"
      title={`${container.name} Metrics`}
    >
      <Box sx={{ p: 2 }}>
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 3,
          }}
        >
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              {container.name}
            </Typography>
            <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
              <Chip
                icon={container.status === "running" ? <PlayArrow /> : <Stop />}
                label={container.status}
                color={container.status === "running" ? "success" : "error"}
                variant="outlined"
              />
              <Typography variant="body2" color="text.secondary">
                Uptime: {container.uptime}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            {/* Action buttons based on container status */}
            {container.status === "running" && (
              <>
                <LoadingButton
                  variant="outlined"
                  startIcon={<Stop />}
                  onClick={() => handleContainerAction("stop", container.id)}
                  loading={actionLoading === "stop"}
                  color="error"
                >
                  Stop
                </LoadingButton>
                <LoadingButton
                  variant="outlined"
                  startIcon={<RestartAlt />}
                  onClick={() => handleContainerAction("restart", container.id)}
                  loading={actionLoading === "restart"}
                  color="warning"
                >
                  Restart
                </LoadingButton>
              </>
            )}

            {(container.status === "stopped" ||
              container.status === "exited") && (
              <LoadingButton
                variant="outlined"
                startIcon={<PlayArrow />}
                onClick={() => handleContainerAction("start", container.id)}
                loading={actionLoading === "start"}
                color="success"
              >
                Start
              </LoadingButton>
            )}

            {(container.status === "stopped" ||
              container.status === "exited") && (
              <LoadingButton
                variant="outlined"
                startIcon={<Delete />}
                onClick={() => handleContainerAction("remove", container.id)}
                loading={actionLoading === "remove"}
                color="error"
              >
                Remove
              </LoadingButton>
            )}

            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={fetchHistoricalData}
              disabled={loading || actionLoading !== null}
            >
              Refresh
            </Button>
          </Box>
        </Box>

        {/* Action feedback messages */}
        {actionError && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            onClose={() => setActionError(null)}
          >
            {actionError}
          </Alert>
        )}
        {actionSuccess && (
          <Alert
            severity="success"
            sx={{ mb: 2 }}
            onClose={() => setActionSuccess(null)}
          >
            {actionSuccess}
          </Alert>
        )}

        {/* Time Range Selector */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Time Range
          </Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            {[15, 30, 60, 120, 360].map((minutes) => (
              <Button
                key={minutes}
                variant={timeRange === minutes ? "contained" : "outlined"}
                size="small"
                onClick={() => setTimeRange(minutes)}
              >
                {minutes < 60 ? `${minutes}m` : `${minutes / 60}h`}
              </Button>
            ))}
          </Box>
        </Box>

        {/* Current Stats Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid
            size={{
              xs: 12,
              sm: 6,
              md: 3,
            }}
          >
            <Card>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">
                  CPU Usage
                </Typography>
                <Typography variant="h4" color="primary">
                  {(container.cpu_percent ?? 0.0).toFixed(1)}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid
            size={{
              xs: 12,
              sm: 6,
              md: 3,
            }}
          >
            <Card>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">
                  Memory Usage
                </Typography>
                <Typography variant="h4" color="secondary">
                  {(container.memory_percent ?? 0.0).toFixed(1)}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatBytes(container.memory_usage ?? 0)} /{" "}
                  {formatBytes(container.memory_limit ?? 0)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid
            size={{
              xs: 12,
              sm: 6,
              md: 3,
            }}
          >
            <Card>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">
                  Network RX
                </Typography>
                <Typography variant="h5" color="info">
                  {formatBytes(container.network_rx ?? 0)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid
            size={{
              xs: 12,
              sm: 6,
              md: 3,
            }}
          >
            <Card>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">
                  Network TX
                </Typography>
                <Typography variant="h5" color="warning">
                  {formatBytes(container.network_tx ?? 0)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        {/* Historical Charts */}
        <Typography
          variant="h5"
          gutterBottom
          sx={{ display: "flex", alignItems: "center", gap: 1 }}
        >
          <Timeline />
          Historical Metrics
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={3}>
            {/* CPU & Memory Chart */}
            <Grid
              size={{
                xs: 12,
                md: 6,
              }}
            >
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    CPU & Memory Usage
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis
                        label={{
                          value: "Percentage (%)",
                          angle: -90,
                          position: "insideLeft",
                        }}
                      />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="cpu"
                        stroke="#1976d2"
                        strokeWidth={2}
                        name="CPU %"
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="memory"
                        stroke="#dc004e"
                        strokeWidth={2}
                        name="Memory %"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

            {/* Network Chart */}
            <Grid
              size={{
                xs: 12,
                md: 6,
              }}
            >
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Network Traffic
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis
                        label={{
                          value: "KB",
                          angle: -90,
                          position: "insideLeft",
                        }}
                      />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="networkRx"
                        stroke="#2e7d32"
                        strokeWidth={2}
                        name="RX (KB)"
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="networkTx"
                        stroke="#ed6c02"
                        strokeWidth={2}
                        name="TX (KB)"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </Box>
    </ModalManager>
  );
};

export default ContainerMetricsModal;
