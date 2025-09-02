import {
  Box,
  Chip,
  DialogContent,
  DialogTitle,
  Divider,
  Modal,
  ModalClose,
  ModalDialog,
  Typography,
} from "@mui/joy";
import React from "react";

import { VolumeModalProps } from "../../types/docker";
import { formatDateTime, getVolumeDriverDisplay } from "../../utils/formatters";

const VolumeModal: React.FC<VolumeModalProps> = ({ open, onClose, volume }) => {
  if (!volume) return null;

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog layout="fullscreen">
        <DialogTitle>Volume Details: {volume.name}</DialogTitle>
        <ModalClose />
        <Divider />
        <DialogContent>
          <Box sx={{ py: 2 }}>
            {/* Basic Information */}
            <Typography level="h4" sx={{ mb: 1 }}>
              Basic Information
            </Typography>

            <Box sx={{ mb: 3 }}>
              <Typography level="body-sm" color="neutral" sx={{ mb: 1 }}>
                Name: {volume.name}
              </Typography>
              <Typography level="body-sm" color="neutral" sx={{ mb: 1 }}>
                Driver: {getVolumeDriverDisplay(volume.driver)}
              </Typography>
              <Typography level="body-sm" color="neutral" sx={{ mb: 1 }}>
                Scope: {volume.scope || "local"}
              </Typography>
              <Typography level="body-sm" color="neutral" sx={{ mb: 1 }}>
                Mount Point: {volume.mountpoint || "Not available"}
              </Typography>
              <Typography level="body-sm" color="neutral" sx={{ mb: 1 }}>
                Created: {formatDateTime(volume.created)}
              </Typography>
            </Box>

            {/* Status */}
            <Box sx={{ mb: 3 }}>
              <Typography level="h4" sx={{ mb: 1 }}>
                Status
              </Typography>
              <Box sx={{ display: "flex", gap: 1 }}>
                <Chip
                  color="primary"
                  variant="outlined"
                  size="sm"
                >
                  {`Driver: ${getVolumeDriverDisplay(volume.driver)}`}
                </Chip>
                <Chip
                  color="neutral"
                  variant="outlined"
                  size="sm"
                >
                  {`Scope: ${volume.scope || "local"}`}
                </Chip>
              </Box>
            </Box>

            {/* Labels */}
            {volume.labels && Object.keys(volume.labels).length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography level="h4" sx={{ mb: 1 }}>
                  Labels
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {Object.entries(volume.labels).map(([key, value]) => (
                    <Box key={key} sx={{ display: "flex", gap: 2 }}>
                      <Typography
                        level="body-sm"
                        fontWeight="md"
                        sx={{ minWidth: "120px" }}
                      >
                        {key}:
                      </Typography>
                      <Typography level="body-sm" color="neutral">
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
                <Typography level="h4" sx={{ mb: 1 }}>
                  Options
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {Object.entries(volume.options).map(([key, value]) => (
                    <Box key={key} sx={{ display: "flex", gap: 2 }}>
                      <Typography
                        level="body-sm"
                        fontWeight="md"
                        sx={{ minWidth: "120px" }}
                      >
                        {key}:
                      </Typography>
                      <Typography level="body-sm" color="neutral">
                        {value}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {/* Usage Information */}
            <Box sx={{ mb: 3 }}>
              <Typography level="h4" sx={{ mb: 1 }}>
                Usage Information
              </Typography>
              <Typography level="body-sm" color="neutral">
                Mount Point: {volume.mountpoint || "Not specified"}
              </Typography>
              <Typography level="body-sm" color="neutral" sx={{ mt: 1 }}>
                This volume can be mounted by containers to persist data beyond
                the container lifecycle.
              </Typography>
            </Box>
          </Box>
        </DialogContent>
      </ModalDialog>
    </Modal>
  );
};

export default VolumeModal;
