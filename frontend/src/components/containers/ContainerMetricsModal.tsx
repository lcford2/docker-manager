import { Close } from "@mui/icons-material";
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
              <Tab>Metrics History</Tab>
            </TabList>
            <TabPanel value={0}>
              <Grid container spacing={2} sx={{ flexGrow: 1 }}>
                <Grid xs={12} md={6}>
                  <Sheet
                    variant="outlined"
                    sx={{ p: 2, borderRadius: "sm", height: "100%" }}
                  >
                    <Typography level="title-md" mb={2}>
                      Summary
                    </Typography>
                    <Typography>ID: {container.id}</Typography>
                    <Typography>State: {container.state}</Typography>
                    <Typography>Uptime: {container.uptime}</Typography>
                    <Typography>
                      Timestamp: {formatDateTime(container.timestamp)}
                    </Typography>
                  </Sheet>
                </Grid>
                <Grid xs={12} md={6}>
                  <Sheet
                    variant="outlined"
                    sx={{ p: 2, borderRadius: "sm", height: "100%" }}
                  >
                    <Typography level="title-md" mb={2}>
                      Resource Usage
                    </Typography>
                    <Typography>
                      CPU: {(container.cpu_percent ?? 0).toFixed(2)}%
                    </Typography>
                    <Typography>
                      Memory: {(container.memory_percent ?? 0).toFixed(2)}% (
                      {formatBytes(container.memory_usage ?? 0)} /{" "}
                      {formatBytes(container.memory_limit ?? 0)})
                    </Typography>
                    <Typography>
                      Network I/O: {formatBytes(container.network_rx ?? 0)} /{" "}
                      {formatBytes(container.network_tx ?? 0)}
                    </Typography>
                    <Typography>
                      Block I/O: {formatBytes(container.block_read ?? 0)} /{" "}
                      {formatBytes(container.block_write ?? 0)}
                    </Typography>
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
            <TabPanel value={1}>
              {/* This is a placeholder for a more detailed historical chart */}
              <Typography>
                Historical charts would be implemented here.
              </Typography>
            </TabPanel>
          </Tabs>
        </Box>
      </ModalDialog>
    </Modal>
  );
};

export default ContainerMetricsModal;
