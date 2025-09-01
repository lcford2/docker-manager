import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  Button,
  TextField,
  InputAdornment,
} from "@mui/material";
import { Refresh, Add, Search } from "@mui/icons-material";
import { dockerAPI } from "../../services/api";
import { DockerNetwork } from "../../types/docker";

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
          Docker Networks
        </Typography>

        <Box sx={{ display: "flex", gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Add />}
            onClick={() => {
              /* TODO: Open create network modal */
            }}
          >
            Create Network
          </Button>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={fetchNetworks}
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
          placeholder="Search networks by name, driver, or scope..."
          value={searchTerm}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setSearchTerm(e.target.value)
          }
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

      {/* Networks List */}
      <Box>
        <Typography variant="h5" gutterBottom>
          Networks ({filteredNetworks.length} total)
        </Typography>

        {filteredNetworks.length === 0 ? (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 200,
              textAlign: "center",
            }}
          >
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No networks found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create some networks to see them here
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {filteredNetworks.map((network) => (
              <Box
                key={network.id}
                sx={{
                  p: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  backgroundColor: "background.paper",
                }}
              >
                <Typography variant="h6" gutterBottom>
                  {network.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  ID: {network.id.substring(0, 12)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Driver: {network.driver}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Scope: {network.scope}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Created: {new Date(network.created).toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Connected Containers:{" "}
                  {Object.keys(network.containers || {}).length}
                </Typography>
                {(network.ipam?.config?.length ?? 0) > 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Subnet:{" "}
                    {network.ipam?.config?.[0]?.subnet ?? "Not configured"}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default NetworksPage;
