/**
 * AgentCostChart Component
 * Pie chart showing cost distribution by agent
 */

import React from 'react';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { AgentCostBreakdown } from '../types/cost';

export interface AgentCostChartProps {
  data: AgentCostBreakdown[];
  height?: number;
}

const COLORS = [
  '#3b82f6',
  '#ef4444',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
];

export function AgentCostChart({
  data,
  height = 300,
}: AgentCostChartProps): JSX.Element {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200"
        style={{ height }}
      >
        <p className="text-gray-500">No agent cost data available</p>
      </div>
    );
  }

  const chartData = data.map((agent) => ({
    name: agent.agent,
    value: agent.totalCost,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, value }) => `${name}: $${value.toFixed(3)}`}
          outerRadius={100}
          fill="#8884d8"
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: any) => `$${value.toFixed(4)}`}
          labelStyle={{ color: '#000' }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export default AgentCostChart;
