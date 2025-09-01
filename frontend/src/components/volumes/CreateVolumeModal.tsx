import React, { useState } from "react";
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { LoadingButton } from "@mui/lab";
import { dockerAPI } from "../../services/api";

interface CreateVolumeModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateVolumeModal: React.FC<CreateVolumeModalProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const [volumeName, setVolumeName] = useState("");
  const [driver, setDriver] = useState("local");
  const [labels, setLabels] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (!loading) {
      setVolumeName("");
      setDriver("local");
      setLabels("");
      setError(null);
      onClose();
    }
  };

  const parseLabels = (labelString: string): Record<string, string> => {
    const labels: Record<string, string> = {};
    if (!labelString.trim()) return labels;

    labelString.split(",").forEach((label) => {
      const [key, value] = label.split("=").map((s) => s.trim());
      if (key) {
        labels[key] = value || "";
      }
    });
    return labels;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!volumeName.trim()) {
      setError("Please enter a volume name");
      return;
    }

    // Validate volume name (Docker naming rules)
    const nameRegex = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;
    if (!nameRegex.test(volumeName)) {
      setError(
        "Volume name can only contain letters, numbers, periods, hyphens and underscores, and must start with a letter or number",
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const volumeData = {
        name: volumeName.trim(),
        driver: driver || "local",
        labels: parseLabels(labels),
      };

      await dockerAPI.createVolume(volumeData);
      setVolumeName("");
      setDriver("local");
      setLabels("");
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to create volume");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create Docker Volume</DialogTitle>

      <DialogContent>
        <Box component="form" onSubmit={handleSubmit} sx={{ pt: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Create a new Docker volume for persistent data storage.
          </Typography>

          <TextField
            autoFocus
            fullWidth
            label="Volume Name"
            placeholder="my-volume"
            value={volumeName}
            onChange={(e) => setVolumeName(e.target.value)}
            disabled={loading}
            margin="normal"
            required
            helperText="Name must start with a letter or number and can contain letters, numbers, periods, hyphens and underscores"
          />

          <FormControl fullWidth margin="normal">
            <InputLabel>Driver</InputLabel>
            <Select
              value={driver}
              onChange={(e) => setDriver(e.target.value)}
              disabled={loading}
              label="Driver"
            >
              <MenuItem value="local">Local</MenuItem>
              <MenuItem value="nfs">NFS</MenuItem>
              <MenuItem value="cifs">CIFS</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Labels (Optional)"
            placeholder="env=production,team=backend"
            value={labels}
            onChange={(e) => setLabels(e.target.value)}
            disabled={loading}
            margin="normal"
            multiline
            rows={2}
            helperText="Format: key1=value1,key2=value2 (comma-separated key=value pairs)"
          />

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
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
          disabled={!volumeName.trim()}
        >
          Create Volume
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
};

export default CreateVolumeModal;
