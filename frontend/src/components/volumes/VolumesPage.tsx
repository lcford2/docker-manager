import { Refresh, Add, Search } from "@mui/icons-material";
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  Button,
  TextField,
  InputAdornment,
} from "@mui/material";
import React, { useState, useEffect, useCallback } from "react";

import { dockerAPI } from "../../services/api";
import { DockerVolume } from "../../types/docker";
import ConfirmDialog from "../common/ConfirmDialog";

import CreateVolumeModal from "./CreateVolumeModal";
import VolumeGrid from "./VolumeGrid";
import VolumeModal from "./VolumeModal";

const VolumesPage: React.FC = () => {
  const [volumes, setVolumes] = useState<DockerVolume[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal states
  const [selectedVolume, setSelectedVolume] = useState<string | null>(null);
  const [modalVolume, setModalVolume] = useState<DockerVolume | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  // Fetch volumes
  const fetchVolumes = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await dockerAPI.getVolumes();
      setVolumes(response);
    } catch (err: any) {
      setError(err.message || "Failed to fetch volumes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVolumes();
  }, [fetchVolumes]);

  // Handle volume selection
  const handleVolumeClick = useCallback(
    (volumeName: string) => {
      setSelectedVolume(volumeName);
      const volume = volumes.find((v) => v.name === volumeName);
      if (volume) {
        setModalVolume(volume);
      }
    },
    [volumes],
  );

  // Handle close modal
  const handleCloseModal = useCallback(() => {
    setSelectedVolume(null);
    setModalVolume(null);
  }, []);

  const confirmRemoveVolume = useCallback(
    async (volumeName: string) => {
      setActionLoading("remove");
      setConfirmDialog((prev) => ({ ...prev, open: false }));

      try {
        await dockerAPI.removeVolume(volumeName);
        await fetchVolumes(); // Refresh the list
      } catch (err: any) {
        setError(err.message || "Failed to remove volume");
      } finally {
        setActionLoading(null);
      }
    },
    [fetchVolumes],
  );

  // Handle volume removal
  const handleVolumeRemove = useCallback(
    (volumeName: string) => {
      const volume = volumes.find((v) => v.name === volumeName);
      if (!volume) return;

      setConfirmDialog({
        open: true,
        title: "Remove Volume",
        message: `Are you sure you want to remove the volume "${volume.name}"? This action cannot be undone and will delete all data in the volume.`,
        onConfirm: () => confirmRemoveVolume(volumeName),
      });
    },
    [volumes, confirmRemoveVolume],
  );

  // Filter volumes based on search term
  const filteredVolumes = volumes.filter(
    (volume) =>
      volume.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      volume.driver.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Typography variant="h4" component="h1">
          Docker Volumes
        </Typography>

        <Box sx={{ display: "flex", gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Add />}
            onClick={() => setCreateModalOpen(true)}
          >
            Create Volume
          </Button>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={fetchVolumes}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Search */}
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Search volumes by name or driver..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Volumes Grid */}
      <VolumeGrid
        volumes={filteredVolumes}
        onVolumeClick={handleVolumeClick}
        onVolumeRemove={handleVolumeRemove}
        selectedVolume={selectedVolume}
      />

      {/* Volume Details Modal */}
      <VolumeModal
        open={!!modalVolume}
        onClose={handleCloseModal}
        volume={modalVolume}
      />

      {/* Create Volume Modal */}
      <CreateVolumeModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => {
          setCreateModalOpen(false);
          fetchVolumes();
        }}
      />

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        loading={actionLoading === "remove"}
      />
    </Box>
  );
};

export default VolumesPage;
