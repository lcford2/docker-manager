import { Search, Refresh } from "@mui/icons-material";
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  CircularProgress,
  Button,
} from "@mui/material";
import React, { useState, useCallback, useEffect } from "react";

import { useSharedWebSocket } from "../../hooks/useSharedWebSocket";
import { ContainerStatsWithHistory } from "../../types/metrics";

import ContainerGrid from "./ContainerGrid";
import ContainerMetricsModal from "./ContainerMetricsModal";

const ContainersPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContainer, setSelectedContainer] = useState<string | null>(
    null,
  );
  const [modalContainer, setModalContainer] =
    useState<ContainerStatsWithHistory | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (!isConnected || loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
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
        <Typography variant="h4" component="h1">
          Docker Containers
        </Typography>

        <Box sx={{ display: "flex", gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Search */}
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Search containers by name, ID, or status..."
          value={searchTerm}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setSearchTerm(e.target.value)
          }
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* WebSocket Error */}
      {wsError && (
        <Box sx={{ mb: 2 }}>
          <Typography color="error">Connection error: {wsError}</Typography>
        </Box>
      )}

      {/* Container Metrics Grid */}
      <ContainerGrid
        containers={filteredContainers}
        onContainerClick={handleContainerClick}
        selectedContainer={selectedContainer}
      />

      {/* Container Metrics Modal */}
      <ContainerMetricsModal
        open={!!modalContainer}
        onClose={handleCloseModal}
        container={modalContainer}
      />
    </Box>
  );
};

export default ContainersPage;
