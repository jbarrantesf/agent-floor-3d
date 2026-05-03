/**
 * CostTrendChart Component
 * Line chart showing 7-day cost trends
 */

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { DailyCostTrend } from '../types/cost';

export interface CostTrendChartProps {
  data: DailyCostTrend[];
  height?: number;
}

export function CostTrendChart({
  data,
  height = 300,
}: CostTrendChartProps): JSX.Element {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200"
        style={{ height }}
      >
        <p className="text-gray-500">No trend data available</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={data}
        margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis label={{ value: 'Cost (USD)', angle: -90, position: 'insideLeft' }} />
        <Tooltip
          formatter={(value: any) => `$${(value as number).toFixed(4)}`}
          labelStyle={{ color: '#000' }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="totalCost"
          stroke="#ef4444"
          strokeWidth={2}
          dot={{ fill: '#ef4444', r: 4 }}
          activeDot={{ r: 6 }}
          name="Daily Cost"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default CostTrendChart;
