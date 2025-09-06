import {
  Box,
  ButtonGroup,
  Button,
  Checkbox,
  Chip,
  Dropdown,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  Link,
  Sheet,
  Table,
  Tooltip,
  Typography,
} from "@mui/joy";
import { ArrowDownward, MoreHoriz } from "@mui/icons-material";
import React from "react";
import { DockerVolume } from "../../types/docker";
import { formatDateTime, getVolumeDriverDisplay } from "../../utils/formatters";

interface VolumesTableProps {
  volumes: DockerVolume[];
  onVolumeClick: (volumeName: string) => void;
  onVolumeRemove: (volumeName: string) => void;
}

const VolumesTable: React.FC<VolumesTableProps> = ({
  volumes,
  onVolumeClick,
  onVolumeRemove,
}) => {
  const [selected, setSelected] = React.useState<readonly string[]>([]);

  return (
    <Sheet
      variant="outlined"
      sx={{ width: "100%", boxShadow: "sm", borderRadius: "sm" }}
    >
      <Table aria-label="Volumes table" stickyHeader>
        <thead>
          <tr>
            <th style={{ width: 40, padding: "12px 6px" }}>
              <Checkbox
                indeterminate={
                  selected.length > 0 && selected.length < volumes.length
                }
                checked={selected.length === volumes.length}
                onChange={(event) => {
                  setSelected(
                    event.target.checked ? volumes.map((v) => v.name) : [],
                  );
                }}
              />
            </th>
            <th style={{ width: "35%" }}>
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
            <th style={{ width: "20%" }}>Driver</th>
            <th style={{ width: "15%" }}>Scope</th>
            <th style={{ width: "15%" }}>Created</th>
            <th style={{ width: "15%" }}></th>
          </tr>
        </thead>
        <tbody>
          {volumes.map((volume) => {
            const handleSelectionChange = (isChecked: boolean) => {
              const newSelected = isChecked
                ? selected.concat(volume.name)
                : selected.filter((vName) => vName !== volume.name);
              setSelected(newSelected);
            };
            return (
              <tr
                key={volume.name}
                onClick={() =>
                  handleSelectionChange(!selected.includes(volume.name))
                }
              >
                <td style={{ padding: "12px 6px" }}>
                  <Checkbox
                    checked={selected.includes(volume.name)}
                    onChange={(event) => {
                      handleSelectionChange(event.target.checked);
                    }}
                  />
                </td>
                <td
                  style={{
                    maxWidth: "350px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  <Tooltip title={volume.name}>
                    <Typography noWrap level="body-sm">
                      {volume.name}
                    </Typography>
                  </Tooltip>
                </td>
                <td>
                  <Chip size="sm" color="primary">
                    {getVolumeDriverDisplay(volume.driver)}
                  </Chip>
                </td>
                <td>
                  <Typography noWrap level="body-sm">
                    {volume.scope}
                  </Typography>
                </td>
                <td>
                  <Typography level="body-sm">
                    {formatDateTime(volume.created)}
                  </Typography>
                </td>
                <td>
                  <ButtonGroup
                    aria-label="Volume actions"
                    variant="soft"
                    size="sm"
                    sx={{ display: { xs: "none", xl: "flex" } }}
                  >
                    <Button onClick={() => onVolumeClick(volume.name)}>
                      Details
                    </Button>
                    <Button
                      color="danger"
                      onClick={() => onVolumeRemove(volume.name)}
                    >
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
                        <MenuItem onClick={() => onVolumeClick(volume.name)}>
                          Details
                        </MenuItem>
                        <MenuItem
                          color="danger"
                          onClick={() => onVolumeRemove(volume.name)}
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

export default VolumesTable;
