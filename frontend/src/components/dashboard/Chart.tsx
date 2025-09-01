import React from 'react';
import { useTheme } from '@mui/material/styles';
import { LineChart, Line, XAxis, YAxis, Label, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import Title from '../common/Title';

interface ChartDataPoint {
  time: string;
  cpu: number;
  memory: number;
}

interface ChartProps {
  data: ChartDataPoint[];
}

export default function Chart({ data }: ChartProps) {
  const theme = useTheme();

  return (
    <React.Fragment>
      <Title>Live Resource Usage</Title>
      <ResponsiveContainer>
        <LineChart
          data={data}
          margin={{
            top: 16,
            right: 16,
            bottom: 0,
            left: 24,
          }}
        >
          <XAxis
            dataKey="time"
            stroke={theme.palette.text.secondary}
            style={theme.typography.body2}
          />
          <YAxis
            stroke={theme.palette.text.secondary}
            style={theme.typography.body2}
          >
            <Label
              angle={270}
              position="left"
              style={{
                textAnchor: 'middle',
                fill: theme.palette.text.primary,
                ...theme.typography.body1,
              }}
            >
              Usage (%)
            </Label>
          </YAxis>
          <Tooltip />
          <Legend />
          <Line
            isAnimationActive={false}
            type="monotone"
            dataKey="cpu"
            stroke={theme.palette.primary.main}
            dot={false}
          />
          <Line
            isAnimationActive={false}
            type="monotone"
            dataKey="memory"
            stroke={theme.palette.secondary.main}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </React.Fragment>
  );
} 