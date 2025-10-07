import {
  Box,
  Button,
  Chip,
  IconButton,
  Sheet,
  Table,
  Typography,
} from "@mui/joy";
import React, { useEffect, useState } from "react";
import { usersAPI } from "../../services/api";
import UserFormModal from "./UserFormModal";

interface User {
  id: number;
  username: string;
  email: string;
  permission: string;
  is_active: boolean;
}

const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await usersAPI.listUsers();
      setUsers(data);
      setError("");
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = () => {
    setEditingUser(null);
    setModalOpen(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setModalOpen(true);
  };

  const handleDeleteUser = async (userId: number) => {
    if (!window.confirm("Are you sure you want to delete this user?")) {
      return;
    }

    try {
      await usersAPI.deleteUser(userId);
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to delete user");
    }
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditingUser(null);
    fetchUsers();
  };

  const getPermissionColor = (permission: string) => {
    switch (permission) {
      case "admin":
        return "danger";
      case "readwrite":
        return "warning";
      case "readonly":
        return "neutral";
      default:
        return "neutral";
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Typography level="h2">User Management</Typography>
        <Button onClick={handleCreateUser} color="primary">
          Create User
        </Button>
      </Box>

      {error && (
        <Sheet variant="soft" color="danger" sx={{ p: 2, mb: 2 }}>
          {error}
        </Sheet>
      )}

      <Sheet variant="outlined" sx={{ borderRadius: "sm", overflow: "auto" }}>
        <Table>
          <thead>
            <tr>
              <th style={{ width: "10%" }}>ID</th>
              <th style={{ width: "25%" }}>Username</th>
              <th style={{ width: "30%" }}>Email</th>
              <th style={{ width: "15%" }}>Permission</th>
              <th style={{ width: "10%" }}>Status</th>
              <th style={{ width: "10%", textAlign: "center" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center" }}>
                  Loading...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center" }}>
                  No users found
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.username}</td>
                  <td>{user.email}</td>
                  <td>
                    <Chip
                      size="sm"
                      color={getPermissionColor(user.permission)}
                      variant="soft"
                    >
                      {user.permission}
                    </Chip>
                  </td>
                  <td>
                    <Chip
                      size="sm"
                      color={user.is_active ? "success" : "neutral"}
                      variant="soft"
                    >
                      {user.is_active ? "Active" : "Inactive"}
                    </Chip>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <Button
                      size="sm"
                      variant="plain"
                      onClick={() => handleEditUser(user)}
                      sx={{ mr: 1 }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="plain"
                      color="danger"
                      onClick={() => handleDeleteUser(user.id)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Sheet>

      <UserFormModal
        open={modalOpen}
        onClose={handleModalClose}
        user={editingUser}
      />
    </Box>
  );
};

export default AdminDashboard;
