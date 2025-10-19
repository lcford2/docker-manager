import { Typography } from "@mui/joy";
import React from "react";

import { DockerStatus } from "../../types/docker";
import Title from "../common/Title";

interface SystemSummaryProps {
  dockerStatus: DockerStatus | null;
}

export default function SystemSummary({ dockerStatus }: SystemSummaryProps) {
  return (
    <React.Fragment>
      <Title>System Health</Title>
      <Typography level="h4" component="p">
        {dockerStatus?.status === "connected" ? "Online" : "Offline"}
      </Typography>
      <Typography color="neutral" sx={{ flex: 1 }}>
        Docker version: {dockerStatus?.docker_version || "N/A"}
      </Typography>
      <div>
        <Typography color="neutral">
          API status:{" "}
          {dockerStatus?.status === "connected" ? "Connected" : "Disconnected"}
        </Typography>
      </div>
    </React.Fragment>
  );
}
