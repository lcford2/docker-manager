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
import { useDockerStore } from "../../store/dockerStore";

const ContainersPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [modalContainer, setModalContainer] =
    useState<ContainerStatsWithHistory | null>(null);
  const [selectedContainers, setSelectedContainers] = useState<
    readonly string[]
  >([]);
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
    loading,
    refresh,
  } = useSharedWebSocket({});

  const { error, setError } = useDockerStore();

  // Effect to sync modalContainer with updated containers data (for real-time updates)
  useEffect(() => {
    if (modalContainer) {
      const updatedContainer = containers.find(
        (c) => c.id === modalContainer.id,
      );
      if (updatedContainer) {
        setModalContainer(updatedContainer as ContainerStatsWithHistory);
      }
    }
  }, [containers, modalContainer]);

  // Filter containers by search term
  const filteredContainers = containers.filter(
    (container) =>
      // Apply search filter
      (container.name &&
        container.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      container.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      container.state.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleContainerClick = useCallback(
    (containerId: string) => {
      const container = containers.find((c) => c.id === containerId);
      if (container) {
        setModalContainer(container as ContainerStatsWithHistory);
      }
    },
    [containers],
  );

  const handleCloseModal = useCallback(() => {
    setModalContainer(null);
  }, []);

  const handleRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  // Individual container action handlers
  const confirmStopContainer = useCallback(
    async (containerId: string) => {
      setActionLoading("stop");
      setConfirmDialog((prev) => ({ ...prev, open: false }));

      try {
        await dockerAPI.stopContainer(containerId);
      } catch (err: any) {
        setError(err.message || "Failed to stop container");
      } finally {
        setActionLoading(null);
      }
    },
    [setError],
  );

  const confirmRestartContainer = useCallback(
    async (containerId: string) => {
      setActionLoading("restart");
      setConfirmDialog((prev) => ({ ...prev, open: false }));

      try {
        await dockerAPI.restartContainer(containerId);
      } catch (err: any) {
        setError(err.message || "Failed to restart container");
      } finally {
        setActionLoading(null);
      }
    },
    [setError],
  );

  const confirmStartContainer = useCallback(
    async (containerId: string) => {
      setActionLoading("start");
      setConfirmDialog((prev) => ({ ...prev, open: false }));

      try {
        await dockerAPI.startContainer(containerId);
      } catch (err: any) {
        setError(err.message || "Failed to start container");
      } finally {
        setActionLoading(null);
      }
    },
    [setError],
  );

  const confirmRemoveContainer = useCallback(
    async (containerId: string) => {
      setActionLoading("remove");
      setConfirmDialog((prev) => ({ ...prev, open: false }));

      try {
        await dockerAPI.removeContainer(containerId);
      } catch (err: any) {
        setError(err.message || "Failed to remove container");
      } finally {
        setActionLoading(null);
      }
    },
    [setError],
  );

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

  const handleContainerStart = useCallback(
    (containerId: string) => {
      const container = containers.find((c) => c.id === containerId);
      if (!container) return;

      setConfirmDialog({
        open: true,
        title: "Start Container",
        message: `Are you sure you want to start the container "${container.name}"?`,
        onConfirm: () => confirmStartContainer(containerId),
      });
    },
    [containers, confirmStartContainer],
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
      setSelectedContainers([]);
    } catch (err: any) {
      setError(err.message || "Failed to stop containers");
    } finally {
      setActionLoading(null);
    }
  }, [selectedContainers, setError]);

  const confirmBulkRestartContainers = useCallback(async () => {
    setActionLoading("restart-bulk");
    setConfirmDialog((prev) => ({ ...prev, open: false }));

    try {
      await dockerAPI.bulkRestartContainers(selectedContainers as string[]);
      setSelectedContainers([]);
    } catch (err: any) {
      setError(err.message || "Failed to restart containers");
    } finally {
      setActionLoading(null);
    }
  }, [selectedContainers, setError]);

  const confirmBulkRemoveContainers = useCallback(async () => {
    setActionLoading("remove-bulk");
    setConfirmDialog((prev) => ({ ...prev, open: false }));

    try {
      await dockerAPI.bulkRemoveContainers(selectedContainers as string[]);
      setSelectedContainers([]);
    } catch (err: any) {
      setError(err.message || "Failed to remove containers");
    } finally {
      setActionLoading(null);
    }
  }, [selectedContainers, setError]);

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
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
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
      <Box sx={{ flexGrow: 1, overflowY: "auto" }}>
        <ContainersTable
          containers={filteredContainers as ContainerStatsWithHistory[]}
          selected={selectedContainers}
          onSelectionChange={setSelectedContainers}
          onContainerClick={handleContainerClick}
          onContainerStop={handleContainerStop}
          onContainerRestart={handleContainerRestart}
          onContainerStart={handleContainerStart}
          onContainerRemove={handleContainerRemove}
        />
      </Box>

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
