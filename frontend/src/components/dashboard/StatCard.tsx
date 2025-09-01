import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color?: string;
  path: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color = 'primary.main', path }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(path);
  };

  return (
    <Card
      sx={{
        cursor: 'pointer',
        '&:hover': {
          backgroundColor: 'action.hover',
        },
      }}
      onClick={handleClick}
    >
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography color="textSecondary" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" component="div">
              {value}
            </Typography>
          </Box>
          <Box color={color}>{icon}</Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default StatCard; 