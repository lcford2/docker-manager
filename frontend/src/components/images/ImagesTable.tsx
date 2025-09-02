import {
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
import {
  ArrowDownward,
  MoreHoriz,
} from "@mui/icons-material";
import React from "react";
import { DockerImage } from "../../types/docker";
import { formatBytes, formatDateTime, isDanglingImage } from "../../utils/formatters";

interface ImagesTableProps {
  images: DockerImage[];
  selected: readonly string[];
  onSelectionChange: (selected: readonly string[]) => void;
  onImageClick: (imageId: string) => void;
  onImageRemove: (imageId: string) => void;
}

const ImagesTable: React.FC<ImagesTableProps> = ({
  images,
  selected,
  onSelectionChange,
  onImageClick,
  onImageRemove,
}) => {
  return (
    <Sheet variant="outlined" sx={{ width: "100%", boxShadow: "sm", borderRadius: "sm" }}>
      <Table aria-label="Images table" stickyHeader hoverRow={true} variant="plain">
        <thead>
          <tr>
            <th style={{ width: 40, padding: "12px 6px" }}>
              <Checkbox
                indeterminate={
                  selected.length > 0 && selected.length < images.length
                }
                checked={selected.length === images.length}
                onChange={(event) => {
                  onSelectionChange(
                    event.target.checked ? images.map((img) => img.id) : []
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
                Repository
              </Link>
            </th>
            <th>Tag</th>
            <th>ID</th>
            <th>Size</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {images.map((image) => {
            const isDangling = isDanglingImage(image.repository, image.tag);
            return (
              <tr key={image.id}>
                <td style={{ padding: "12px 6px" }}>
                  <Checkbox
                    checked={selected.includes(image.id)}
                    onChange={(event) => {
                      const newSelected = event.target.checked
                        ? selected.concat(image.id)
                        : selected.filter((imgId) => imgId !== image.id);
                      onSelectionChange(newSelected);
                    }}
                  />
                </td>
                <td>
                  <Typography level="body-sm">{image.repository}</Typography>
                  {isDangling && <Chip color="warning" size="sm" sx={{ ml: 1 }}>Dangling</Chip>}
                </td>
                <td>
                  <Typography level="body-sm">{image.tag}</Typography>
                </td>
                <td>
                  <Typography level="body-sm">{image.id.substring(0, 12)}</Typography>
                </td>
                <td>
                  <Typography level="body-sm">{formatBytes(image.size)}</Typography>
                </td>
                <td>
                  <Typography level="body-sm">{formatDateTime(image.created)}</Typography>
                </td>
                <td>
                  <ButtonGroup aria-label="Image actions" variant="soft" size="sm">
                      <Button onClick={() => onImageClick(image.id)}>
                        Details
                      </Button>
                      <Button color="danger" onClick={() => onImageRemove(image.id)}>
                        Remove
                      </Button>
                  </ButtonGroup>
                </td>
                {/* <td>
                  <Dropdown>
                    <MenuButton
                      slots={{ root: IconButton }}
                      slotProps={{ root: { variant: "plain", color: "neutral", size: "sm" } }}
                    >
                      <MoreHoriz />
                    </MenuButton>
                    <Menu size="sm" sx={{ minWidth: 140 }}>
                      <MenuItem onClick={() => onImageClick(image.id)}>
                        View Details
                      </MenuItem>
                      <MenuItem color="danger" onClick={() => onImageRemove(image.id)}>
                        Remove
                      </MenuItem>
                    </Menu>
                  </Dropdown>
                </td> */}
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Sheet>
  );
};

export default ImagesTable;
