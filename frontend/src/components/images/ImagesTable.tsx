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
  Typography,
} from "@mui/joy";
import { ArrowDownward, MoreHoriz } from "@mui/icons-material";
import React from "react";
import { DockerImage } from "../../types/docker";
import {
  formatBytes,
  formatDateTime,
  isDanglingImage,
  splitRepoTag,
} from "../../utils/formatters";

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
    <Sheet
      variant="outlined"
      sx={{ width: "100%", boxShadow: "sm", borderRadius: "sm" }}
    >
      <Table aria-label="Images table" stickyHeader variant="plain">
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
                    event.target.checked ? images.map((img) => img.Id) : [],
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
                sx={{ fontWeight: "lg", width: "35%" }}
              >
                Repository
              </Link>
            </th>
            <th style={{ width: "10%" }}>Tag</th>
            <th style={{ width: "20%" }}>ID</th>
            <th style={{ width: "15%" }}>Size</th>
            <th style={{ width: "15%" }}>Created</th>
            <th style={{ width: "15%" }}></th>
          </tr>
        </thead>
        <tbody>
          {images.map((image) => {
            const isDangling = isDanglingImage(image.RepoTags);
            const [repository, tag] = splitRepoTag(image.RepoTags[0]);
            const handleSelectionChange = (isChecked: boolean) => {
              const newSelected = isChecked
                ? selected.concat(image.Id)
                : selected.filter((imgId) => imgId !== image.Id);
              onSelectionChange(newSelected);
            };
            return (
              <tr
                key={image.Id}
                onClick={() =>
                  handleSelectionChange(!selected.includes(image.Id))
                }
              >
                <td style={{ padding: "12px 6px" }}>
                  <Checkbox
                    checked={selected.includes(image.Id)}
                    onChange={(event) => {
                      handleSelectionChange(event.target.checked);
                    }}
                  />
                </td>
                <td>
                  <Typography noWrap level="body-sm">
                    {repository}
                  </Typography>
                  {isDangling && (
                    <Chip color="warning" size="sm" sx={{ ml: 1 }}>
                      Dangling
                    </Chip>
                  )}
                </td>
                <td>
                  <Typography noWrap level="body-sm">
                    {tag}
                  </Typography>
                </td>
                <td>
                  <Typography noWrap level="body-sm">
                    {image.Id.substring(0, 12)}
                  </Typography>
                </td>
                <td>
                  <Typography level="body-sm">
                    {formatBytes(image.Size)}
                  </Typography>
                </td>
                <td>
                  <Typography level="body-sm">
                    {formatDateTime(image.Created)}
                  </Typography>
                </td>

                <td onClick={(event) => event.stopPropagation()}>
                  {/* Desktop ButtonGroup */}
                  <ButtonGroup
                    aria-label="Image actions"
                    variant="soft"
                    size="sm"
                    sx={{ display: { xs: "none", xl: "flex" } }}
                  >
                    <Button onClick={() => onImageClick(image.Id)}>
                      Details
                    </Button>
                    <Button
                      color="danger"
                      onClick={() => onImageRemove(image.Id)}
                    >
                      Remove
                    </Button>
                  </ButtonGroup>

                  {/* Mobile Dropdown */}
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
                        <MenuItem onClick={() => onImageClick(image.Id)}>
                          Details
                        </MenuItem>
                        <MenuItem
                          color="danger"
                          onClick={() => onImageRemove(image.Id)}
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

export default ImagesTable;
