import {
  Close,
  Hub,
  Storage,
  CalendarToday,
  Settings,
  Info,
  Cable,
  Router,
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

import { NetworkModalProps } from "../../types/docker";
import { formatDateTime } from "../../utils/formatters";
import MetricCard from "../common/MetricCard";

const NetworkModal: React.FC<NetworkModalProps> = ({
  open,
  onClose,
  network,
}) => {
  if (!network) return null;

  const hasContainers =
    network.Containers && Object.keys(network.Containers).length > 0;
  const containerCount = hasContainers
    ? Object.keys(network.Containers).length
    : 0;

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog layout="fullscreen">
        <DialogTitle>
          Network Details: {network.Name}
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
                      label="Network Name"
                      icon={<Hub />}
                      primaryValue={
                        <Typography
                          level="h4"
                          fontWeight="xl"
                          sx={{ wordBreak: "break-all" }}
                        >
                          {network.Name}
                        </Typography>
                      }
                      color="primary"
                    />
                  </Grid>
                  <Grid xs={12}>
                    <MetricCard
                      label="Network ID"
                      icon={<Cable />}
                      primaryValue={
                        <Typography
                          level="body-sm"
                          sx={{ wordBreak: "break-all" }}
                        >
                          {network.Id.substring(0, 12)}
                        </Typography>
                      }
                      secondaryValue={network.Id}
                      color="neutral"
                    />
                  </Grid>
                  <Grid xs={6}>
                    <MetricCard
                      label="Driver"
                      icon={<Storage />}
                      primaryValue={
                        <Typography level="h4" fontWeight="xl">
                          {network.Driver}
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
                          {network.Scope}
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
                          {formatDateTime(network.Created)}
                        </Typography>
                      }
                      color="neutral"
                    />
                  </Grid>
                </Grid>
              </Sheet>
            </Grid>

            {/* IPAM Configuration */}
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
                <Typography level="title-md">
                  <Router sx={{ fontSize: "sm", mr: 0.5 }} />
                  IPAM Configuration
                </Typography>
                <Box>
                  <Typography level="body-sm" fontWeight="md" sx={{ mb: 1 }}>
                    IPAM Driver
                  </Typography>
                  <Typography level="body-sm" color="neutral">
                    {network.IPAM?.Driver || "default"}
                  </Typography>
                </Box>
                {network.IPAM?.Config && network.IPAM.Config.length > 0 && (
                  <Box>
                    <Typography level="body-sm" fontWeight="md" sx={{ mb: 1 }}>
                      Network Configuration
                    </Typography>
                    {network.IPAM.Config.map((config, index) => (
                      <Box
                        key={index}
                        sx={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 0.5,
                          mb: 1,
                        }}
                      >
                        {config.Subnet && (
                          <Typography
                            level="body-sm"
                            color="neutral"
                            sx={{ fontFamily: "monospace" }}
                          >
                            Subnet: {config.Subnet}
                          </Typography>
                        )}
                        {config.Gateway && (
                          <Typography
                            level="body-sm"
                            color="neutral"
                            sx={{ fontFamily: "monospace" }}
                          >
                            Gateway: {config.Gateway}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Box>
                )}
                {(!network.IPAM?.Config ||
                  network.IPAM.Config.length === 0) && (
                  <Box>
                    <Typography level="body-xs" color="neutral">
                      No IPAM configuration available
                    </Typography>
                  </Box>
                )}
              </Sheet>
            </Grid>

            {/* Connected Containers */}
            {hasContainers && (
              <Grid xs={12}>
                <Sheet variant="outlined" sx={{ p: 2, borderRadius: "sm" }}>
                  <Typography level="title-md" mb={2}>
                    Connected Containers ({containerCount})
                  </Typography>
                  <Box
                    sx={{ display: "flex", flexDirection: "column", gap: 1 }}
                  >
                    {Object.entries(network.Containers).map(
                      ([containerId, containerInfo]) => (
                        <Box
                          key={containerId}
                          sx={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 0.5,
                            p: 1.5,
                            borderRadius: "sm",
                            bgcolor: "background.level1",
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                            }}
                          >
                            <Typography level="body-sm" fontWeight="md">
                              {containerInfo.Name}
                            </Typography>
                            <Chip size="sm" variant="soft" color="primary">
                              {containerId.substring(0, 12)}
                            </Chip>
                          </Box>
                          {containerInfo.IPv4_address && (
                            <Typography
                              level="body-xs"
                              color="neutral"
                              sx={{ fontFamily: "monospace" }}
                            >
                              IPv4: {containerInfo.IPv4_address}
                            </Typography>
                          )}
                          {containerInfo.IPv6_address && (
                            <Typography
                              level="body-xs"
                              color="neutral"
                              sx={{ fontFamily: "monospace" }}
                            >
                              IPv6: {containerInfo.IPv6_address}
                            </Typography>
                          )}
                        </Box>
                      ),
                    )}
                  </Box>
                </Sheet>
              </Grid>
            )}

            {/* Options */}
            {network.Options && Object.keys(network.Options).length > 0 && (
              <Grid xs={12} md={hasContainers ? 6 : 12}>
                <Sheet variant="outlined" sx={{ p: 2, borderRadius: "sm" }}>
                  <Typography level="title-md" mb={2}>
                    <Settings sx={{ fontSize: "sm", mr: 0.5 }} />
                    Options
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
                      {Object.entries(network.Options).map(([key, value]) => (
                        <tr key={key}>
                          <td>
                            <Typography
                              level="body-sm"
                              fontWeight="md"
                              textColor="text.primary"
                              sx={{
                                // This is the primary fix for long, unwrapped text:
                                wordBreak: "break-word",
                                hyphens: "auto", // Optional: helps with wrapping long compound words
                              }}
                            >
                              {key}
                            </Typography>
                          </td>
                          <td>
                            <Typography
                              level="body-sm"
                              textColor="text.secondary"
                              sx={{ wordBreak: "break-word" }}
                            >
                              {value}
                            </Typography>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Sheet>
              </Grid>
            )}

            {/* Labels */}
            {network.Labels && Object.keys(network.Labels).length > 0 && (
              <Grid
                xs={12}
                md={
                  network.Options && Object.keys(network.Options).length > 0
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
                      {Object.entries(network.Labels).map(([key, value]) => (
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

export default NetworkModal;
