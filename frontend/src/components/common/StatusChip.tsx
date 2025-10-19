import { Chip, ChipProps } from "@mui/joy";
import React from "react";

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
      color={color}
      startDecorator={icon}
      size="sm"
      variant="outlined"
      {...chipProps}
    >
      {status}
    </Chip>
  );
};

export default StatusChip;
