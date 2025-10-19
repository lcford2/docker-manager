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
                    event.target.checked ? volumes.map((v) => v.Name) : [],
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
                ? selected.concat(volume.Name)
                : selected.filter((vName) => vName !== volume.Name);
              setSelected(newSelected);
            };
            return (
              <tr
                key={volume.Name}
                onClick={() =>
                  handleSelectionChange(!selected.includes(volume.Name))
                }
              >
                <td style={{ padding: "12px 6px" }}>
                  <Checkbox
                    checked={selected.includes(volume.Name)}
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
                  <Tooltip title={volume.Name}>
                    <Typography noWrap level="body-sm">
                      {volume.Name}
                    </Typography>
                  </Tooltip>
                </td>
                <td>
                  <Chip size="sm" color="primary">
                    {getVolumeDriverDisplay(volume.Driver)}
                  </Chip>
                </td>
                <td>
                  <Typography noWrap level="body-sm">
                    {volume.Scope}
                  </Typography>
                </td>
                <td>
                  <Typography level="body-sm">
                    {formatDateTime(volume.CreatedAt)}
                  </Typography>
                </td>
                <td onClick={(event) => event.stopPropagation()}>
                  <ButtonGroup
                    aria-label="Volume actions"
                    variant="soft"
                    size="sm"
                    sx={{ display: { xs: "none", xl: "flex" } }}
                  >
                    <Button onClick={() => onVolumeClick(volume.Name)}>
                      Details
                    </Button>
                    <Button
                      color="danger"
                      onClick={() => onVolumeRemove(volume.Name)}
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
                        <MenuItem onClick={() => onVolumeClick(volume.Name)}>
                          Details
                        </MenuItem>
                        <MenuItem
                          color="danger"
                          onClick={() => onVolumeRemove(volume.Name)}
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
