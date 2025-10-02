import {
  Box,
  ButtonGroup,
  Button,
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
import { ArrowDownward, MoreHoriz } from "@mui/icons-material";
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
    <Sheet
      variant="outlined"
      sx={{ width: "100%", boxShadow: "sm", borderRadius: "sm" }}
    >
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
                    event.target.checked ? networks.map((n) => n.Id) : [],
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
            <th style={{ width: "15%" }}></th>
          </tr>
        </thead>
        <tbody>
          {networks.map((network) => {
            const handleSelectionChange = (isChecked: boolean) => {
              const newSelected = isChecked
                ? selected.concat(network.Id)
                : selected.filter((nId) => nId !== network.Id);
              setSelected(newSelected);
            };
            return (
              <tr
                key={network.Id}
                onClick={() =>
                  handleSelectionChange(!selected.includes(network.Name))
                }
              >
                <td style={{ padding: "12px 6px" }}>
                  <Checkbox
                    checked={selected.includes(network.Id)}
                    onChange={(event) => {
                      handleSelectionChange(event.target.checked);
                    }}
                  />
                </td>
                <td>
                  <Typography noWrap level="body-sm">
                    {network.Name}
                  </Typography>
                </td>
                <td>
                  <Typography noWrap level="body-sm">
                    {network.Id.substring(0, 12)}
                  </Typography>
                </td>
                <td>
                  <Chip size="sm" color="primary">
                    {network.Driver}
                  </Chip>
                </td>
                <td>
                  <Typography level="body-sm">{network.Scope}</Typography>
                </td>
                <td>
                  <Typography level="body-sm">
                    {network.IPAM?.Config?.[0]?.Subnet ?? "N/A"}
                  </Typography>
                </td>
                <td>
                  <Typography level="body-sm">
                    {formatDateTime(network.Created)}
                  </Typography>
                </td>
                <td onClick={(event) => event.stopPropagation()}>
                  <ButtonGroup
                    aria-label="Network actions"
                    variant="soft"
                    size="sm"
                    sx={{ display: { xs: "none", xl: "flex" } }}
                  >
                    <Button color="neutral" size="sm">
                      Details
                    </Button>
                    <Button color="danger" size="sm">
                      Remove
                    </Button>
                  </ButtonGroup>
                  <Box sx={{ display: { xs: "block", xl: "none" } }}>
                    <Dropdown>
                      <MenuButton
                        slots={{ root: IconButton }}
                        slotProps={{
                          root: {
                            variant: "plain",
                            color: "neutral",
                            size: "sm",
                          },
                        }}
                      >
                        <MoreHoriz />
                      </MenuButton>
                      <Menu>
                        <MenuItem>Details</MenuItem>
                        <MenuItem color="danger">Remove</MenuItem>
                      </Menu>
                    </Dropdown>
                  </Box>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Sheet>
  );
};

export default NetworksTable;
