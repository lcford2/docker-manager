import {
  Box,
  Button,
  Modal,
  ModalDialog,
  DialogTitle,
  DialogContent,
  Stack,
  Input,
  FormLabel,
  FormControl,
  FormHelperText,
  Alert,
  Select,
  Option,
} from "@mui/joy";
import { Report } from "@mui/icons-material";
import React, { useState } from "react";

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
    <Modal open={open} onClose={handleClose}>
      <ModalDialog>
        <DialogTitle>Create Docker Volume</DialogTitle>
        <DialogContent>
          Create a new Docker volume for persistent data storage.
        </DialogContent>
        <form onSubmit={handleSubmit}>
          <Stack spacing={2}>
            <FormControl required>
              <FormLabel>Volume Name</FormLabel>
              <Input
                autoFocus
                value={volumeName}
                onChange={(e) => setVolumeName(e.target.value)}
                disabled={loading}
              />
              <FormHelperText>
                Name must start with a letter or number and can contain letters,
                numbers, periods, hyphens and underscores.
              </FormHelperText>
            </FormControl>
            <FormControl>
              <FormLabel>Driver</FormLabel>
              <Select
                value={driver}
                onChange={(_, newValue) => setDriver(newValue || "local")}
                disabled={loading}
              >
                <Option value="local">Local</Option>
                <Option value="nfs">NFS</Option>
                <Option value="cifs">CIFS</Option>
              </Select>
            </FormControl>
            <FormControl>
              <FormLabel>Labels (Optional)</FormLabel>
              <Input
                placeholder="env=production,team=backend"
                value={labels}
                onChange={(e) => setLabels(e.target.value)}
                disabled={loading}
              />
              <FormHelperText>Format: key1=value1,key2=value2</FormHelperText>
            </FormControl>
            {error && (
              <Alert color="danger" startDecorator={<Report />}>
                {error}
              </Alert>
            )}
            <Box
              sx={{
                mt: 2,
                display: "flex",
                justifyContent: "flex-end",
                gap: 1,
              }}
            >
              <Button
                variant="plain"
                color="neutral"
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={loading}
                disabled={!volumeName.trim()}
              >
                Create Volume
              </Button>
            </Box>
          </Stack>
        </form>
      </ModalDialog>
    </Modal>
  );
};

export default CreateVolumeModal;
