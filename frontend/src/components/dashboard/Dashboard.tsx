import { ViewInAr, Storage, Image, NetworkCheck } from "@mui/icons-material";
import { Box, Grid, Sheet, Container, CircularProgress } from "@mui/joy";
import { useTheme } from "@mui/joy/styles";
import React, { useState, useEffect, useCallback, useRef } from "react";

import { useSharedWebSocket } from "../../hooks/useSharedWebSocket";
import { dockerAPI } from "../../services/api";
import { DockerContainer } from "../../types/docker";
import { ContainerStatsWithHistory } from "../../types/metrics";
import {
  DashboardStateManager,
  DashboardState,
} from "../../utils/stateManagement";
import EnhancedResourceChart from "../charts/enhanced/EnhancedResourceChart";

import RunningContainers from "./RunningContainers";
import StatCard from "./StatCard";
import SystemSummary from "./SystemSummary";

interface ChartDataPoint {
  time: string;
  cpu: number;
  memory: number;
  timestamp?: number;
}

const MAX_CHART_DATA_POINTS = 30; // Keep the last 30 data points (e.g., 5 minutes if data comes every 10s)

const Dashboard: React.FC = React.memo(() => {
  // Initialize state manager
  const stateManagerRef = useRef<DashboardStateManager | null>(null);
  const theme = useTheme();

  const [dashboardState, setDashboardState] = useState<DashboardState>({
    systemStats: {
      containers_running: 0,
      containers_stopped: 0,
      containers_total: 0,
      images: 0,
      volumes: 0,
      networks: 0,
    },
    containers: [],
    loading: true,
    error: null,
    dockerStatus: null,
  });

  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

  const isFirstUpdate = useRef(true);

  // const buildHistoricalData = useCallback(
  //   (containers: ContainerStatsWithHistory[]): ChartDataPoint[] => {
  //     const allTimestamps = new Set<number>();
  //     containers.forEach((container) => {
  //       container.history?.forEach((point) => {
  //         if (point.timestamp) allTimestamps.add(point.timestamp);
  //       });
  //     });
  //     const uniqueTimes = Array.from(allTimestamps).sort((a, b) => a - b);
  //     const points: ChartDataPoint[] = [];
  //     uniqueTimes.forEach((ts) => {
  //       let totalCpu = 0;
  //       let totalMemory = 0;
  //       containers.forEach((container) => {
  //         let lastCpu = 0;
  //         let lastMemory = 0;
  //         if (container.history) {
  //           for (let i = 0; i < container.history.length; i++) {
  //             if (container.history[i].timestamp <= ts) {
  //               lastCpu = container.history[i].cpu_percent || 0;
  //               lastMemory = container.history[i].memory_percent || 0;
  //             } else {
  //               break;
  //             }
  //           }
  //         }
  //         totalCpu += lastCpu;
  //         totalMemory += lastMemory;
  //       });
  //       const date = new Date(ts);
  //       const time = date.toLocaleTimeString([], {
  //         hour: "2-digit",
  //         minute: "2-digit",
  //         second: "2-digit",
  //       });
  //       points.push({
  //         time,
  //         cpu: totalCpu,
  //         memory: totalMemory,
  //         timestamp: ts,
  //       });
  //     });
  //     return points;
  //   },
  //   [],
  // );

  // Initialize state manager once
  if (!stateManagerRef.current) {
    stateManagerRef.current = new DashboardStateManager(dashboardState);
  }

  // Memoized callback for WebSocket container stats updates
  const handleContainerStats = useCallback(
    (containerStats: ContainerStatsWithHistory[]) => {
      if (stateManagerRef.current) {
        const updatedState = stateManagerRef.current.applyUpdate({
          type: "WEBSOCKET",
          data: {
            containers: containerStats,
            loading: false, // WebSocket data means we have initial data
          },
          timestamp: Date.now(),
        });

        const totalCpu = containerStats.reduce(
          (acc, c) => acc + (c.cpu_percent || 0),
          0,
        );
        const totalMemory = containerStats.reduce(
          (acc, c) => acc + (c.memory_percent || 0),
          0,
        );
        const time = new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });

        const newPoint: ChartDataPoint = {
          time,
          cpu: totalCpu,
          memory: totalMemory,
          timestamp: Date.now(),
        };

        if (isFirstUpdate.current) {
          // const historical = buildHistoricalData(containerStats);
          // setChartData([...historical, newPoint]);
          setChartData([newPoint]);
          isFirstUpdate.current = false;
        } else {
          setChartData((prevData) => {
            const updatedData = [...prevData, newPoint];
            if (updatedData.length > MAX_CHART_DATA_POINTS) {
              return updatedData.slice(
                updatedData.length - MAX_CHART_DATA_POINTS,
              );
            }
            console.log("Updating chartData - new length:", updatedData.length);
            console.log("Sample point:", updatedData[updatedData.length - 1]);
            return updatedData;
          });
        }

        setDashboardState(updatedState);
        console.log("Dashboard updated with WebSocket container data");
      }
    },
    [],
  );

  // Shared WebSocket connection for real-time container metrics
  useSharedWebSocket({
    onContainerStats: handleContainerStats,
  });

  useEffect(() => {
    console.log("Dashboard useEffect running...");
    const fetchData = async () => {
      try {
        console.log("Starting background data fetch for additional info...");

        // Fetch Docker status (this provides additional system info not available via WebSocket)
        console.log("Fetching Docker status...");
        const dockerStatusData = await dockerAPI.getSystemInfo();
        console.log("Docker status:", dockerStatusData);

        if (dockerStatusData.status === "connected") {
          console.log("Docker connected, fetching data...");
          // Fetch containers, volumes, images, networks
          const [containers, volumes, images, networks] = await Promise.all([
            dockerAPI.getContainers(),
            dockerAPI.getVolumes(),
            dockerAPI.getImages(),
            dockerAPI.getNetworks(),
          ]);

          console.log("Data fetched:", {
            containers: containers.length,
            volumes: volumes.length,
            images: images.length,
            networks: networks.length,
          });

          const runningContainers = containers.filter(
            (c: any) => c.status === "running",
          ).length;
          const stoppedContainers = containers.length - runningContainers;

          const systemStats = {
            containers_running: runningContainers,
            containers_stopped: stoppedContainers,
            containers_total: containers.length,
            images: images.length,
            volumes: volumes.length,
            networks: networks.length,
          };

          // Update state through state manager
          if (stateManagerRef.current) {
            const updatedState = stateManagerRef.current.applyUpdate({
              type: "REST_API",
              data: {
                systemStats,
                dockerStatus: dockerStatusData,
                loading: false,
                error: null,
                containers: containers,
              },
              timestamp: Date.now(),
            });
            setDashboardState(updatedState);
          }
        } else {
          console.log("Docker not connected:", dockerStatusData.error);
          if (stateManagerRef.current) {
            const updatedState = stateManagerRef.current.applyUpdate({
              type: "REST_API",
              data: {
                dockerStatus: dockerStatusData,
                loading: false,
                error: null,
              },
              timestamp: Date.now(),
            });
            setDashboardState(updatedState);
          }
        }
      } catch (err: any) {
        console.error("Dashboard fetch error:", err);
        if (stateManagerRef.current) {
          const updatedState = stateManagerRef.current.applyUpdate({
            type: "REST_API",
            data: {
              loading: false,
              error: err.message || "Failed to fetch data",
            },
            timestamp: Date.now(),
          });
          setDashboardState(updatedState);
        }
      }
    };

    fetchData();
  }, []);

  if (dashboardState.loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Grid container spacing={3}>
        {/* Chart */}
        <Grid xs={12} md={8} lg={9}>
          <Sheet
            sx={{
              p: 2,
              display: "flex",
              flexDirection: "column",
              height: 400,
            }}
          >
            <EnhancedResourceChart
              key={chartData.length}
              initialData={chartData.map((point) => ({
                timestamp: point.timestamp || Date.now(),
                time: point.time,
                cpu: point.cpu,
                memory: point.memory,
                metadata: {
                  source: "websocket" as const,
                  quality: "high" as const,
                  interpolated: false,
                },
              }))}
              config={{
                time: {
                  precision: "minute",
                  format: "HH:mm",
                  includeSeconds: false,
                },
                features: {
                  liveUpdates: true,
                  timeSelector: true,
                  thresholdLines: true,
                  connectionStatus: true,
                  performanceMetrics: false,
                },
              }}
              gridColor={theme.palette.divider}
              textColor={theme.palette.text.secondary}
              cpuColor={theme.palette.primary.mainChannel}
              memoryColor={theme.palette.primary.softColor}
              showControls={true}
              showTimeSelector={true}
              showPerformanceMetrics={process.env.NODE_ENV === "development"}
              enableLiveUpdates={true}
              enableExport={true}
              enableFullscreen={true}
              onError={(error) => console.error("Chart error:", error)}
              onPerformanceUpdate={(metrics) =>
                console.debug("Chart performance:", metrics)
              }
            />
          </Sheet>
        </Grid>
        {/* System Summary */}
        <Grid xs={12} md={4} lg={3}>
          <Sheet
            sx={{
              p: 2,
              display: "flex",
              flexDirection: "column",
              height: 400,
            }}
          >
            <SystemSummary dockerStatus={dashboardState.dockerStatus} />
          </Sheet>
        </Grid>
        {/* Stat Cards */}
        <Grid xs={12} sm={6} md={3}>
          <StatCard
            title="Containers"
            value={dashboardState.systemStats.containers_total}
            icon={<ViewInAr fontSize="large" />}
            path="/containers"
            color="primary"
          />
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <StatCard
            title="Images"
            value={dashboardState.systemStats.images}
            icon={<Image fontSize="large" />}
            path="/images"
            color="warning"
          />
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <StatCard
            title="Volumes"
            value={dashboardState.systemStats.volumes}
            icon={<Storage fontSize="large" />}
            path="/volumes"
            color="success"
          />
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <StatCard
            title="Networks"
            value={dashboardState.systemStats.networks}
            icon={<NetworkCheck fontSize="large" />}
            path="/networks"
            color="primary"
          />
        </Grid>
        {/* Running Containers */}
        <Grid xs={12}>
          <Sheet sx={{ p: 2, display: "flex", flexDirection: "column" }}>
            <RunningContainers
              containers={
                dashboardState.containers.filter(
                  (c) => "image" in c,
                ) as DockerContainer[]
              }
            />
          </Sheet>
        </Grid>
      </Grid>
    </Container>
  );
});

export default Dashboard;
