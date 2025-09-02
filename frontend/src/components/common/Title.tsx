import React from "react";
import { Typography } from "@mui/joy";

interface TitleProps {
  children?: React.ReactNode;
}

export default function Title(props: TitleProps) {
  return (
    <Typography component="h2" level="title-lg" color="primary" gutterBottom>
      {props.children}
    </Typography>
  );
}
