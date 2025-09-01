import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableRow, Link } from '@mui/material';
import Title from '../common/Title';
import { DockerContainer } from '../../types/docker';

interface RunningContainersProps {
  containers: DockerContainer[];
}

export default function RunningContainers({ containers }: RunningContainersProps) {
  return (
    <React.Fragment>
      <Title>Running Containers</Title>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Image</TableCell>
            <TableCell>State</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {containers.map((container) => (
            <TableRow key={container.id}>
              <TableCell>{container.name}</TableCell>
              <TableCell>{container.image}</TableCell>
              <TableCell>{container.state}</TableCell>
              <TableCell>{container.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Link component={RouterLink} color="primary" to="/containers" sx={{ mt: 3 }}>
        See more containers
      </Link>
    </React.Fragment>
  );
} 