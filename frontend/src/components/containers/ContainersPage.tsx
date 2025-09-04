import { Search, Refresh, Delete, Pause } from "@mui/icons-material";
import {
  Box,
  Typography,
  Input,
  CircularProgress,
  Button,
  Alert,
  IconButton,
} from "@mui/joy";
import React, { useState, useCallback, useEffect } from "react";

import { useSharedWebSocket } from "../../hooks/useSharedWebSocket";
import { ContainerStatsWithHistory } from "../../types/metrics";
import { dockerAPI } from "../../services/api";
import ConfirmDialog from "../common/ConfirmDialog";

import ContainersTable from "./ContainersTable";
import ContainerMetricsModal from "./ContainerMetricsModal";

const ContainersPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContainer, setSelectedContainer] = useState<string | null>(
    null,
  );
  const [modalContainer, setModalContainer] =
    useState<ContainerStatsWithHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedContainers, setSelectedContainers] = useState<
    readonly string[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  // Shared WebSocket connection for real-time container metrics
  const {
    isConnected,
    containers,
    error: wsError,
    refresh,
  } = useSharedWebSocket({
    onContainerStats: (containerStats: ContainerStatsWithHistory[]) => {
      console.log("ContainersPage updated with WebSocket container data");
      setLoading(false); // Mark as loaded when we receive data
    },
  });

  // Clear loading state when WebSocket connects, even if no containers
  useEffect(() => {
    if (isConnected) {
      // Give a brief moment for initial data, then clear loading
      const timer = setTimeout(() => {
        setLoading(false);
      }, 2000); // 2 second timeout

      return () => clearTimeout(timer);
    }
  }, [isConnected]);

  // NEW: Effect to sync modalContainer with updated containers data (for real-time updates)
  useEffect(() => {
    if (selectedContainer && modalContainer) {
      const updatedContainer = containers.find(
        (c) => c.id === selectedContainer,
      );
      if (updatedContainer && updatedContainer !== modalContainer) {
        // Only update if the data has meaningfully changed (avoids unnecessary re-renders)
        if (
          updatedContainer.cpu_percent !== modalContainer.cpu_percent ||
          updatedContainer.memory_percent !== modalContainer.memory_percent
          // Add other key fields as needed, e.g., JSON.stringify(updatedContainer.sparkline_data) !== JSON.stringify(modalContainer.sparkline_data)
        ) {
          setModalContainer(updatedContainer);
        }
      }
    }
  }, [containers, selectedContainer, modalContainer]);

  // Filter containers based on search term
  const filteredContainers = containers.filter(
    (container) =>
      container.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      container.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      container.status.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleContainerClick = useCallback(
    (containerId: string) => {
      setSelectedContainer(containerId);
      const container = containers.find((c) => c.id === containerId);
      if (container) {
        setModalContainer(container);
      }
    },
    [containers],
  );

  const handleCloseModal = useCallback(() => {
    setSelectedContainer(null);
    setModalContainer(null);
  }, []);

  const handleRefresh = useCallback(() => {
    // Use the shared WebSocket refresh function
    refresh();
  }, [refresh]);

  // Individual container action handlers
  const confirmStopContainer = useCallback(async (containerId: string) => {
    setActionLoading("stop");
    setConfirmDialog((prev) => ({ ...prev, open: false }));

    try {
      await dockerAPI.stopContainer(containerId);
      // WebSocket will automatically update the container list
    } catch (err: any) {
      setError(err.message || "Failed to stop container");
    } finally {
      setActionLoading(null);
    }
  }, []);

  const confirmRestartContainer = useCallback(async (containerId: string) => {
    setActionLoading("restart");
    setConfirmDialog((prev) => ({ ...prev, open: false }));

    try {
      await dockerAPI.restartContainer(containerId);
      // WebSocket will automatically update the container list
    } catch (err: any) {
      setError(err.message || "Failed to restart container");
    } finally {
      setActionLoading(null);
    }
  }, []);

  const confirmRemoveContainer = useCallback(async (containerId: string) => {
    setActionLoading("remove");
    setConfirmDialog((prev) => ({ ...prev, open: false }));

    try {
      await dockerAPI.removeContainer(containerId);
      // WebSocket will automatically update the container list
    } catch (err: any) {
      setError(err.message || "Failed to remove container");
    } finally {
      setActionLoading(null);
    }
  }, []);

  const handleContainerStop = useCallback(
    (containerId: string) => {
      const container = containers.find((c) => c.id === containerId);
      if (!container) return;

      setConfirmDialog({
        open: true,
        title: "Stop Container",
        message: `Are you sure you want to stop the container "${container.name}"?`,
        onConfirm: () => confirmStopContainer(containerId),
      });
    },
    [containers, confirmStopContainer],
  );

  const handleContainerRestart = useCallback(
    (containerId: string) => {
      const container = containers.find((c) => c.id === containerId);
      if (!container) return;

      setConfirmDialog({
        open: true,
        title: "Restart Container",
        message: `Are you sure you want to restart the container "${container.name}"?`,
        onConfirm: () => confirmRestartContainer(containerId),
      });
    },
    [containers, confirmRestartContainer],
  );

  const handleContainerRemove = useCallback(
    (containerId: string) => {
      const container = containers.find((c) => c.id === containerId);
      if (!container) return;

      setConfirmDialog({
        open: true,
        title: "Remove Container",
        message: `Are you sure you want to remove the container "${container.name}"? This action cannot be undone.`,
        onConfirm: () => confirmRemoveContainer(containerId),
      });
    },
    [containers, confirmRemoveContainer],
  );

  // Bulk container action handlers
  const confirmBulkStopContainers = useCallback(async () => {
    setActionLoading("stop-bulk");
    setConfirmDialog((prev) => ({ ...prev, open: false }));

    try {
      await dockerAPI.bulkStopContainers(selectedContainers as string[]);
      // WebSocket will automatically update the container list
      setSelectedContainers([]); // Clear selection
    } catch (err: any) {
      setError(err.message || "Failed to stop containers");
    } finally {
      setActionLoading(null);
    }
  }, [selectedContainers]);

  const confirmBulkRestartContainers = useCallback(async () => {
    setActionLoading("restart-bulk");
    setConfirmDialog((prev) => ({ ...prev, open: false }));

    try {
      await dockerAPI.bulkRestartContainers(selectedContainers as string[]);
      // WebSocket will automatically update the container list
      setSelectedContainers([]); // Clear selection
    } catch (err: any) {
      setError(err.message || "Failed to restart containers");
    } finally {
      setActionLoading(null);
    }
  }, [selectedContainers]);

  const confirmBulkRemoveContainers = useCallback(async () => {
    setActionLoading("remove-bulk");
    setConfirmDialog((prev) => ({ ...prev, open: false }));

    try {
      await dockerAPI.bulkRemoveContainers(selectedContainers as string[]);
      // WebSocket will automatically update the container list
      setSelectedContainers([]); // Clear selection
    } catch (err: any) {
      setError(err.message || "Failed to remove containers");
    } finally {
      setActionLoading(null);
    }
  }, [selectedContainers]);

  const handleBulkContainerStop = useCallback(() => {
    setConfirmDialog({
      open: true,
      title: "Stop Containers",
      message: `Are you sure you want to stop the ${selectedContainers.length} selected containers?`,
      onConfirm: () => confirmBulkStopContainers(),
    });
  }, [selectedContainers, confirmBulkStopContainers]);

  const handleBulkContainerRestart = useCallback(() => {
    setConfirmDialog({
      open: true,
      title: "Restart Containers",
      message: `Are you sure you want to restart the ${selectedContainers.length} selected containers?`,
      onConfirm: () => confirmBulkRestartContainers(),
    });
  }, [selectedContainers, confirmBulkRestartContainers]);

  const handleBulkContainerRemove = useCallback(() => {
    setConfirmDialog({
      open: true,
      title: "Remove Containers",
      message: `Are you sure you want to remove the ${selectedContainers.length} selected containers? This action cannot be undone.`,
      onConfirm: () => confirmBulkRemoveContainers(),
    });
  }, [selectedContainers, confirmBulkRemoveContainers]);

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress />
        <Typography level="body-lg" sx={{ ml: 2 }}>
          {!isConnected
            ? "Connecting to container metrics..."
            : "Loading container data..."}
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Typography level="h2" component="h1">
          Docker Containers
        </Typography>

        <Box sx={{ display: "flex", gap: 2 }}>
          {selectedContainers.length > 0 && (
            <>
              <Button
                variant="solid"
                color="warning"
                startDecorator={<Pause />}
                onClick={handleBulkContainerStop}
                disabled={actionLoading !== null}
              >
                Stop ({selectedContainers.length})
              </Button>
              <Button
                variant="solid"
                color="primary"
                startDecorator={<Refresh />}
                onClick={handleBulkContainerRestart}
                disabled={actionLoading !== null}
              >
                Restart ({selectedContainers.length})
              </Button>
              <Button
                variant="solid"
                color="danger"
                startDecorator={<Delete />}
                onClick={handleBulkContainerRemove}
                disabled={actionLoading !== null}
              >
                Remove ({selectedContainers.length})
              </Button>
            </>
          )}
          <Button
            variant="outlined"
            startDecorator={<Refresh />}
            onClick={handleRefresh}
            disabled={loading || actionLoading !== null}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Offline Indicator */}
      {!isConnected && !loading && (
        <Box sx={{ mb: 2 }}>
          <Typography color="warning">
            Connection offline. Real-time updates are paused.
          </Typography>
        </Box>
      )}

      {/* Search */}
      <Box sx={{ mb: 3 }}>
        <Input
          fullWidth
          placeholder="Search containers by name, ID, or status..."
          value={searchTerm}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setSearchTerm(e.target.value)
          }
          startDecorator={<Search />}
        />
      </Box>

      {/* WebSocket Error */}
      {wsError && (
        <Box sx={{ mb: 2 }}>
          <Typography color="danger">Connection error: {wsError}</Typography>
        </Box>
      )}

      {/* Error Alert */}
      {error && (
        <Alert
          color="danger"
          sx={{ mb: 2 }}
          endDecorator={
            <IconButton
              variant="plain"
              size="sm"
              color="danger"
              onClick={() => setError(null)}
            >
              X
            </IconButton>
          }
        >
          {error}
        </Alert>
      )}

      {/* Container Metrics Table */}
      <ContainersTable
        containers={filteredContainers}
        selected={selectedContainers}
        onSelectionChange={setSelectedContainers}
        onContainerClick={handleContainerClick}
        onContainerStop={handleContainerStop}
        onContainerRestart={handleContainerRestart}
        onContainerRemove={handleContainerRemove}
      />

      {/* Container Metrics Modal */}
      <ContainerMetricsModal
        open={!!modalContainer}
        onClose={handleCloseModal}
        container={modalContainer}
      />

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        loading={
          actionLoading === "stop" ||
          actionLoading === "restart" ||
          actionLoading === "remove" ||
          actionLoading === "stop-bulk" ||
          actionLoading === "restart-bulk" ||
          actionLoading === "remove-bulk"
        }
      />
    </Box>
  );
};

export default ContainersPage;
