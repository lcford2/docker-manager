import { Refresh, Add, Search, Report } from "@mui/icons-material";
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
import { DockerNetwork } from "../../types/docker";
import NetworksTable from "./NetworksTable";

const NetworksPage: React.FC = () => {
  const [networks, setNetworks] = useState<DockerNetwork[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch networks
  const fetchNetworks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await dockerAPI.getNetworks();
      setNetworks(response);
    } catch (err: any) {
      setError(err.message || "Failed to fetch networks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNetworks();
  }, [fetchNetworks]);

  // Filter networks based on search term
  const filteredNetworks = networks.filter(
    (network) =>
      network.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      network.driver.toLowerCase().includes(searchTerm.toLowerCase()) ||
      network.scope.toLowerCase().includes(searchTerm.toLowerCase()),
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
          Docker Networks
        </Typography>

        <Box sx={{ display: "flex", gap: 2 }}>
          <Button
            variant="outlined"
            startDecorator={<Add />}
            onClick={() => {
              /* TODO: Open create network modal */
            }}
          >
            Create Network
          </Button>
          <Button
            variant="outlined"
            startDecorator={<Refresh />}
            onClick={fetchNetworks}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Search */}
      <Box sx={{ mb: 3 }}>
        <Input
          fullWidth
          placeholder="Search networks by name, driver, or scope..."
          value={searchTerm}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setSearchTerm(e.target.value)
          }
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

      {/* Networks Table */}
      <Box sx={{ flexGrow: 1, overflowY: "auto" }}>
        <NetworksTable networks={filteredNetworks} />
      </Box>
    </Box>
  );
};

export default NetworksPage;
