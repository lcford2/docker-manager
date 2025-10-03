import {
  ButtonGroup,
  Button,
  Box,
  Checkbox,
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
import { ContainerStatsWithHistory } from "../../types/metrics";
import StatusChip from "./StatusChip";

interface ContainersTableProps {
  containers: ContainerStatsWithHistory[];
  selected: readonly string[];
  onSelectionChange: (selected: readonly string[]) => void;
  onContainerClick: (containerId: string) => void;
  onContainerStop: (containerId: string) => void;
  onContainerRestart: (containerId: string) => void;
  onContainerRemove: (containerId: string) => void;
}

const ContainersTable: React.FC<ContainersTableProps> = ({
  containers,
  selected,
  onSelectionChange,
  onContainerClick,
  onContainerStop,
  onContainerRestart,
  onContainerRemove,
}) => {
  return (
    <Sheet
      variant="outlined"
      sx={{ width: "100%", boxShadow: "sm", borderRadius: "sm" }}
    >
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
                  onSelectionChange(
                    event.target.checked ? containers.map((c) => c.id) : [],
                  );
                }}
              />
            </th>
            <th style={{ width: "15%" }}>
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
            <th style={{ width: "15%" }}>ID</th>
            <th style={{ width: "15%" }}>Image</th>
            <th style={{ width: "8%" }}>Status</th>
            <th style={{ width: "8%" }}>CPU %</th>
            <th style={{ width: "8%" }}>Memory %</th>
            <th style={{ width: "26%" }}></th>
          </tr>
        </thead>
        <tbody>
          {containers.map((container) => {
            const handleSelectionChange = (isChecked: boolean) => {
              const newSelected = isChecked
                ? selected.concat(container.id)
                : selected.filter((cId) => cId !== container.id);
              onSelectionChange(newSelected);
            };
            return (
              <tr
                key={container.id}
                onClick={() =>
                  handleSelectionChange(!selected.includes(container.id))
                }
              >
                <td style={{ padding: "12px 6px" }}>
                  <Checkbox
                    checked={selected.includes(container.id)}
                    onChange={(event) => {
                      handleSelectionChange(event.target.checked);
                    }}
                  />
                </td>
                <td>
                  <Typography noWrap level="body-sm">
                    {container.name || ""}
                  </Typography>
                </td>
                <td>
                  <Typography noWrap level="body-sm">
                    {container.id.substring(0, 12)}
                  </Typography>
                </td>
                <td>
                  <Typography noWrap level="body-sm">
                    {container.image || "N/A"}
                  </Typography>
                </td>
                <td>
                  <StatusChip status={container.state} />
                </td>
                <td>
                  <Typography level="body-sm">
                    {(container.cpu_percent ?? 0).toFixed(2)}
                  </Typography>
                </td>
                <td>
                  <Typography level="body-sm">
                    {(container.memory_percent ?? 0).toFixed(2)}
                  </Typography>
                </td>
                <td onClick={(event) => event.stopPropagation()}>
                  <Box
                    sx={{
                      display: { xs: "none", xl: "flex" },
                      textAlign: "center",
                    }}
                  >
                    <ButtonGroup
                      aria-label="Container actions"
                      variant="soft"
                      size="sm"
                      // sx={{ display: { xs: 'none', xl: 'flex' }, margin: '0 auto' }}
                    >
                      <Button
                        color="neutral"
                        size="sm"
                        onClick={() => onContainerClick(container.id)}
                      >
                        Details
                      </Button>
                      <Button
                        color="warning"
                        size="sm"
                        onClick={() => onContainerStop(container.id)}
                      >
                        Stop
                      </Button>
                      <Button
                        color="primary"
                        size="sm"
                        onClick={() => onContainerRestart(container.id)}
                      >
                        Restart
                      </Button>
                      <Button
                        color="danger"
                        size="sm"
                        onClick={() => onContainerRemove(container.id)}
                      >
                        Remove
                      </Button>
                    </ButtonGroup>
                  </Box>
                  <Box
                    sx={{
                      display: { xs: "block", xl: "none" },
                      textAlign: "center",
                    }}
                  >
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
                        <MenuItem
                          onClick={() => onContainerClick(container.id)}
                        >
                          Details
                        </MenuItem>
                        <MenuItem
                          color="warning"
                          onClick={() => onContainerStop(container.id)}
                        >
                          Stop
                        </MenuItem>
                        <MenuItem
                          color="primary"
                          onClick={() => onContainerRestart(container.id)}
                        >
                          Restart
                        </MenuItem>
                        <MenuItem
                          color="danger"
                          onClick={() => onContainerRemove(container.id)}
                        >
                          Remove
                        </MenuItem>
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

export default ContainersTable;
