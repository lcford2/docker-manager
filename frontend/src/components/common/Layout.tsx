import {
  Dashboard,
  ViewInAr,
  Storage,
  Image,
  NetworkCheck,
  Logout,
  Menu as MenuIcon,
} from "@mui/icons-material";
import {
  Box,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemDecorator,
  Sheet,
  Typography,
} from "@mui/joy";
import React from "react";
import { useNavigate, useLocation } from "react-router-dom";

const drawerWidth = 240;

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const menuItems = [
    { text: "Dashboard", icon: <Dashboard />, path: "/dashboard" },
    { text: "Containers", icon: <ViewInAr />, path: "/containers" },
    { text: "Volumes", icon: <Storage />, path: "/volumes" },
    { text: "Images", icon: <Image />, path: "/images" },
    { text: "Networks", icon: <NetworkCheck />, path: "/networks" },
  ];

  const drawer = (
    <Sheet
      variant="outlined"
      sx={{
        height: "100dvh",
        p: 2,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <Typography level="title-lg">Docker Manager</Typography>
      <Box sx={{ fle: "0 0 auto" }}>
        <List>
          {menuItems.map((item) => (
            <ListItem key={item.text}>
              <ListItemButton
                selected={location.pathname === item.path}
                onClick={() => navigate(item.path)}
              >
                <ListItemDecorator>{item.icon}</ListItemDecorator>
                {item.text}
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>
      <Box sx={{ flex: "1 1 auto" }} />
      <Box sx={{ flex: "0 0 auto", mt: "auto" }}>
        <List>
          <ListItem>
            <ListItemButton onClick={handleLogout}>
              <ListItemDecorator>
                <Logout />
              </ListItemDecorator>
              Logout
            </ListItemButton>
          </ListItem>
        </List>
      </Box>
    </Sheet>
  );

  return (
    <Box sx={{ display: "flex", width: "100%" }}>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        {/* Mobile drawer */}
        <Sheet
          sx={{
            display: { xs: "block", sm: "none" },
            position: "fixed",
            zIndex: 1200,
            width: mobileOpen ? drawerWidth : 0,
            height: "100dvh",
            transition: "width 0.2s",
            overflow: "hidden",
          }}
        >
          {drawer}
        </Sheet>
        {/* Desktop drawer */}
        <Sheet
          sx={{
            display: { xs: "none", sm: "block" },
            width: drawerWidth,
            height: "100dvh",
          }}
        >
          {drawer}
        </Sheet>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          height: "100vh",
          overflow: "auto",
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Sheet
          variant="outlined"
          sx={{
            p: 2,
            mb: 3,
            display: { sm: "none" },
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography level="title-lg">Docker Manager</Typography>
          <IconButton onClick={handleDrawerToggle}>
            <MenuIcon />
          </IconButton>
        </Sheet>
        {children}
      </Box>
    </Box>
  );
};

export default Layout;
