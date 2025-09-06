import { useTheme } from "@mui/joy/styles";
import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface ChartDataPoint {
  time: string;
  cpu: number;
  memory: number;
}

interface ResourceChartProps {
  data: ChartDataPoint[];
  title?: string;
  height?: number;
}

const ResourceChart: React.FC<ResourceChartProps> = ({
  data,
  title = "Live Resource Usage",
  height = 300,
}) => {
  const theme = useTheme();

  return (
    <div style={{ width: "100%", height }}>
      <h3 style={{ textAlign: "center", marginBottom: "10px" }}>{title}</h3>
      <ResponsiveContainer>
        <LineChart
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <XAxis dataKey="time" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="cpu"
            stroke="rgba(0, 146, 204, 0.8)"
            activeDot={{ r: 8 }}
            name="CPU %"
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="memory"
            stroke="rgba(255, 51, 51, 0.8)"
            name="Memory %"
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ResourceChart;
