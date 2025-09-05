import { Table, Sheet, Button } from "@mui/joy";
import React from "react";
import { Link as RouterLink } from "react-router-dom";

import { DockerContainer } from "../../types/docker";
import Title from "../common/Title";

interface RunningContainersProps {
  containers: DockerContainer[];
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
            <th>Name</th>
            <th>Image</th>
            <th>State</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {containers.map((container) => (
            <tr key={container.id}>
              <td>{container.name}</td>
              <td>{container.image}</td>
              <td>{container.state}</td>
              <td>{container.status}</td>
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
