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

import { ImageModalProps } from "../../types/docker";
import {
  formatBytes,
  formatDateTime,
  formatImageTag,
  isDanglingImage,
  splitRepoTag,
} from "../../utils/formatters";

const ImageModal: React.FC<ImageModalProps> = ({ open, onClose, image }) => {
  if (!image) return null;

  const isDangling = isDanglingImage(image.RepoTags);
  const [repository, tag] = splitRepoTag(image.RepoTags[0]);
  const displayName = formatImageTag(repository, tag);

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog layout="fullscreen">
        <DialogTitle>Image Details: {displayName}</DialogTitle>
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
                Image ID: {image.Id}
              </Typography>
              <Typography level="body-sm" color="neutral" sx={{ mb: 1 }}>
                Repository: {repository}
              </Typography>
              <Typography level="body-sm" color="neutral" sx={{ mb: 1 }}>
                Tag: {tag}
              </Typography>
              <Typography level="body-sm" color="neutral" sx={{ mb: 1 }}>
                Size: {formatBytes(image.Size)}
              </Typography>
              {/*{image.virtual_size && (
                <Typography level="body-sm" color="neutral" sx={{ mb: 1 }}>
                  Virtual Size: {formatBytes(image.virtual_size)}
                </Typography>
              )}*/}
              <Typography level="body-sm" color="neutral" sx={{ mb: 1 }}>
                Created: {formatDateTime(image.Created)}
              </Typography>
            </Box>

            {/* Status */}
            {isDangling && (
              <Box sx={{ mb: 3 }}>
                <Typography level="h4" sx={{ mb: 1 }}>
                  Status
                </Typography>
                <Chip color="warning" variant="outlined">
                  Dangling Image
                </Chip>
                <Typography level="body-sm" color="neutral" sx={{ mt: 1 }}>
                  This image is not tagged or referenced by any repository.
                </Typography>
              </Box>
            )}

            <Divider sx={{ my: 2 }} />

            {/* Repository Tags */}
            {image.RepoTags && image.RepoTags.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography level="h4" sx={{ mb: 1 }}>
                  Repository Tags
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                  {image.RepoTags.map((tag, index) => (
                    <Chip key={index} variant="outlined" size="sm">
                      {tag}
                    </Chip>
                  ))}
                </Box>
              </Box>
            )}

            {/* Repository Digests */}
            {image.RepoDigests && image.RepoDigests.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography level="h4" sx={{ mb: 1 }}>
                  Repository Digests
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {image.RepoDigests.map((digest, index) => (
                    <Typography
                      key={index}
                      level="body-sm"
                      color="neutral"
                      sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                    >
                      {digest}
                    </Typography>
                  ))}
                </Box>
              </Box>
            )}

            {/* Parent Image */}
            {image.ParentId && (
              <Box sx={{ mb: 3 }}>
                <Typography level="h4" sx={{ mb: 1 }}>
                  Parent Image
                </Typography>
                <Typography
                  level="body-sm"
                  color="neutral"
                  sx={{ fontFamily: "monospace" }}
                >
                  {image.ParentId}
                </Typography>
              </Box>
            )}

            {/* Labels */}
            {image.Labels && Object.keys(image.Labels).length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography level="h4" sx={{ mb: 1 }}>
                  Labels
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {Object.entries(image.Labels).map(([key, value]) => (
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
          </Box>
        </DialogContent>
      </ModalDialog>
    </Modal>
  );
};

export default ImageModal;
