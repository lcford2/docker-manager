import React from "react";
import { Chip, ChipProps } from "@mui/material";
import { getStatusColor } from "../../utils/formatters";

interface StatusChipProps extends Omit<ChipProps, "color"> {
  status: string;
  resourceType: "container" | "image" | "volume" | "network";
  icon?: React.ReactElement;
}

const StatusChip: React.FC<StatusChipProps> = ({
  status,
  resourceType,
  icon,
  ...chipProps
}) => {
  const color = getStatusColor(status, resourceType);

  return (
    <Chip
      label={status}
      color={color}
      icon={icon}
      size="small"
      variant="outlined"
      {...chipProps}
    />
  );
};

export default StatusChip;
