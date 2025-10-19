import { Table, Sheet, Button, Typography } from "@mui/joy";
import { Link as RouterLink } from "react-router-dom";

import { ContainerStatsWithHistory } from "../../types/metrics";
import Title from "../common/Title";
import StatusChip from "../containers/StatusChip";

interface RunningContainersProps {
  containers: ContainerStatsWithHistory[];
}

export default function RunningContainers({
  containers,
}: RunningContainersProps) {
  return (
    <Sheet variant="outlined" sx={{ p: 2, borderRadius: "sm" }}>
      <Title>Running Containers</Title>
      <Table size="sm">
        <thead>
          <tr>
            <th style={{ width: "40%" }}>Name</th>
            <th style={{ width: "40%" }}>Image</th>
            <th style={{ width: "10%" }}>CPU %</th>
            <th style={{ width: "10%" }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {containers.map((container) => (
            <tr key={container.id}>
              <td>
                <Typography noWrap level="body-sm">
                  {container.name || ""}
                </Typography>
              </td>
              <td>
                <Typography noWrap level="body-sm">
                  {container.image || "N/A"}
                </Typography>
              </td>
              <td>
                <Typography level="body-sm">
                  {(container.cpu_percent ?? 0).toFixed(2)}
                </Typography>
              </td>
              <td>
                <StatusChip status={container.state} />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Button
        component={RouterLink}
        color="primary"
        to="/containers"
        sx={{ mt: 3 }}
        variant="outlined"
      >
        See more containers
      </Button>
    </Sheet>
  );
}
