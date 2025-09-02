import { Box, Typography } from "@mui/joy";
import { useTheme } from "@mui/joy/styles";
import { ColorPaletteProp } from "@mui/joy/styles";
import React, { useMemo } from "react";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";

import { MetricSparklineProps } from "../../types/metrics";

const MetricSparkline: React.FC<MetricSparklineProps> = ({
  data,
  color,
  label,
  unit = "",
  height = 50,
  width = 120,
}) => {
  const theme = useTheme();
  // Prepare data for Recharts
  const chartData = useMemo(() => {
    return data.map((value, index) => ({
      index,
      value: typeof value === "number" ? value : 0,
    }));
  }, [data]);

  // Get current value (latest data point)
  const currentValue = data.length > 0 ? data[data.length - 1] : 0;

  // Format the current value based on unit
  const formatValue = (value: number): string => {
    if (unit === "%") {
      return `${value.toFixed(1)}%`;
    } else if (unit === "bytes") {
      // Convert bytes to human readable format
      if (value >= 1024 * 1024 * 1024) {
        return `${(value / (1024 * 1024 * 1024)).toFixed(1)}GB`;
      } else if (value >= 1024 * 1024) {
        return `${(value / (1024 * 1024)).toFixed(1)}MB`;
      } else if (value >= 1024) {
        return `${(value / 1024).toFixed(1)}KB`;
      }
      return `${value}B`;
    } else if (unit === "bytes/s") {
      // Convert bytes per second to human readable format
      if (value >= 1024 * 1024) {
        return `${(value / (1024 * 1024)).toFixed(1)}MB/s`;
      } else if (value >= 1024) {
        return `${(value / 1024).toFixed(1)}KB/s`;
      }
      return `${value}B/s`;
    }
    return value.toString();
  };

  return (
    <Box sx={{ width: "100%", height, textAlign: "center" }}>
      <Typography level="body-sm" color="neutral" gutterBottom>
        {label}
      </Typography>
      <ResponsiveContainer width="100%" height="80%">
        {data.length > 0 ? (
          <LineChart data={chartData}>
            <YAxis hide domain={["dataMin", "dataMax"]} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={theme.palette[color as ColorPaletteProp]?.[500] || theme.palette.primary[500]}
              strokeWidth={2}
              dot={false}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </LineChart>
        ) : (
          <Box
            sx={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "text.disabled",
              fontSize: "0.7rem",
            }}
          >
            No Data
          </Box>
        )}
      </ResponsiveContainer>
      <Typography
        level="body-sm"
        sx={{
          mt: 0.5,
          fontWeight: "bold",
          color: color,
          fontSize: "0.8rem",
          textAlign: "center",
        }}
      >
        {formatValue(currentValue)}
      </Typography>
    </Box>
  );
};

export default MetricSparkline;
