import { ViewModule, ViewList } from "@mui/icons-material";
import {
  Grid2 as Grid,
  Box,
  Typography,
  IconButton,
  Tooltip,
} from "@mui/material";
import React, { useState, useEffect } from "react";

import { VolumeGridProps, ViewMode } from "../../types/docker";

import VolumeCard from "./VolumeCard";

const VolumeGrid: React.FC<VolumeGridProps> = React.memo(
  ({ volumes, onVolumeClick, onVolumeRemove, selectedVolume }) => {
    // Get initial view mode from localStorage or default to 'grid'
    const [viewMode, setViewMode] = useState<ViewMode>(() => {
      const saved = localStorage.getItem("volumeViewMode");
      return (saved as ViewMode) || "grid";
    });

    // Save view mode to localStorage when it changes
    useEffect(() => {
      localStorage.setItem("volumeViewMode", viewMode);
    }, [viewMode]);

    const handleViewToggle = () => {
      setViewMode((prevMode) => (prevMode === "grid" ? "list" : "grid"));
    };

    if (!volumes || volumes.length === 0) {
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
            No volumes found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create some volumes to see them here
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
            width: "100%",
          }}
        >
          <Typography variant="h5" component="h2">
            Volumes ({volumes.length} total)
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
        {/* Volumes display based on view mode */}
        {viewMode === "grid" ? (
          <Grid container spacing={3}>
            {volumes.map((volume) => (
              <Grid
                key={volume.name}
                size={{
                  xs: 12,
                  sm: 6,
                  md: 4,
                  lg: 3,
                }}
              >
                <VolumeCard
                  volume={volume}
                  onDetailsClick={onVolumeClick}
                  onRemoveClick={onVolumeRemove}
                  isSelected={selectedVolume === volume.name}
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
            {volumes.map((volume) => (
              <VolumeCard
                key={volume.name}
                volume={volume}
                onDetailsClick={onVolumeClick}
                onRemoveClick={onVolumeRemove}
                isSelected={selectedVolume === volume.name}
                layout="list"
              />
            ))}
          </Box>
        )}
      </Box>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison - only re-render if volumes array actually changed
    return (
      prevProps.volumes === nextProps.volumes &&
      prevProps.selectedVolume === nextProps.selectedVolume &&
      prevProps.onVolumeClick === nextProps.onVolumeClick &&
      prevProps.onVolumeRemove === nextProps.onVolumeRemove
    );
  },
);

export default VolumeGrid;
