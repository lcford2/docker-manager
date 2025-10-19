// src/components/metrics/MetricCard.tsx (or similar path)

import { Box, Typography, Sheet } from "@mui/joy";
import React from "react";

interface MetricCardProps {
  label: string;
  icon?: React.ReactNode;
  primaryValue: React.ReactNode;
  secondaryValue?: React.ReactNode;
  color?: "primary" | "success" | "warning" | "danger" | "neutral";
}

const MetricCard: React.FC<MetricCardProps> = ({
  label,
  icon,
  primaryValue,
  secondaryValue,
  color = "neutral",
}) => {
  return (
    <Sheet
      variant="soft"
      color={color}
      sx={{
        p: 2,
        borderRadius: "sm",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
        {icon && <Box sx={{ mr: 1, fontSize: "lg" }}>{icon}</Box>}
        <Typography level="body-sm" fontWeight="md">
          {label}
        </Typography>
      </Box>
      <Typography
        level="h3"
        component="div"
        sx={{ mb: secondaryValue ? 0.5 : 0 }}
      >
        {primaryValue}
      </Typography>
      {secondaryValue && (
        <Typography level={"body-xs"} textColor="text.secondary">
          {secondaryValue}
        </Typography>
      )}
    </Sheet>
  );
};

export default MetricCard;
