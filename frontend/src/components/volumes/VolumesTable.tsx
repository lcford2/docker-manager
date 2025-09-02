import {
  ButtonGroup,
  Button,
  Checkbox,
  Chip,
  Link,
  Sheet,
  Table,
  Tooltip,
  Typography,
} from "@mui/joy";
import {
  ArrowDownward,
} from "@mui/icons-material";
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
    <Sheet variant="outlined" sx={{ width: "100%", boxShadow: "sm", borderRadius: "sm" }}>
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
                    event.target.checked ? volumes.map((v) => v.name) : []
                  );
                }}
              />
            </th>
            <th style={{ maxWidth: "350px" }}>
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
            <th>Driver</th>
            <th>Scope</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {volumes.map((volume) => (
            <tr key={volume.name}>
              <td style={{ padding: "12px 6px" }}>
                <Checkbox
                  checked={selected.includes(volume.name)}
                  onChange={(event) => {
                    setSelected((names) =>
                      event.target.checked
                        ? names.concat(volume.name)
                        : names.filter((vName) => vName !== volume.name)
                    );
                  }}
                />
              </td>
              <td style={{ maxWidth: "350px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                <Tooltip title={volume.name}>
                  <Typography level="body-sm">{volume.name}</Typography>
                </Tooltip>
              </td>
              <td>
                <Chip size="sm" color="primary">{getVolumeDriverDisplay(volume.driver)}</Chip>
              </td>
              <td>
                <Typography level="body-sm">{volume.scope}</Typography>
              </td>
              <td>
                <Typography level="body-sm">{formatDateTime(volume.created)}</Typography>
              </td>
              <td>
                <ButtonGroup aria-label="Volume actions" variant="soft" size="sm">
                  <Button onClick={() => onVolumeClick(volume.name)}>
                    Details
                  </Button>
                  <Button color="danger" onClick={() => onVolumeRemove(volume.name)}>
                    Remove
                  </Button>
                </ButtonGroup>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Sheet>
  );
};

export default VolumesTable;
