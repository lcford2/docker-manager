import {
  Box,
  Checkbox,
  Chip,
  Dropdown,
  IconButton,
  Link,
  Menu,
  MenuButton,
  MenuItem,
  Sheet,
  Table,
  Typography,
} from "@mui/joy";
import {
  ArrowDownward,
  MoreHoriz,
} from "@mui/icons-material";
import React from "react";
import { ContainerStatsWithHistory } from "../../types/metrics";

interface ContainersTableProps {
  containers: ContainerStatsWithHistory[];
  onContainerClick: (containerId: string) => void;
}

const ContainersTable: React.FC<ContainersTableProps> = ({
  containers,
  onContainerClick,
}) => {
  const [selected, setSelected] = React.useState<readonly string[]>([]);

  const renderStatusChip = (status: string) => {
    let color: "success" | "warning" | "danger" | "neutral" = "neutral";
    if (status.startsWith("running")) {
      color = "success";
    } else if (status.startsWith("exited")) {
      color = "danger";
    } else if (status.startsWith("created")) {
      color = "warning";
    }
    return <Chip color={color} size="sm">{status}</Chip>;
  };

  return (
    <Sheet variant="outlined" sx={{ width: "100%", boxShadow: "sm", borderRadius: "sm" }}>
      <Table aria-label="Containers table" stickyHeader>
        <thead>
          <tr>
            <th style={{ width: 40, padding: "12px 6px" }}>
              <Checkbox
                indeterminate={
                  selected.length > 0 && selected.length < containers.length
                }
                checked={selected.length === containers.length}
                onChange={(event) => {
                  setSelected(
                    event.target.checked ? containers.map((c) => c.id) : []
                  );
                }}
              />
            </th>
            <th>
              <Link
                underline="none"
                color="primary"
                component="button"
                endDecorator={<ArrowDownward />}
                sx={{ fontWeight: "lg" }}
              >
                Name
              </Link>
            </th>
            <th>ID</th>
            <th>Image</th>
            <th>Status</th>
            <th>CPU %</th>
            <th>Memory %</th>
            <th style={{ width: 40 }}> </th>
          </tr>
        </thead>
        <tbody>
          {containers.map((container) => (
            <tr key={container.id}>
              <td style={{ padding: "12px 6px" }}>
                <Checkbox
                  checked={selected.includes(container.id)}
                  onChange={(event) => {
                    setSelected((ids) =>
                      event.target.checked
                        ? ids.concat(container.id)
                        : ids.filter((cId) => cId !== container.id)
                    );
                  }}
                />
              </td>
              <td>
                <Typography level="body-sm">{container.name}</Typography>
              </td>
              <td>
                <Typography level="body-sm">{container.id.substring(0, 12)}</Typography>
              </td>
              <td>
                <Typography level="body-sm">{container.image || 'N/A'}</Typography>
              </td>
              <td>{renderStatusChip(container.status)}</td>
              <td>
                <Typography level="body-sm">{(container.cpu_percent ?? 0).toFixed(2)}</Typography>
              </td>
              <td>
                <Typography level="body-sm">{(container.memory_percent ?? 0).toFixed(2)}</Typography>
              </td>
              <td>
                <Dropdown>
                  <MenuButton
                    slots={{ root: IconButton }}
                    slotProps={{ root: { variant: "plain", color: "neutral", size: "sm" } }}
                  >
                    <MoreHoriz />
                  </MenuButton>
                  <Menu size="sm" sx={{ minWidth: 140 }}>
                    <MenuItem onClick={() => onContainerClick(container.id)}>
                      View Details
                    </MenuItem>
                    <MenuItem>Stop</MenuItem>
                    <MenuItem color="danger">Remove</MenuItem>
                  </Menu>
                </Dropdown>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Sheet>
  );
};

export default ContainersTable;
