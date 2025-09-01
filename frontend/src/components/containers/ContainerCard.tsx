import React from "react";
import {
  Card,
  CardContent,
  CardActionArea,
  Typography,
  Box,
  Chip,
  Grid2 as Grid,
  useTheme,
} from "@mui/material";
import { PlayArrow, Stop, Pause, Warning } from "@mui/icons-material";
import MetricSparkline from "./MetricSparkline";
import { ContainerCardProps } from "../../types/metrics";

const ContainerCard: React.FC<ContainerCardProps> = React.memo(
  ({ container, onDetailsClick, isSelected = false, layout = "grid" }) => {
    const theme = useTheme();

    // Validate container data and provide fallbacks
    const safeContainer = {
      ...container,
      cpu_percent: container.cpu_percent ?? 0.0,
      memory_percent: container.memory_percent ?? 0.0,
      memory_usage: container.memory_usage ?? 0,
      memory_limit: container.memory_limit ?? 0,
      network_rx: container.network_rx ?? 0,
      network_tx: container.network_tx ?? 0,
      block_read: container.block_read ?? 0,
      block_write: container.block_write ?? 0,
      sparkline_data: container.sparkline_data ?? {
        cpu: [],
        memory: [],
        network_rx: [],
        network_tx: [],
        block_read: [],
        block_write: [],
      },
    };

    // Get status color and icon
    const getStatusInfo = (status: string) => {
      switch (status.toLowerCase()) {
        case "running":
          return {
            color: "success",
            icon: <PlayArrow fontSize="small" />,
            chipColor: theme.palette.success.main,
          };
        case "stopped":
        case "exited":
          return {
            color: "error",
            icon: <Stop fontSize="small" />,
            chipColor: theme.palette.error.main,
          };
        case "paused":
          return {
            color: "warning",
            icon: <Pause fontSize="small" />,
            chipColor: theme.palette.warning.main,
          };
        default:
          return {
            color: "default",
            icon: <Warning fontSize="small" />,
            chipColor: theme.palette.grey[500],
          };
      }
    };

    const statusInfo = getStatusInfo(safeContainer.status);

    // Format memory usage
    const formatMemory = (bytes: number | undefined): string => {
      if (bytes === undefined || bytes === null) {
        return "0B";
      }
      if (bytes >= 1024 * 1024 * 1024) {
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
      } else if (bytes >= 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
      }
      return `${(bytes / 1024).toFixed(1)}KB`;
    };

    const handleClick = () => {
      onDetailsClick(safeContainer.id);
    };

    // Grid view layout (existing vertical layout)
    if (layout === "grid") {
      return (
        <Card
          sx={{
            height: "100%",
            transition: "all 0.2s ease-in-out",
            border: isSelected
              ? `2px solid ${theme.palette.primary.main}`
              : "1px solid transparent",
            boxShadow: isSelected
              ? `0 4px 12px ${theme.palette.primary.main}30`
              : "0 2px 8px rgba(0,0,0,0.1)",
            "&:hover": {
              transform: "translateY(-2px)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
            },
          }}
        >
          <CardActionArea onClick={handleClick} sx={{ height: "100%" }}>
            <CardContent
              sx={{
                p: 2,
                height: "100%",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Header with container name and status */}
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 1,
                }}
              >
                <Typography
                  variant="h6"
                  component="h3"
                  sx={{
                    fontSize: "1rem",
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: "70%",
                  }}
                  title={safeContainer.name}
                >
                  {safeContainer.name}
                </Typography>
                <Chip
                  icon={statusInfo.icon}
                  label={safeContainer.status}
                  size="small"
                  sx={{
                    backgroundColor: `${statusInfo.chipColor}20`,
                    color: statusInfo.chipColor,
                    border: `1px solid ${statusInfo.chipColor}40`,
                    fontSize: "0.7rem",
                  }}
                />
              </Box>

              {/* Uptime */}
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 2, fontSize: "0.8rem" }}
              >
                Uptime: {safeContainer.uptime}
              </Typography>

              {/* Metrics Overview */}
              <Box sx={{ mb: 2 }}>
                <Grid container spacing={1}>
                  <Grid size={6}>
                    <Typography variant="caption" color="text.secondary">
                      CPU: {(safeContainer.cpu_percent ?? 0.0).toFixed(1)}%
                    </Typography>
                  </Grid>
                  <Grid size={6}>
                    <Typography variant="caption" color="text.secondary">
                      Memory: {(safeContainer.memory_percent ?? 0.0).toFixed(1)}
                      %
                    </Typography>
                  </Grid>
                  <Grid size={12}>
                    <Typography variant="caption" color="text.secondary">
                      RAM: {formatMemory(safeContainer.memory_usage)} /{" "}
                      {formatMemory(safeContainer.memory_limit)}
                    </Typography>
                  </Grid>
                </Grid>
              </Box>

              {/* Sparklines */}
              <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mb: 1 }}
                >
                  Last Hour Trends
                </Typography>
                <Grid container spacing={1}>
                  <Grid size={6}>
                    <MetricSparkline
                      data={safeContainer.sparkline_data.cpu}
                      color={theme.palette.primary.main}
                      label="CPU"
                      unit="%"
                      height={40}
                      width={100}
                    />
                  </Grid>
                  <Grid size={6}>
                    <MetricSparkline
                      data={safeContainer.sparkline_data.memory}
                      color={theme.palette.secondary.main}
                      label="Memory"
                      unit="%"
                      height={40}
                      width={100}
                    />
                  </Grid>
                  <Grid size={6}>
                    <MetricSparkline
                      data={safeContainer.sparkline_data.network_rx}
                      color={theme.palette.info.main}
                      label="Network RX"
                      unit="bytes/s"
                      height={40}
                      width={100}
                    />
                  </Grid>
                  <Grid size={6}>
                    <MetricSparkline
                      data={safeContainer.sparkline_data.network_tx}
                      color={theme.palette.warning.main}
                      label="Network TX"
                      unit="bytes/s"
                      height={40}
                      width={100}
                    />
                  </Grid>
                </Grid>
              </Box>
            </CardContent>
          </CardActionArea>
        </Card>
      );
    }

    // List view layout (horizontal layout)
    return (
      <Card
        sx={{
          width: "100%",
          transition: "all 0.2s ease-in-out",
          border: isSelected
            ? `2px solid ${theme.palette.primary.main}`
            : "1px solid transparent",
          boxShadow: isSelected
            ? `0 4px 12px ${theme.palette.primary.main}30`
            : "0 2px 8px rgba(0,0,0,0.1)",
          "&:hover": {
            transform: "translateY(-1px)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
          },
        }}
      >
        <CardActionArea onClick={handleClick} sx={{ width: "100%" }}>
          <CardContent sx={{ p: 2, width: "100%", height: "90%" }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                flexWrap: { xs: "wrap", md: "nowrap" },
                width: "100%",
                // justifyContent: 'space-between',
              }}
            >
              {/* Container Name and Status */}
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  minWidth: { xs: "100%", md: "220px" },
                  flex: { xs: "none", md: "1 1 220px" },
                }}
              >
                <Typography
                  variant="h6"
                  component="h3"
                  sx={{
                    fontSize: "1rem",
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    width: "100%",
                    mb: 0.5,
                  }}
                  title={safeContainer.name}
                >
                  {safeContainer.name}
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Chip
                    icon={statusInfo.icon}
                    label={safeContainer.status}
                    size="small"
                    sx={{
                      backgroundColor: `${statusInfo.chipColor}20`,
                      color: statusInfo.chipColor,
                      border: `1px solid ${statusInfo.chipColor}40`,
                      fontSize: "0.7rem",
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {safeContainer.uptime}
                  </Typography>
                </Box>
              </Box>

              {/* CPU Metrics */}
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  flex: { xs: "1 1 120px", md: "1 1 160px" },
                  minWidth: 120,
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mb: 0.5 }}
                >
                  CPU: {(safeContainer.cpu_percent ?? 0.0).toFixed(1)}%
                </Typography>
                <MetricSparkline
                  data={safeContainer.sparkline_data.cpu}
                  color={theme.palette.primary.main}
                  label=""
                  unit="%"
                  height={30}
                  width={140}
                />
              </Box>

              {/* Memory Metrics */}
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  flex: { xs: "1 1 120px", md: "1 1 160px" },
                  minWidth: 120,
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mb: 0.5 }}
                >
                  Memory: {(safeContainer.memory_percent ?? 0.0).toFixed(1)}%
                </Typography>
                <MetricSparkline
                  data={safeContainer.sparkline_data.memory}
                  color={theme.palette.secondary.main}
                  label=""
                  unit="%"
                  height={30}
                  width={140}
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: "0.6rem", mt: 0.5 }}
                >
                  {formatMemory(safeContainer.memory_usage)} /{" "}
                  {formatMemory(safeContainer.memory_limit)}
                </Typography>
              </Box>

              {/* Network RX Metrics */}
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  flex: { xs: "1 1 120px", md: "1 1 160px" },
                  minWidth: 120,
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mb: 0.5 }}
                >
                  Network RX
                </Typography>
                <MetricSparkline
                  data={safeContainer.sparkline_data.network_rx}
                  color={theme.palette.info.main}
                  label=""
                  unit="bytes/s"
                  height={30}
                  width={140}
                />
              </Box>

              {/* Network TX Metrics */}
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  flex: { xs: "1 1 120px", md: "1 1 160px" },
                  minWidth: 120,
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mb: 0.5 }}
                >
                  Network TX
                </Typography>
                <MetricSparkline
                  data={safeContainer.sparkline_data.network_tx}
                  color={theme.palette.warning.main}
                  label=""
                  unit="bytes/s"
                  height={30}
                  width={140}
                />
              </Box>
            </Box>
          </CardContent>
        </CardActionArea>
      </Card>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function to prevent unnecessary re-renders
    return (
      prevProps.container.id === nextProps.container.id &&
      prevProps.container.status === nextProps.container.status &&
      (prevProps.container.cpu_percent ?? 0) ===
        (nextProps.container.cpu_percent ?? 0) &&
      (prevProps.container.memory_percent ?? 0) ===
        (nextProps.container.memory_percent ?? 0) &&
      prevProps.container.uptime === nextProps.container.uptime &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.layout === nextProps.layout
    );
  },
);

export default ContainerCard;
