import { ViewModule, ViewList } from "@mui/icons-material";
import {
  Grid2 as Grid,
  Box,
  Typography,
  IconButton,
  Tooltip,
} from "@mui/material";
import React, { useState, useEffect } from "react";

import { ContainerGridProps, ViewMode } from "../../types/metrics";

import ContainerCard from "./ContainerCard";

const ContainerGrid: React.FC<ContainerGridProps> = React.memo(
  ({ containers, onContainerClick, selectedContainer }) => {
    // Get initial view mode from localStorage or default to 'grid'
    const [viewMode, setViewMode] = useState<ViewMode>(() => {
      const saved = localStorage.getItem("containerViewMode");
      return (saved as ViewMode) || "grid";
    });

    // Save view mode to localStorage when it changes
    useEffect(() => {
      localStorage.setItem("containerViewMode", viewMode);
    }, [viewMode]);

    const handleViewToggle = () => {
      setViewMode((prevMode) => (prevMode === "grid" ? "list" : "grid"));
    };

    if (!containers || containers.length === 0) {
      return (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 200,
            textAlign: "center",
          }}
        >
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No running containers
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Start some containers to see their metrics here
          </Typography>
        </Box>
      );
    }

    return (
      <Box>
        {/* Header with title and view toggle */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 3,
          }}
        >
          <Typography variant="h5" component="h2">
            Container Metrics ({containers.length} running)
          </Typography>

          <Tooltip
            title={`Switch to ${viewMode === "grid" ? "list" : "grid"} view`}
          >
            <IconButton
              onClick={handleViewToggle}
              sx={{
                backgroundColor: "action.hover",
                "&:hover": {
                  backgroundColor: "action.selected",
                },
              }}
            >
              {viewMode === "grid" ? <ViewList /> : <ViewModule />}
            </IconButton>
          </Tooltip>
        </Box>
        {/* Container display based on view mode */}
        {viewMode === "grid" ? (
          <Grid container spacing={3}>
            {containers.map((container) => (
              <Grid
                key={container.id}
                size={{
                  xs: 12,
                  sm: 6,
                  md: 4,
                  lg: 3,
                }}
              >
                <ContainerCard
                  container={container}
                  onDetailsClick={onContainerClick}
                  isSelected={selectedContainer === container.id}
                  layout="grid"
                />
              </Grid>
            ))}
          </Grid>
        ) : (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              width: "100%",
            }}
          >
            {containers.map((container) => (
              <ContainerCard
                key={container.id}
                container={container}
                onDetailsClick={onContainerClick}
                isSelected={selectedContainer === container.id}
                layout="list"
              />
            ))}
          </Box>
        )}
      </Box>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison - only re-render if containers array actually changed
    return (
      prevProps.containers === nextProps.containers &&
      prevProps.selectedContainer === nextProps.selectedContainer &&
      prevProps.onContainerClick === nextProps.onContainerClick
    );
  },
);

export default ContainerGrid;
