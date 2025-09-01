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
import React from "react";

import { ImageModalProps } from "../../types/docker";
import {
  formatBytes,
  formatDateTime,
  formatImageTag,
  isDanglingImage,
} from "../../utils/formatters";

const ImageModal: React.FC<ImageModalProps> = ({ open, onClose, image }) => {
  if (!image) return null;

  const isDangling = isDanglingImage(image.repository, image.tag);
  const displayName = formatImageTag(image.repository, image.tag);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Image Details: {displayName}</DialogTitle>

      <DialogContent>
        <Box sx={{ py: 2 }}>
          {/* Basic Information */}
          <Typography variant="h6" gutterBottom>
            Basic Information
          </Typography>

          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Image ID: {image.id}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Repository: {image.repository}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Tag: {image.tag}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Size: {formatBytes(image.size)}
            </Typography>
            {image.virtual_size && (
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Virtual Size: {formatBytes(image.virtual_size)}
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Created: {formatDateTime(image.created)}
            </Typography>
          </Box>

          {/* Status */}
          {isDangling && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Status
              </Typography>
              <Chip label="Dangling Image" color="warning" variant="outlined" />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                This image is not tagged or referenced by any repository.
              </Typography>
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

          {/* Repository Tags */}
          {image.repo_tags && image.repo_tags.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Repository Tags
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {image.repo_tags.map((tag, index) => (
                  <Chip
                    key={index}
                    label={tag}
                    variant="outlined"
                    size="small"
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* Repository Digests */}
          {image.repo_digests && image.repo_digests.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Repository Digests
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {image.repo_digests.map((digest, index) => (
                  <Typography
                    key={index}
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                  >
                    {digest}
                  </Typography>
                ))}
              </Box>
            </Box>
          )}

          {/* Parent Image */}
          {image.parent_id && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Parent Image
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontFamily: "monospace" }}
              >
                {image.parent_id}
              </Typography>
            </Box>
          )}

          {/* Labels */}
          {image.labels && Object.keys(image.labels).length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Labels
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {Object.entries(image.labels).map(([key, value]) => (
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
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImageModal;
