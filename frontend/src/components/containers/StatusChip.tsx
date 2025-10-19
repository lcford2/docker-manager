import { Chip } from "@mui/joy";

interface StatusChipProps {
  status: string;
}

const StatusChip: React.FC<StatusChipProps> = ({ status }) => {
  let color: "success" | "warning" | "danger" | "neutral" = "neutral";
  if (status.startsWith("running")) {
    color = "success";
  } else if (status.startsWith("exited")) {
    color = "danger";
  } else if (status.startsWith("created")) {
    color = "warning";
  }
  return (
    <Chip color={color} size="sm">
      {status}
    </Chip>
  );
};

export default StatusChip;
