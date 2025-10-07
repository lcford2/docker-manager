import { Box } from "@mui/joy";
import CssBaseline from "@mui/joy/CssBaseline";
import { CssVarsProvider } from "@mui/joy/styles";
import React, { useMemo } from "react";
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

const App: React.FC = () => {
  const token = localStorage.getItem("token") || "";
  const wsConfig = useMemo(
    () => ({
      url: `ws://${window.location.host}/api/ws`,
      // url: "ws://172.24.0.3:6500/api/ws/connect",
      token,
      pingInterval: 30000,
      staleConnectionTimeout: 60000,
      maxReconnectionAttempts: 10,
    }),
    [token],
  );

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
