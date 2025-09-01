import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Divider,
} from "@mui/material";
import { VolumeModalProps } from "../../types/docker";
import { formatDateTime, getVolumeDriverDisplay } from "../../utils/formatters";

const VolumeModal: React.FC<VolumeModalProps> = ({ open, onClose, volume }) => {
  if (!volume) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Volume Details: {volume.name}</DialogTitle>

      <DialogContent>
        <Box sx={{ py: 2 }}>
          {/* Basic Information */}
          <Typography variant="h6" gutterBottom>
            Basic Information
          </Typography>

          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Name: {volume.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Driver: {getVolumeDriverDisplay(volume.driver)}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Scope: {volume.scope || "local"}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Mount Point: {volume.mountpoint || "Not available"}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Created: {formatDateTime(volume.created)}
            </Typography>
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Status */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Status
            </Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Chip
                label={`Driver: ${getVolumeDriverDisplay(volume.driver)}`}
                variant="outlined"
                size="small"
              />
              <Chip
                label={`Scope: ${volume.scope || "local"}`}
                variant="outlined"
                size="small"
              />
            </Box>
          </Box>

          {/* Labels */}
          {volume.labels && Object.keys(volume.labels).length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Labels
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {Object.entries(volume.labels).map(([key, value]) => (
                  <Box key={key} sx={{ display: "flex", gap: 2 }}>
                    <Typography
                      variant="body2"
                      fontWeight="medium"
                      sx={{ minWidth: "120px" }}
                    >
                      {key}:
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {value || "(empty)"}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* Options */}
          {volume.options && Object.keys(volume.options).length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Options
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {Object.entries(volume.options).map(([key, value]) => (
                  <Box key={key} sx={{ display: "flex", gap: 2 }}>
                    <Typography
                      variant="body2"
                      fontWeight="medium"
                      sx={{ minWidth: "120px" }}
                    >
                      {key}:
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {value}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* Usage Information */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Usage Information
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Mount Point: {volume.mountpoint || "Not specified"}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              This volume can be mounted by containers to persist data beyond
              the container lifecycle.
            </Typography>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default VolumeModal;
