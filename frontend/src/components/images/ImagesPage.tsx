import { Refresh, Add, Search, Report, Delete } from "@mui/icons-material";
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  Button,
  Input,
  IconButton,
} from "@mui/joy";
import React, { useState, useEffect, useCallback } from "react";

import { dockerAPI } from "../../services/api";
import { DockerImage } from "../../types/docker";
import ConfirmDialog from "../common/ConfirmDialog";

import ImagesTable from "./ImagesTable";
import ImageModal from "./ImageModal";
import PullImageModal from "./PullImageModal";

const ImagesPage: React.FC = () => {
  const [images, setImages] = useState<DockerImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedImages, setSelectedImages] = useState<readonly string[]>([]);

  // Modal states
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
      const image = images.find((img) => img.id === imageId);
      if (image) {
        setModalImage(image);
      }
    },
    [images],
  );

  // Handle close modal
  const handleCloseModal = useCallback(() => {
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

  const confirmBulkRemoveImages = useCallback(async () => {
    setActionLoading("remove-bulk");
    setConfirmDialog((prev) => ({ ...prev, open: false }));

    try {
      await dockerAPI.bulkRemoveImages(selectedImages as string[]);
      await fetchImages(); // Refresh the list
      setSelectedImages([]); // Clear selection
    } catch (err: any) {
      setError(err.message || "Failed to remove images");
    } finally {
      setActionLoading(null);
    }
  }, [fetchImages, selectedImages]);

  const handleBulkImageRemove = useCallback(() => {
    setConfirmDialog({
      open: true,
      title: "Remove Images",
      message: `Are you sure you want to remove the ${selectedImages.length} selected images? This action cannot be undone.`,
      onConfirm: () => confirmBulkRemoveImages(),
    });
  }, [selectedImages, confirmBulkRemoveImages]);

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
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Typography level="h2" component="h1">
          Docker Images
        </Typography>

        <Box sx={{ display: "flex", gap: 2 }}>
          {selectedImages.length > 0 && (
            <Button
              variant="solid"
              color="danger"
              startDecorator={<Delete />}
              onClick={handleBulkImageRemove}
              disabled={actionLoading !== null}
            >
              Delete ({selectedImages.length})
            </Button>
          )}
          <Button
            variant="outlined"
            startDecorator={<Add />}
            onClick={() => setPullModalOpen(true)}
          >
            Pull Image
          </Button>
          <Button
            variant="outlined"
            startDecorator={<Refresh />}
            onClick={fetchImages}
            disabled={loading || actionLoading !== null}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Search */}
      <Box sx={{ mb: 3 }}>
        <Input
          fullWidth
          placeholder="Search images by repository, tag, or ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          startDecorator={<Search />}
        />
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert
          color="danger"
          sx={{ mb: 2 }}
          startDecorator={<Report />}
          endDecorator={
            <IconButton
              variant="plain"
              size="sm"
              color="danger"
              onClick={() => setError(null)}
            >
              X
            </IconButton>
          }
        >
          {error}
        </Alert>
      )}

      {/* Images Table */}
      <Box sx={{ flexGrow: 1, overflowY: "auto" }}>
        <ImagesTable
          images={filteredImages}
          selected={selectedImages}
          onSelectionChange={setSelectedImages}
          onImageClick={handleImageClick}
          onImageRemove={handleImageRemove}
        />
      </Box>

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
        loading={actionLoading === "remove" || actionLoading === "remove-bulk"}
      />
    </Box>
  );
};

export default ImagesPage;
