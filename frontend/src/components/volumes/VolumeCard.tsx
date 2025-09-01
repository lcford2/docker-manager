import React from "react";
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Grid2 as Grid,
  useTheme,
  IconButton,
} from "@mui/material";
import {
  Delete,
  Storage as StorageIcon,
} from "@mui/icons-material";
import { VolumeCardProps } from "../../types/docker";
import {
  formatDateTime,
  getVolumeDriverDisplay,
  formatLabels,
} from "../../utils/formatters";

const VolumeCard: React.FC<VolumeCardProps> = React.memo(
  ({
    volume,
    onDetailsClick,
    onRemoveClick,
    isSelected = false,
    layout = "grid",
  }) => {
    const theme = useTheme();

    const handleClick = () => {
      onDetailsClick(volume.name);
    };

    const handleRemove = (e: React.MouseEvent) => {
      e.stopPropagation();
      onRemoveClick(volume.name);
    };

    // Check if volume is in use (simplified check)
    const isInUse =
      volume.labels &&
      Object.keys(volume.labels).some(
        (key) => key.includes("container") || key.includes("compose"),
      );

    // Grid view layout (vertical layout)
    if (layout === "grid") {
      return (
        <Card
          onClick={handleClick}
          sx={{
            height: "100%",
            transition: "all 0.2s ease-in-out",
            border: isSelected
              ? `2px solid ${theme.palette.primary.main}`
              : "1px solid transparent",
            boxShadow: isSelected
              ? `0 4px 12px ${theme.palette.primary.main}30`
              : "0 2px 8px rgba(0,0,0,0.1)",
            "&:hover": {
              transform: "translateY(-2px)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
              cursor: "pointer",
            },
          }}
        >
          <CardContent
            sx={{
              p: 2,
              height: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          >
              {/* Header with volume name */}
              <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                <StorageIcon sx={{ mr: 1, color: "primary.main" }} />
                <Typography
                  variant="h6"
                  component="h3"
                  sx={{
                    fontSize: "1rem",
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                  }}
                  title={volume.name}
                >
                  {volume.name}
                </Typography>
              </Box>

              {/* Status and Driver */}
              <Box sx={{ mb: 2 }}>
                {isInUse && (
                  <Chip
                    label="In Use"
                    size="small"
                    color="success"
                    sx={{ mb: 1, mr: 1 }}
                  />
                )}
                <Chip
                  label={getVolumeDriverDisplay(volume.driver)}
                  size="small"
                  variant="outlined"
                  sx={{ mb: 1 }}
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  Scope: {volume.scope || "local"}
                </Typography>
              </Box>

              {/* Volume Details */}
              <Box sx={{ mb: 2, flex: 1 }}>
                <Grid container spacing={1}>
                  <Grid size={12}>
                    <Typography variant="caption" color="text.secondary">
                      Created: {formatDateTime(volume.created)}
                    </Typography>
                  </Grid>
                  <Grid size={12}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        display: "block",
                      }}
                      title={volume.mountpoint}
                    >
                      Mount: {volume.mountpoint || "Not available"}
                    </Typography>
                  </Grid>
                  <Grid size={12}>
                    <Typography variant="caption" color="text.secondary">
                      Labels: {formatLabels(volume.labels)}
                    </Typography>
                  </Grid>
                </Grid>
              </Box>

              {/* Action Buttons */}
              <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
                <IconButton
                  size="small"
                  onClick={handleRemove}
                  sx={{
                    backgroundColor: "error.main",
                    color: "white",
                    "&:hover": {
                      backgroundColor: "error.dark",
                    },
                  }}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </Box>
          </CardContent>
        </Card>
      );
    }

    // List view layout (horizontal layout)
    return (
      <Card
        onClick={handleClick}
        sx={{
          width: "100%",
          transition: "all 0.2s ease-in-out",
          border: isSelected
            ? `2px solid ${theme.palette.primary.main}`
            : "1px solid transparent",
          boxShadow: isSelected
            ? `0 4px 12px ${theme.palette.primary.main}30`
            : "0 2px 8px rgba(0,0,0,0.1)",
          "&:hover": {
            transform: "translateY(-1px)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
            cursor: "pointer",
          },
        }}
      >
        <CardContent sx={{ p: 2, width: "100%" }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              flexWrap: { xs: "wrap", md: "nowrap" },
              width: "100%",
            }}
          >
            {/* Volume Name and Icon */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                minWidth: { xs: "100%", md: "180px" },
                flex: { xs: "none", md: "2 1 180px" },
              }}
            >
              <StorageIcon sx={{ mr: 1, color: "primary.main" }} />
              <Box sx={{ overflow: "hidden" }}>
                <Typography
                  variant="h6"
                  component="h3"
                  sx={{
                    fontSize: "1rem",
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: { xs: "200px", sm: "250px", md: "300px" },
                  }}
                  title={volume.name}
                >
                  {volume.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {getVolumeDriverDisplay(volume.driver)} •{" "}
                  {volume.scope || "local"}
                </Typography>
              </Box>
            </Box>

            {/* Mount Point */}
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                flex: { xs: "1 1 200px", md: "3 1 250px" },
                minWidth: 150,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Mount Point
              </Typography>
              <Typography
                variant="body2"
                fontWeight="medium"
                sx={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "100%",
                  textAlign: "center",
                }}
                title={volume.mountpoint}
              >
                {volume.mountpoint || "Not available"}
              </Typography>
            </Box>

            {/* Created Date */}
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                flex: { xs: "1 1 120px", md: "1 1 120px" },
                minWidth: 100,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Created
              </Typography>
              <Typography variant="body2" fontWeight="medium">
                {formatDateTime(volume.created)}
              </Typography>
            </Box>

            {/* Status and Actions */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                flex: { xs: "1 1 120px", md: "1 1 120px" },
                minWidth: 100,
              }}
            >
              {isInUse && (
                <Chip label="In Use" size="small" color="success" />
              )}
              <Box sx={{ display: "flex", gap: 1, marginLeft: "auto" }}>
                <IconButton
                  size="small"
                  onClick={handleRemove}
                  sx={{
                    backgroundColor: "error.main",
                    color: "white",
                    "&:hover": {
                      backgroundColor: "error.dark",
                    },
                  }}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function to prevent unnecessary re-renders
    return (
      prevProps.volume.name === nextProps.volume.name &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.layout === nextProps.layout
    );
  },
);

export default VolumeCard;
