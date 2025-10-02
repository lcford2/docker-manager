import { ViewInAr, Storage, Image, NetworkCheck } from "@mui/icons-material";
import { Box, Grid, Sheet, Container, CircularProgress } from "@mui/joy";
import React, { useState, useEffect } from "react";

import { useSharedWebSocket } from "../../hooks/useSharedWebSocket";
import { dockerAPI } from "../../services/api";
import { useDockerStore } from "../../store/dockerStore";
import { DockerContainer } from "../../types/docker";
import { ContainerStatsWithHistory } from "../../types/metrics";
import ResourceChart from "../charts/ResourceChart";

import RunningContainers from "./RunningContainers";
import StatCard from "./StatCard";
import SystemSummary from "./SystemSummary";

interface ChartDataPoint {
  time: string;
  cpu: number;
  memory: number;
}

const MAX_CHART_DATA_POINTS = 30;

const Dashboard: React.FC = React.memo(() => {
  const {
    systemStats,
    containers,
    loading,
    dockerStatus,
    mergeData,
    setDockerStatus,
    setError,
  } = useDockerStore();

  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

  // Hook to manage WebSocket connection and data fetching
  // useSharedWebSocket({});

  // Effect for fetching initial REST API data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const dockerStatusData = await dockerAPI.getSystemInfo();
        setDockerStatus(dockerStatusData);

        if (dockerStatusData.status === "connected") {
          const [apiContainers, volumes, images, networks] = await Promise.all([
            dockerAPI.getContainers(),
            dockerAPI.getVolumes(),
            dockerAPI.getImages(),
            dockerAPI.getNetworks(),
          ]);

          const runningContainers = apiContainers.filter(
            (c: any) => c.status === "running",
          ).length;
          const stoppedContainers = apiContainers.length - runningContainers;

          mergeData({
            containers: apiContainers,
            systemStats: {
              containers_running: runningContainers,
              containers_stopped: stoppedContainers,
              containers_total: apiContainers.length,
              images: images.length,
              volumes: volumes.Volumes.length,
              networks: networks.length,
            },
            loading: false,
          });
        } else {
          mergeData({ loading: false });
        }
      } catch (err: any) {
        setError(err.message || "Failed to fetch initial data");
        mergeData({ loading: false });
      }
    };

    fetchData();
  }, [mergeData, setDockerStatus, setError]);

  // Effect for updating chart data when container stats change
  useEffect(() => {
    if (containers && containers.length > 0) {
      const containerStats = containers.filter(
        (c) => "cpu_percent" in c,
      ) as ContainerStatsWithHistory[];

      if (containerStats.length === 0) return;

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
        // second: "2-digit",
      });

      const newPoint: ChartDataPoint = {
        time,
        cpu: totalCpu,
        memory: totalMemory,
      };

      setChartData((prevData) => {
        const updatedData = [...prevData, newPoint];
        if (updatedData.length > MAX_CHART_DATA_POINTS) {
          return updatedData.slice(updatedData.length - MAX_CHART_DATA_POINTS);
        }
        return updatedData;
      });
    }
  }, [containers]);

  if (loading) {
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
            <ResourceChart data={chartData} />
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
            <SystemSummary dockerStatus={dockerStatus} />
          </Sheet>
        </Grid>
        {/* Stat Cards */}
        <Grid xs={12} sm={6} md={3}>
          <StatCard
            title="Containers"
            value={systemStats.containers_total}
            icon={<ViewInAr fontSize="large" />}
            path="/containers"
            color="primary"
          />
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <StatCard
            title="Images"
            value={systemStats.images}
            icon={<Image fontSize="large" />}
            path="/images"
            color="warning"
          />
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <StatCard
            title="Volumes"
            value={systemStats.volumes}
            icon={<Storage fontSize="large" />}
            path="/volumes"
            color="success"
          />
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <StatCard
            title="Networks"
            value={systemStats.networks}
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
                containers.filter(
                  (c) => c.status === "running",
                ) as ContainerStatsWithHistory[]
              }
            />
          </Sheet>
        </Grid>
      </Grid>
    </Container>
  );
});

export default Dashboard;
