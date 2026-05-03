/**
 * MetricCard Component
 * Displays a single metric with value, title, and trend
 */

import React from 'react';

export interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  icon?: React.ReactNode;
  onClick?: () => void;
  loading?: boolean;
}

export function MetricCard({
  title,
  value,
  unit = '',
  trend,
  trendDirection = 'neutral',
  color = 'primary',
  icon,
  onClick,
  loading = false,
}: MetricCardProps): JSX.Element {
  const colorClasses: { [key: string]: string } = {
    primary: 'bg-blue-50 border-blue-200 text-blue-900',
    success: 'bg-green-50 border-green-200 text-green-900',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    danger: 'bg-red-50 border-red-200 text-red-900',
    info: 'bg-indigo-50 border-indigo-200 text-indigo-900',
  };

  const trendColorClasses: { [key: string]: string } = {
    up: 'text-red-600',
    down: 'text-green-600',
    neutral: 'text-gray-600',
  };

  const iconColorClasses: { [key: string]: string } = {
    primary: 'text-blue-500',
    success: 'text-green-500',
    warning: 'text-yellow-500',
    danger: 'text-red-500',
    info: 'text-indigo-500',
  };

  return (
    <div
      className={`metric-card border rounded-lg p-6 ${colorClasses[color]} transition-all hover:shadow-md ${
        onClick ? 'cursor-pointer' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-sm font-medium opacity-75 mb-1">{title}</p>
          {loading ? (
            <div className="h-8 bg-gray-200 rounded animate-pulse w-24"></div>
          ) : (
            <p className="text-3xl font-bold">
              {value}
              {unit && <span className="text-lg ml-1">{unit}</span>}
            </p>
          )}
        </div>
        {icon && (
          <div className={`text-2xl ${iconColorClasses[color]}`}>{icon}</div>
        )}
      </div>

      {trend && (
        <p className={`text-sm font-medium ${trendColorClasses[trendDirection]}`}>
          {trendDirection === 'up' && '↑ '}
          {trendDirection === 'down' && '↓ '}
          {trend}
        </p>
      )}
    </div>
  );
}

export default MetricCard;
