import {
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
import { DockerNetwork } from "../../types/docker";
import { formatDateTime } from "../../utils/formatters";

interface NetworksTableProps {
  networks: DockerNetwork[];
  // onNetworkClick: (networkId: string) => void;
  // onNetworkRemove: (networkId: string) => void;
}

const NetworksTable: React.FC<NetworksTableProps> = ({
  networks,
  // onNetworkClick,
  // onNetworkRemove,
}) => {
  const [selected, setSelected] = React.useState<readonly string[]>([]);

  return (
    <Sheet variant="outlined" sx={{ width: "100%", boxShadow: "sm", borderRadius: "sm" }}>
      <Table aria-label="Networks table" stickyHeader>
        <thead>
          <tr>
            <th style={{ width: 40, padding: "12px 6px" }}>
              <Checkbox
                indeterminate={
                  selected.length > 0 && selected.length < networks.length
                }
                checked={selected.length === networks.length}
                onChange={(event) => {
                  setSelected(
                    event.target.checked ? networks.map((n) => n.id) : []
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
            <th>Driver</th>
            <th>Scope</th>
            <th>Subnet</th>
            <th>Created</th>
            <th style={{ width: 40 }}> </th>
          </tr>
        </thead>
        <tbody>
          {networks.map((network) => (
            <tr key={network.id}>
              <td style={{ padding: "12px 6px" }}>
                <Checkbox
                  checked={selected.includes(network.id)}
                  onChange={(event) => {
                    setSelected((ids) =>
                      event.target.checked
                        ? ids.concat(network.id)
                        : ids.filter((nId) => nId !== network.id)
                    );
                  }}
                />
              </td>
              <td>
                <Typography level="body-sm">{network.name}</Typography>
              </td>
              <td>
                <Typography level="body-sm">{network.id.substring(0, 12)}</Typography>
              </td>
              <td>
                <Chip size="sm" color="primary">{network.driver}</Chip>
              </td>
              <td>
                <Typography level="body-sm">{network.scope}</Typography>
              </td>
              <td>
                <Typography level="body-sm">
                  {network.ipam?.config?.[0]?.subnet ?? "N/A"}
                </Typography>
              </td>
              <td>
                <Typography level="body-sm">{formatDateTime(network.created)}</Typography>
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
                    <MenuItem>View Details</MenuItem>
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

export default NetworksTable;
