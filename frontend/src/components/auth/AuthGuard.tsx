import React from "react";
import { Navigate } from "react-router-dom";

interface AuthGuardProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  requireAdmin = false,
}) => {
  const token = localStorage.getItem("token");
  const permission = localStorage.getItem("permission");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && permission !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default AuthGuard;
