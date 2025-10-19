import {
  Close,
  Storage,
  FolderOpen,
  CalendarToday,
  Settings,
  Info,
} from "@mui/icons-material";
import {
  Box,
  DialogTitle,
  Grid,
  IconButton,
  Modal,
  ModalDialog,
  Sheet,
  Table,
  Typography,
} from "@mui/joy";
import React from "react";

import { VolumeModalProps } from "../../types/docker";
import { formatDateTime, getVolumeDriverDisplay } from "../../utils/formatters";
import MetricCard from "../common/MetricCard";

const VolumeModal: React.FC<VolumeModalProps> = ({ open, onClose, volume }) => {
  if (!volume) return null;

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog layout="fullscreen">
        <DialogTitle>
          Volume Details: {volume.Name}
          <IconButton
            aria-label="close"
            onClick={onClose}
            sx={{ position: "absolute", right: 8, top: 8 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <Box
          sx={{
            p: 2,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            flexGrow: 1,
            overflow: "auto",
          }}
        >
          <Grid container spacing={2} sx={{ flexGrow: 1 }}>
            {/* Basic Information */}
            <Grid xs={12} md={6}>
              <Sheet
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: "sm",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <Typography level="title-md">Basic Information</Typography>
                <Grid container spacing={2} sx={{ flexGrow: 1 }}>
                  <Grid xs={12}>
                    <MetricCard
                      label="Volume Name"
                      icon={<FolderOpen />}
                      primaryValue={
                        <Typography
                          level="h4"
                          fontWeight="xl"
                          sx={{ wordBreak: "break-all" }}
                        >
                          {volume.Name}
                        </Typography>
                      }
                      color="primary"
                    />
                  </Grid>
                  <Grid xs={6}>
                    <MetricCard
                      label="Driver"
                      icon={<Storage />}
                      primaryValue={
                        <Typography level="h4" fontWeight="xl">
                          {getVolumeDriverDisplay(volume.Driver)}
                        </Typography>
                      }
                      color="neutral"
                    />
                  </Grid>
                  <Grid xs={6}>
                    <MetricCard
                      label="Scope"
                      icon={<Info />}
                      primaryValue={
                        <Typography level="h4" fontWeight="xl">
                          {volume.Scope || "local"}
                        </Typography>
                      }
                      color="neutral"
                    />
                  </Grid>
                  <Grid xs={12}>
                    <MetricCard
                      label="Created"
                      icon={<CalendarToday />}
                      primaryValue={
                        <Typography level="body-sm">
                          {formatDateTime(volume.CreatedAt)}
                        </Typography>
                      }
                      color="neutral"
                    />
                  </Grid>
                </Grid>
              </Sheet>
            </Grid>

            {/* Mount Point & Usage */}
            <Grid xs={12} md={6}>
              <Sheet
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: "sm",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <Typography level="title-md">Usage Information</Typography>
                <Box>
                  <Typography level="body-sm" fontWeight="md" sx={{ mb: 1 }}>
                    Mount Point
                  </Typography>
                  <Typography
                    level="body-sm"
                    color="neutral"
                    sx={{ fontFamily: "monospace", wordBreak: "break-all" }}
                  >
                    {volume.Mountpoint || "Not specified"}
                  </Typography>
                </Box>
                <Box>
                  <Typography level="body-xs" color="neutral">
                    This volume can be mounted by containers to persist data
                    beyond the container lifecycle.
                  </Typography>
                </Box>
              </Sheet>
            </Grid>

            {/* Options */}
            {volume.Options && Object.keys(volume.Options).length > 0 && (
              <Grid xs={12} md={6}>
                <Sheet variant="outlined" sx={{ p: 2, borderRadius: "sm" }}>
                  <Typography level="title-md" mb={2}>
                    <Settings sx={{ fontSize: "sm", mr: 0.5 }} />
                    Options
                  </Typography>
                  <Box
                    sx={{ display: "flex", flexDirection: "column", gap: 1 }}
                  >
                    {Object.entries(volume.Options).map(([key, value]) => (
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
                </Sheet>
              </Grid>
            )}

            {/* Labels */}
            {volume.Labels && Object.keys(volume.Labels).length > 0 && (
              <Grid
                xs={12}
                md={
                  volume.Options && Object.keys(volume.Options).length > 0
                    ? 6
                    : 12
                }
              >
                <Sheet variant="outlined" sx={{ p: 2, borderRadius: "sm" }}>
                  <Typography level="title-md" mb={2}>
                    Labels
                  </Typography>
                  <Table
                    size="sm"
                    sx={{
                      "--TableCell-paddingY": "0.5rem",
                      "--TableCell-paddingX": "0px",
                      "& tr > *:first-of-type": {
                        pl: 0,
                        minWidth: "180px", // Give the keys a minimum useful amount of space
                      },
                    }}
                  >
                    <thead>
                      <tr>
                        <th>Key</th>
                        <th>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(volume.Labels).map(([key, value]) => (
                        <tr key={key}>
                          <td>
                            <Typography
                              level="body-sm"
                              fontWeight="md"
                              textColor="text.primary"
                            >
                              {key}
                            </Typography>
                          </td>
                          <td>
                            <Typography
                              level="body-sm"
                              textColor="text.secondary"
                            >
                              {value || "(empty)"}
                            </Typography>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Sheet>
              </Grid>
            )}
          </Grid>
        </Box>
      </ModalDialog>
    </Modal>
  );
};

export default VolumeModal;
