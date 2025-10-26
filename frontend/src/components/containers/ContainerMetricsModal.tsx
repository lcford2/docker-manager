import {
  Close,
  Storage,
  Memory,
  Dns,
  Widgets,
  VpnKey,
  PlayCircle,
  AccessTime,
  CalendarToday,
} from "@mui/icons-material";

import {
  Box,
  Typography,
  Modal,
  ModalDialog,
  DialogTitle,
  IconButton,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  Grid,
  Sheet,
} from "@mui/joy";
import React from "react";
import { ContainerStatsWithHistory } from "../../types/metrics";
import { formatBytes, formatDateTime } from "../../utils/formatters";
import MetricSparkline from "./MetricSparkline";
import LogsViewer from "./LogsViewer";
import MetricCard from "../common/MetricCard";

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
  if (!container) {
    return null;
  }

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog layout="fullscreen">
        <DialogTitle>
          Container Details: {container.name || ""}
          <IconButton
            aria-label="close"
            onClick={onClose}
            sx={{ position: "absolute", right: 8, top: 8 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <Box
          sx={{
            p: 2,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            flexGrow: 1,
          }}
        >
          <Tabs aria-label="Container details tabs" defaultValue={0}>
            <TabList>
              <Tab>Overview</Tab>
              <Tab>Logs</Tab>
            </TabList>
            <TabPanel value={0}>
              <Grid container spacing={2} sx={{ flexGrow: 1 }}>
                <Grid xs={12} md={6}>
                  <Sheet
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: "sm",
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                    }}
                  >
                    <Typography level="title-md">Summary</Typography>
                    <Grid container spacing={2} sx={{ flexGrow: 1 }}>
                      {/* 1. ID Card */}
                      <Grid xs={12}>
                        {" "}
                        {/* Use full width for the long ID */}
                        <MetricCard
                          label="Container ID"
                          icon={<VpnKey />}
                          // Use a smaller Typography level for the long ID string
                          primaryValue={
                            <Typography
                              level="body-sm"
                              sx={{ wordBreak: "break-all" }}
                            >
                              {container.id}
                            </Typography>
                          }
                          color="neutral"
                        />
                      </Grid>

                      {/* 2. State Card */}
                      <Grid xs={6}>
                        <MetricCard
                          label="State"
                          icon={<PlayCircle />}
                          primaryValue={
                            <Typography
                              level="h4"
                              // Color-code the state for immediate context
                              color={
                                container.state === "running"
                                  ? "success"
                                  : "danger"
                              }
                              fontWeight="xl"
                            >
                              {container.state}
                            </Typography>
                          }
                          color={
                            container.state === "running" ? "success" : "danger"
                          }
                        />
                      </Grid>

                      {/* 3. Uptime Card */}
                      <Grid xs={6}>
                        <MetricCard
                          label="Uptime"
                          icon={<AccessTime />}
                          primaryValue={
                            <Typography level="h4" fontWeight="xl">
                              {container.uptime}
                            </Typography>
                          }
                          color="neutral"
                        />
                      </Grid>

                      {/* 4. Timestamp Card */}
                      <Grid xs={12}>
                        {" "}
                        {/* Use full width for the datetime string */}
                        <MetricCard
                          label="Last Status Timestamp"
                          icon={<CalendarToday />}
                          primaryValue={formatDateTime(container.timestamp)}
                          color="neutral"
                        />
                      </Grid>
                    </Grid>
                  </Sheet>
                </Grid>{" "}
                <Grid xs={12} md={6}>
                  <Sheet
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: "sm",
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                    }}
                  >
                    <Typography level="title-md">Resource Usage</Typography>
                    <Grid container spacing={2} sx={{ flexGrow: 1 }}>
                      {/* 1. CPU Card */}
                      <Grid xs={6}>
                        <MetricCard
                          label="CPU Usage"
                          icon={<Storage />}
                          primaryValue={`${(container.cpu_percent ?? 0).toFixed(2)}%`}
                          color="primary"
                        />
                      </Grid>

                      {/* 2. Memory Card */}
                      <Grid xs={6}>
                        <MetricCard
                          label="Memory"
                          icon={<Memory />}
                          primaryValue={`${(container.memory_percent ?? 0).toFixed(2)}%`}
                          secondaryValue={`${formatBytes(container.memory_usage ?? 0)} / ${formatBytes(container.memory_limit ?? 0)}`}
                          color="warning"
                        />
                      </Grid>

                      {/* 3. Network I/O Card */}
                      <Grid xs={6}>
                        <MetricCard
                          label="Network I/O"
                          icon={<Dns />}
                          primaryValue={
                            <Box>
                              <Typography component="span" fontWeight="xl">
                                {`${formatBytes(container.network_rx ?? 0)} / ${formatBytes(container.network_tx ?? 0)}`}
                              </Typography>
                            </Box>
                          }
                          secondaryValue="RX / TX"
                          color="success"
                        />
                      </Grid>

                      {/* 4. Block I/O Card */}
                      <Grid xs={6}>
                        <MetricCard
                          label="Block I/O"
                          icon={<Widgets />}
                          primaryValue={
                            <Box>
                              <Typography component="span" fontWeight="xl">
                                {`${formatBytes(container.block_read ?? 0)} / ${formatBytes(container.block_write ?? 0)}`}
                              </Typography>
                            </Box>
                          }
                          secondaryValue="Read / Write"
                          color="neutral"
                        />
                      </Grid>
                    </Grid>
                  </Sheet>
                </Grid>
                <Grid xs={12}>
                  <Sheet variant="outlined" sx={{ p: 2, borderRadius: "sm" }}>
                    <Typography level="title-md" mb={2}>
                      Live Metrics
                    </Typography>
                    {container.sparkline_data && (
                      <Grid container spacing={2}>
                        <Grid xs={12} sm={6} md={3}>
                          <MetricSparkline
                            data={container.sparkline_data.cpu}
                            label="CPU"
                            color="primary"
                            unit="%"
                          />
                        </Grid>
                        <Grid xs={12} sm={6} md={3}>
                          <MetricSparkline
                            data={container.sparkline_data.memory}
                            label="Memory"
                            color="warning"
                            unit="%"
                          />
                        </Grid>
                        <Grid xs={12} sm={6} md={3}>
                          <MetricSparkline
                            data={container.sparkline_data.network_rx}
                            label="Net RX"
                            color="success"
                            unit="bytes"
                          />
                        </Grid>
                        <Grid xs={12} sm={6} md={3}>
                          <MetricSparkline
                            data={container.sparkline_data.network_tx}
                            label="Net TX"
                            color="info"
                            unit="bytes"
                          />
                        </Grid>
                      </Grid>
                    )}
                  </Sheet>
                </Grid>
              </Grid>
            </TabPanel>
            <TabPanel value={1} sx={{ height: '500px', overflow: 'hidden' }}>
              <LogsViewer
                containerId={container.id}
                containerState={container.state}
              />
            </TabPanel>
          </Tabs>
        </Box>
      </ModalDialog>
    </Modal>
  );
};

export default ContainerMetricsModal;
