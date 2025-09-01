import { ViewModule, ViewList } from "@mui/icons-material";
import {
  Grid2 as Grid,
  Box,
  Typography,
  IconButton,
  Tooltip,
} from "@mui/material";
import React, { useState, useEffect } from "react";

import { ImageGridProps, ViewMode } from "../../types/docker";

import ImageCard from "./ImageCard";

const ImageGrid: React.FC<ImageGridProps> = React.memo(
  ({ images, onImageClick, onImageRemove, selectedImage }) => {
    // Get initial view mode from localStorage or default to 'grid'
    const [viewMode, setViewMode] = useState<ViewMode>(() => {
      const saved = localStorage.getItem("imageViewMode");
      return (saved as ViewMode) || "grid";
    });

    // Save view mode to localStorage when it changes
    useEffect(() => {
      localStorage.setItem("imageViewMode", viewMode);
    }, [viewMode]);

    const handleViewToggle = () => {
      setViewMode((prevMode) => (prevMode === "grid" ? "list" : "grid"));
    };

    if (!images || images.length === 0) {
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
            No images found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Pull some images to see them here
          </Typography>
        </Box>
      );
    }

    return (
      <Box sx={{ width: "100%" }}>
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
            Images ({images.length} total)
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
        {/* Images display based on view mode */}
        {viewMode === "grid" ? (
          <Grid container spacing={3}>
            {images.map((image) => (
              <Grid
                key={image.id}
                size={{
                  xs: 12,
                  sm: 6,
                  md: 4,
                  lg: 3,
                }}
              >
                <ImageCard
                  image={image}
                  onDetailsClick={onImageClick}
                  onRemoveClick={onImageRemove}
                  isSelected={selectedImage === image.id}
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
            {images.map((image) => (
              <ImageCard
                key={image.id}
                image={image}
                onDetailsClick={onImageClick}
                onRemoveClick={onImageRemove}
                isSelected={selectedImage === image.id}
                layout="list"
              />
            ))}
          </Box>
        )}
      </Box>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison - only re-render if images array actually changed
    return (
      prevProps.images === nextProps.images &&
      prevProps.selectedImage === nextProps.selectedImage &&
      prevProps.onImageClick === nextProps.onImageClick &&
      prevProps.onImageRemove === nextProps.onImageRemove
    );
  },
);

export default ImageGrid;
