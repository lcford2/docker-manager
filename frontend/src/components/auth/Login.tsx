import {
  Alert,
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  Sheet,
  Typography,
} from "@mui/joy";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import { authAPI } from "../../services/api";

const Login: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await authAPI.login(username, password);
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", data.user);
      localStorage.setItem("userId", data.user_id);
      localStorage.setItem("permission", data.permission);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 2,
      }}
    >
      <Sheet
        variant="outlined"
        sx={{
          p: 4,
          width: "100%",
          maxWidth: 400,
          borderRadius: "sm",
        }}
      >
        <Typography
          level="h4"
          component="h1"
          sx={{ textAlign: "center", mb: 1 }}
        >
          Docker Manager
        </Typography>
        <Typography
          level="h4"
          component="h2"
          sx={{ textAlign: "center", mb: 2 }}
        >
          Sign In
        </Typography>
        {error && (
          <Alert color="danger" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
          <FormControl required>
            <FormLabel>Username</FormLabel>
            <Input
              name="username"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setUsername(e.target.value)
              }
            />
          </FormControl>
          <FormControl required sx={{ mt: 2 }}>
            <FormLabel>Password</FormLabel>
            <Input
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setPassword(e.target.value)
              }
            />
          </FormControl>
          <Button
            type="submit"
            fullWidth
            sx={{ mt: 3, mb: 2 }}
            loading={loading}
          >
            Sign In
          </Button>
        </Box>
        <Typography
          level="body-sm"
          color="neutral"
          sx={{ textAlign: "center" }}
        >
          Default credentials: admin / admin123
        </Typography>
      </Sheet>
    </Box>
  );
};

export default Login;
