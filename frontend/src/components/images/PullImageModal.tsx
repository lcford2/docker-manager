import { LoadingButton } from "@mui/lab";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  LinearProgress,
} from "@mui/material";
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
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Pull Docker Image</DialogTitle>

      <DialogContent>
        <Box component="form" onSubmit={handleSubmit} sx={{ pt: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Enter the name of the Docker image you want to pull. Include the tag
            if needed (e.g., nginx:latest).
          </Typography>

          <TextField
            autoFocus
            fullWidth
            label="Image Name"
            placeholder="e.g., nginx:latest, ubuntu:20.04"
            value={imageName}
            onChange={(e) => setImageName(e.target.value)}
            disabled={loading}
            margin="normal"
            helperText="Format: [registry/]repository[:tag]"
          />

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

          {loading && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Pulling image...
              </Typography>
              <LinearProgress />
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <LoadingButton
          onClick={handleSubmit}
          loading={loading}
          variant="contained"
          disabled={!imageName.trim()}
        >
          Pull Image
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
};

export default PullImageModal;
