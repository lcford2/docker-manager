import { Box } from "@mui/joy";
import CssBaseline from "@mui/joy/CssBaseline";
import { CssVarsProvider } from "@mui/joy/styles";
import React, { useEffect, useMemo, useState } from "react";
import { Routes, Route } from "react-router-dom";

import AuthGuard from "./components/auth/AuthGuard";
import Login from "./components/auth/Login";
import Layout from "./components/common/Layout";
import AdminDashboard from "./components/admin/AdminDashboard";
import ContainersPage from "./components/containers/ContainersPage";
import Dashboard from "./components/dashboard/Dashboard";
import ImagesPage from "./components/images/ImagesPage";
import NetworksPage from "./components/networks/NetworksPage";
import VolumesPage from "./components/volumes/VolumesPage";
import { WebSocketProvider } from "./contexts/WebSocketContext";
import { configService, AppConfig } from "./services/configService";

const App: React.FC = () => {
  const token = localStorage.getItem("token") || "";
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);

  // Load configuration on mount
  useEffect(() => {
    configService
      .loadConfig()
      .then(setConfig)
      .catch((error) => {
        console.error("Failed to load configuration:", error);
        // Use defaults from configService
        setConfig(configService.getConfig());
      })
      .finally(() => setConfigLoading(false));
  }, []);

  const wsConfig = useMemo(() => {
    if (!config) return null;

    return {
      url: `ws://${window.location.host}/api/ws`,
      token,
      pingInterval: config.websocket.pingInterval,
      staleConnectionTimeout: config.websocket.staleTimeout,
      maxReconnectionAttempts: config.websocket.maxReconnectAttempts,
    };
  }, [token, config]);

  // Show loading state while config is being fetched
  if (configLoading || !config || !wsConfig) {
    return (
      <CssVarsProvider defaultMode="dark">
        <CssBaseline />
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "100vh",
          }}
        >
          Loading configuration...
        </Box>
      </CssVarsProvider>
    );
  }

  return (
    <CssVarsProvider defaultMode="dark">
      <CssBaseline />
      <WebSocketProvider config={wsConfig}>
        <Box sx={{ display: "flex", minHeight: "100vh", width: "100vw" }}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <AuthGuard>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </AuthGuard>
              }
            />
            <Route
              path="/dashboard"
              element={
                <AuthGuard>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </AuthGuard>
              }
            />
            <Route
              path="/containers"
              element={
                <AuthGuard>
                  <Layout>
                    <ContainersPage />
                  </Layout>
                </AuthGuard>
              }
            />
            <Route
              path="/volumes"
              element={
                <AuthGuard>
                  <Layout>
                    <VolumesPage />
                  </Layout>
                </AuthGuard>
              }
            />
            <Route
              path="/images"
              element={
                <AuthGuard>
                  <Layout>
                    <ImagesPage />
                  </Layout>
                </AuthGuard>
              }
            />
            <Route
              path="/networks"
              element={
                <AuthGuard>
                  <Layout>
                    <NetworksPage />
                  </Layout>
                </AuthGuard>
              }
            />
            <Route
              path="/admin"
              element={
                <AuthGuard requireAdmin>
                  <Layout>
                    <AdminDashboard />
                  </Layout>
                </AuthGuard>
              }
            />
          </Routes>
        </Box>
      </WebSocketProvider>
    </CssVarsProvider>
  );
};

export default App;
