import {
  Close,
  Image as ImageIcon,
  Storage,
  CalendarToday,
  LocalOffer,
  Warning,
  Fingerprint,
} from "@mui/icons-material";
import {
  Box,
  Chip,
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

import { ImageModalProps } from "../../types/docker";
import {
  formatBytes,
  formatTimestamp,
  formatImageTag,
  isDanglingImage,
  splitRepoTag,
  stripSHA,
} from "../../utils/formatters";
import MetricCard from "../common/MetricCard";

// A utility function to simplify the verbose Docker label keys
const simplifyLabelKey = (key: string): string => {
  if (key.startsWith("com.docker.compose.")) {
    return key.replace("com.docker.compose.", "");
  }
  return key;
};

const ImageModal: React.FC<ImageModalProps> = ({ open, onClose, image }) => {
  if (!image) return null;

  const isDangling = isDanglingImage(image.RepoTags);
  const [repository, tag] = splitRepoTag(image.RepoTags[0]);
  const displayName = formatImageTag(repository, tag);

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog layout="fullscreen">
        <DialogTitle>
          Image Details: {displayName}
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
                      label="Image ID"
                      icon={<Fingerprint />}
                      primaryValue={
                        <Typography
                          level="body-sm"
                          sx={{ wordBreak: "break-all" }}
                        >
                          {stripSHA(image.Id)}
                        </Typography>
                      }
                      color="neutral"
                    />
                  </Grid>
                  <Grid xs={12}>
                    <MetricCard
                      label="Repository"
                      icon={<ImageIcon />}
                      primaryValue={
                        <Typography level="h4" fontWeight="xl">
                          {repository}
                        </Typography>
                      }
                      secondaryValue={`Tag: ${tag}`}
                      color="primary"
                    />
                  </Grid>
                  <Grid xs={6}>
                    <MetricCard
                      label="Size"
                      icon={<Storage />}
                      primaryValue={
                        <Typography level="h4" fontWeight="xl">
                          {formatBytes(image.Size)}
                        </Typography>
                      }
                      color="neutral"
                    />
                  </Grid>
                  <Grid xs={6}>
                    <MetricCard
                      label="Created"
                      icon={<CalendarToday />}
                      primaryValue={
                        <Typography level="body-sm">
                          {formatTimestamp(image.Created)}
                        </Typography>
                      }
                      color="neutral"
                    />
                  </Grid>
                  {isDangling && (
                    <Grid xs={12}>
                      <MetricCard
                        label="Status"
                        icon={<Warning />}
                        primaryValue={
                          <Typography
                            level="h4"
                            color="warning"
                            fontWeight="xl"
                          >
                            Dangling Image
                          </Typography>
                        }
                        secondaryValue="Not tagged or referenced by any repository"
                        color="warning"
                      />
                    </Grid>
                  )}
                </Grid>
              </Sheet>
            </Grid>

            {/* Repository Tags & Digests */}
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
                <Typography level="title-md">Repository Information</Typography>
                {image.RepoTags && image.RepoTags.length > 0 && (
                  <Box>
                    <Typography level="body-sm" fontWeight="md" sx={{ mb: 1 }}>
                      <LocalOffer sx={{ fontSize: "sm", mr: 0.5 }} />
                      Tags
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
                {image.RepoDigests && image.RepoDigests.length > 0 && (
                  <Box>
                    <Typography level="body-sm" fontWeight="md" sx={{ mb: 1 }}>
                      Digests
                    </Typography>
                    <Box
                      sx={{ display: "flex", flexDirection: "column", gap: 1 }}
                    >
                      {image.RepoDigests.map((digest, index) => (
                        <Typography
                          key={index}
                          level="body-xs"
                          color="neutral"
                          sx={{
                            fontFamily: "monospace",
                            wordBreak: "break-all",
                          }}
                        >
                          {digest}
                        </Typography>
                      ))}
                    </Box>
                  </Box>
                )}
                {image.ParentId && (
                  <Box>
                    <Typography level="body-sm" fontWeight="md" sx={{ mb: 1 }}>
                      Parent Image
                    </Typography>
                    <Typography
                      level="body-xs"
                      color="neutral"
                      sx={{ fontFamily: "monospace", wordBreak: "break-all" }}
                    >
                      {image.ParentId}
                    </Typography>
                  </Box>
                )}
              </Sheet>
            </Grid>

            {/* Labels */}
            {image.Labels && Object.keys(image.Labels).length > 0 && (
              <Grid xs={12}>
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
                      {Object.entries(image.Labels).map(([key, value]) => (
                        <tr key={key}>
                          <td>
                            <Typography
                              level="body-sm"
                              fontWeight="md"
                              textColor="text.primary"
                              // Use the simplified key for display
                              title={key} // Keep the original key in a tooltip
                            >
                              {simplifyLabelKey(key)}
                            </Typography>
                          </td>
                          <td>
                            <Typography
                              level="body-sm"
                              textColor="text.secondary"
                            >
                              {value}
                            </Typography>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                  {/*<Box
                    sx={{ display: "flex", flexDirection: "column", gap: 1 }}
                  >
                    {Object.entries(image.Labels).map(([key, value]) => (
                      <Box key={key} sx={{ display: "flex", gap: 2 }}>
                        <Typography
                          level="body-sm"
                          fontWeight="xl"
                          color="primary"
                          sx={{ minWidth: "120px" }}
                        >
                          {key}:
                        </Typography>
                        <Typography level="body-sm" color="neutral">
                          {value}
                        </Typography>
                      </Box>
                    ))}
                  </Box>*/}
                </Sheet>
              </Grid>
            )}
          </Grid>
        </Box>
      </ModalDialog>
    </Modal>
  );
};

export default ImageModal;
