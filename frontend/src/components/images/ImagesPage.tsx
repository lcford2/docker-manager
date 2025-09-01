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
import { DockerImage } from "../../types/docker";
import ConfirmDialog from "../common/ConfirmDialog";

import ImageGrid from "./ImageGrid";
import ImageModal from "./ImageModal";
import PullImageModal from "./PullImageModal";

const ImagesPage: React.FC = () => {
  const [images, setImages] = useState<DockerImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal states
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [modalImage, setModalImage] = useState<DockerImage | null>(null);
  const [pullModalOpen, setPullModalOpen] = useState(false);

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

  // Fetch images
  const fetchImages = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await dockerAPI.getImages();
      setImages(response);
    } catch (err: any) {
      setError(err.message || "Failed to fetch images");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  // Handle image selection
  const handleImageClick = useCallback(
    (imageId: string) => {
      setSelectedImage(imageId);
      const image = images.find((img) => img.id === imageId);
      if (image) {
        setModalImage(image);
      }
    },
    [images],
  );

  // Handle close modal
  const handleCloseModal = useCallback(() => {
    setSelectedImage(null);
    setModalImage(null);
  }, []);

  const confirmRemoveImage = useCallback(
    async (imageId: string) => {
      setActionLoading("remove");
      setConfirmDialog((prev) => ({ ...prev, open: false }));

      try {
        await dockerAPI.removeImage(imageId);
        await fetchImages(); // Refresh the list
      } catch (err: any) {
        setError(err.message || "Failed to remove image");
      } finally {
        setActionLoading(null);
      }
    },
    [fetchImages],
  );

  // Handle image removal
  const handleImageRemove = useCallback(
    (imageId: string) => {
      const image = images.find((img) => img.id === imageId);
      if (!image) return;

      setConfirmDialog({
        open: true,
        title: "Remove Image",
        message: `Are you sure you want to remove the image "${image.repository}:${image.tag}"? This action cannot be undone.`,
        onConfirm: () => confirmRemoveImage(imageId),
      });
    },
    [images, confirmRemoveImage],
  );

  // Handle pull image success
  const handlePullSuccess = useCallback(() => {
    setPullModalOpen(false);
    fetchImages(); // Refresh the list
  }, [fetchImages]);

  // Filter images based on search term
  const filteredImages = images.filter(
    (image) =>
      image.repository.toLowerCase().includes(searchTerm.toLowerCase()) ||
      image.tag.toLowerCase().includes(searchTerm.toLowerCase()) ||
      image.id.toLowerCase().includes(searchTerm.toLowerCase()),
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
          Docker Images
        </Typography>

        <Box sx={{ display: "flex", gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Add />}
            onClick={() => setPullModalOpen(true)}
          >
            Pull Image
          </Button>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={fetchImages}
            disabled={loading || actionLoading !== null}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Search */}
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Search images by repository, tag, or ID..."
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

      {/* Images Grid */}
      <ImageGrid
        images={filteredImages}
        onImageClick={handleImageClick}
        onImageRemove={handleImageRemove}
        selectedImage={selectedImage}
      />

      {/* Image Details Modal */}
      <ImageModal
        open={!!modalImage}
        onClose={handleCloseModal}
        image={modalImage}
      />

      {/* Pull Image Modal */}
      <PullImageModal
        open={pullModalOpen}
        onClose={() => setPullModalOpen(false)}
        onSuccess={handlePullSuccess}
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

export default ImagesPage;
