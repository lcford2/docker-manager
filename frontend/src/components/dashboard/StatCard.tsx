import { Card, Typography, Box } from "@mui/joy";
import { ColorPaletteProp } from "@mui/joy/styles";
import React from "react";
import { useNavigate } from "react-router-dom";

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color?: ColorPaletteProp;
  path: string;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  color = "primary",
  path,
}) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(path);
  };

  return (
    <Card
      variant="outlined"
      sx={{
        cursor: "pointer",
        "&:hover": {
          boxShadow: 'md',
          borderColor: 'neutral.outlinedHoverBorder',
        },
      }}
      onClick={handleClick}
    >
      <Box display="flex" alignItems="center">
        <Box
          sx={{
            mr: 2,
            p: 1.5,
            borderRadius: "50%",
            backgroundColor: `${color}.softBg`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: `${color}.solidColor`,
          }}
        >
          {icon}
        </Box>
        <Box>
          <Typography level="body-sm" sx={{ color: 'text.tertiary' }}>
            {title}
          </Typography>
          <Typography level="h2">
            {value}
          </Typography>
        </Box>
      </Box>
    </Card>
  );
};

export default StatCard;
