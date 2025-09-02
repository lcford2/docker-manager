import {
  Alert,
  Box,
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormLabel,
  Input,
  LinearProgress,
  Modal,
  ModalClose,
  ModalDialog,
  Typography,
} from "@mui/joy";
import React, { useState } from "react";

import { dockerAPI } from "../../services/api";

interface PullImageModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PullImageModal: React.FC<PullImageModalProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const [imageName, setImageName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (!loading) {
      setImageName("");
      setError(null);
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!imageName.trim()) {
      setError("Please enter an image name");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await dockerAPI.pullImage(imageName.trim());
      setImageName("");
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to pull image");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose}>
      <ModalDialog>
        <DialogTitle>Pull Docker Image</DialogTitle>
        <ModalClose />
        <DialogContent>
          <Box component="form" onSubmit={handleSubmit} sx={{ pt: 2 }}>
            <Typography level="body-sm" color="neutral" sx={{ mb: 1 }}>
              Enter the name of the Docker image you want to pull. Include the
              tag if needed (e.g., nginx:latest).
            </Typography>

            <FormControl sx={{ mt: 1 }}>
              <FormLabel>Image Name</FormLabel>
              <Input
                autoFocus
                placeholder="e.g., nginx:latest, ubuntu:20.04"
                value={imageName}
                onChange={(e) => setImageName(e.target.value)}
                disabled={loading}
              />
            </FormControl>

            {error && (
              <Alert color="danger" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}

            {loading && (
              <Box sx={{ mt: 2 }}>
                <Typography level="body-sm" color="neutral" sx={{ mb: 1 }}>
                  Pulling image...
                </Typography>
                <LinearProgress />
              </Box>
            )}
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose} disabled={loading} variant="plain">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={loading}
            variant="solid"
            disabled={!imageName.trim()}
          >
            Pull Image
          </Button>
        </DialogActions>
      </ModalDialog>
    </Modal>
  );
};

export default PullImageModal;
