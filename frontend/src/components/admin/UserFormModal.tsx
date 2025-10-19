import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  Modal,
  ModalClose,
  ModalDialog,
  Option,
  Select,
  Switch,
  Typography,
} from "@mui/joy";
import React, { useEffect, useState } from "react";
import { usersAPI } from "../../services/api";

interface User {
  id: number;
  username: string;
  email: string;
  permission: string;
  is_active: boolean;
}

interface UserFormModalProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
}

const UserFormModal: React.FC<UserFormModalProps> = ({
  open,
  onClose,
  user,
}) => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [permission, setPermission] = useState("readonly");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setEmail(user.email);
      setPassword("");
      setPermission(user.permission);
      setIsActive(user.is_active);
    } else {
      setUsername("");
      setEmail("");
      setPassword("");
      setPermission("readonly");
      setIsActive(true);
    }
    setError("");
  }, [user, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (user) {
        // Update existing user
        const updateData: any = {
          permission,
          is_active: isActive,
        };

        if (username !== user.username) {
          updateData.username = username;
        }
        if (email !== user.email) {
          updateData.email = email;
        }
        if (password) {
          updateData.password = password;
        }

        await usersAPI.updateUser(user.id, updateData);
      } else {
        // Create new user
        if (!password) {
          setError("Password is required for new users");
          setLoading(false);
          return;
        }

        await usersAPI.createUser({
          username,
          email,
          password,
          permission,
        });
      }
      onClose();
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to save user"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog sx={{ minWidth: 500 }}>
        <ModalClose />
        <Typography level="h4" component="h2">
          {user ? "Edit User" : "Create User"}
        </Typography>

        {error && (
          <Box sx={{ p: 2, bgcolor: "danger.softBg", borderRadius: "sm" }}>
            <Typography color="danger">{error}</Typography>
          </Box>
        )}

        <form onSubmit={handleSubmit}>
          <FormControl required sx={{ mb: 2 }}>
            <FormLabel>Username</FormLabel>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
            />
          </FormControl>

          <FormControl required sx={{ mb: 2 }}>
            <FormLabel>Email</FormLabel>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </FormControl>

          <FormControl required={!user} sx={{ mb: 2 }}>
            <FormLabel>
              Password {user && "(leave blank to keep current)"}
            </FormLabel>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={user ? "Enter new password" : "Enter password"}
            />
          </FormControl>

          <FormControl required sx={{ mb: 2 }}>
            <FormLabel>Permission Level</FormLabel>
            <Select
              value={permission}
              onChange={(_, value) => setPermission(value as string)}
            >
              <Option value="readonly">Read Only</Option>
              <Option value="readwrite">Read/Write</Option>
              <Option value="admin">Admin</Option>
            </Select>
          </FormControl>

          {user && (
            <FormControl sx={{ mb: 2 }}>
              <FormLabel>Account Status</FormLabel>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Switch
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <Typography level="body-sm">
                  {isActive ? "Active" : "Inactive"}
                </Typography>
              </Box>
            </FormControl>
          )}

          <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
            <Button variant="plain" color="neutral" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              {user ? "Update" : "Create"}
            </Button>
          </Box>
        </form>
      </ModalDialog>
    </Modal>
  );
};

export default UserFormModal;
