import React from 'react';
import Typography from '@mui/material/Typography';
import Title from '../common/Title';
import { DockerStatus } from '../../types/docker';

interface SystemSummaryProps {
  dockerStatus: DockerStatus | null;
}

export default function SystemSummary({ dockerStatus }: SystemSummaryProps) {
  return (
    <React.Fragment>
      <Title>System Health</Title>
      <Typography component="p" variant="h4">
        {dockerStatus?.status === 'connected' ? 'Online' : 'Offline'}
      </Typography>
      <Typography color="text.secondary" sx={{ flex: 1 }}>
        Docker version: {dockerStatus?.docker_version || 'N/A'}
      </Typography>
      <div>
        <Typography color="text.secondary">
          API status: {dockerStatus?.status === 'connected' ? 'Connected' : 'Disconnected'}
        </Typography>
      </div>
    </React.Fragment>
  );
} 