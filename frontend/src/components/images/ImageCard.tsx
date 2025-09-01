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
import { Delete, Image as ImageIcon } from "@mui/icons-material";
import { ImageCardProps } from "../../types/docker";
import {
  formatBytes,
  formatDateTime,
  formatImageTag,
  isDanglingImage,
} from "../../utils/formatters";

const ImageCard: React.FC<ImageCardProps> = React.memo(
  ({
    image,
    onDetailsClick,
    onRemoveClick,
    isSelected = false,
    layout = "grid",
  }) => {
    const theme = useTheme();

    const handleClick = () => {
      onDetailsClick(image.id);
    };

    const handleRemove = (e: React.MouseEvent) => {
      e.stopPropagation();
      onRemoveClick(image.id);
    };

    const isDangling = isDanglingImage(image.repository, image.tag);
    const displayName = formatImageTag(image.repository, image.tag);

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
            {/* Header with image name */}
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                <ImageIcon sx={{ mr: 1, color: "primary.main" }} />
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
                  title={displayName}
                >
                  {displayName}
                </Typography>
              </Box>

              {/* Tags and Status */}
              <Box sx={{ mb: 2 }}>
                {isDangling && (
                  <Chip
                    label="Dangling"
                    size="small"
                    color="warning"
                    sx={{ mb: 1 }}
                  />
                )}
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  ID: {image.id.substring(0, 12)}
                </Typography>
              </Box>

              {/* Image Details */}
              <Box sx={{ mb: 2, flex: 1 }}>
                <Grid container spacing={1}>
                  <Grid size={12}>
                    <Typography variant="caption" color="text.secondary">
                      Size: {formatBytes(image.size)}
                    </Typography>
                  </Grid>
                  <Grid size={12}>
                    <Typography variant="caption" color="text.secondary">
                      Created: {formatDateTime(image.created)}
                    </Typography>
                  </Grid>
                  {image.virtual_size && image.virtual_size !== image.size && (
                    <Grid size={12}>
                      <Typography variant="caption" color="text.secondary">
                        Virtual Size: {formatBytes(image.virtual_size)}
                      </Typography>
                    </Grid>
                  )}
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
            {/* Image Name and Icon */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                minWidth: { xs: "100%", md: "200px" },
                flex: { xs: "none", md: "2 1 200px" },
              }}
            >
              <ImageIcon sx={{ mr: 1, color: "primary.main" }} />
              <Box>
                <Typography
                  variant="h6"
                  component="h3"
                  sx={{
                    fontSize: "1rem",
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: { xs: "200px", md: "none" },
                  }}
                  title={displayName}
                >
                  {displayName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {image.id.substring(0, 12)}
                </Typography>
              </Box>
            </Box>

            {/* Size Information */}
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                flex: { xs: "1 1 100px", md: "1 1 120px" },
                minWidth: 100,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Size
              </Typography>
              <Typography variant="body2" fontWeight="medium">
                {formatBytes(image.size)}
              </Typography>
            </Box>

            {/* Created Date */}
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                flex: { xs: "1 1 100px", md: "1 1 120px" },
                minWidth: 100,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Created
              </Typography>
              <Typography variant="body2" fontWeight="medium">
                {formatDateTime(image.created)}
              </Typography>
            </Box>

            {/* Status and Actions */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                flex: { xs: "1 1 100px", md: "1 1 120px" },
                minWidth: 100,
              }}
            >
              {isDangling && (
                <Chip label="Dangling" size="small" color="warning" />
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
      prevProps.image.id === nextProps.image.id &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.layout === nextProps.layout
    );
  },
);

export default ImageCard;
