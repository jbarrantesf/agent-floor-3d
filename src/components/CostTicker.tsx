/**
 * CostTicker Component - Real-time Cost Display
 */

import React, { useState, useEffect } from 'react';
import { CostData } from '../types/floor-3d';

interface CostTickerProps {
  costData: CostData;
}

/**
 * Real-time cost ticker display
 */
export default function CostTicker({ costData }: CostTickerProps): React.ReactElement {
  const [animatingCost, setAnimatingCost] = useState(0);

  useEffect(() => {
    // Animate last task cost
    const interval = setInterval(() => {
      setAnimatingCost(prev => {
        const diff = costData.lastTaskCost - prev;
        if (Math.abs(diff) < 0.0001) return costData.lastTaskCost;
        return prev + diff * 0.1;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [costData.lastTaskCost]);

  const formatCurrency = (value: number): string => {
    return `$${value.toFixed(4)}`;
  };

  return (
    <div className="cost-ticker">
      <div className="ticker-content">
        {/* Last Task Cost */}
        <div className="ticker-item">
          <span className="ticker-label">Last Task:</span>
          <span className="ticker-value">
            {formatCurrency(animatingCost)}
          </span>
        </div>

        {/* Divider */}
        <span className="ticker-divider">|</span>

        {/* Running Cost */}
        <div className="ticker-item">
          <span className="ticker-label">Running:</span>
          <span className="ticker-value">
            {formatCurrency(costData.runningTasksCost)}
          </span>
        </div>

        {/* Divider */}
        <span className="ticker-divider">|</span>

        {/* Daily Total */}
        <div className="ticker-item highlight">
          <span className="ticker-label">Today:</span>
          <span className="ticker-value">
            {formatCurrency(costData.totalDailyCost)}
          </span>
        </div>

        {/* Divider */}
        <span className="ticker-divider">|</span>

        {/* Task Count */}
        <div className="ticker-item">
          <span className="ticker-label">Tasks:</span>
          <span className="ticker-value">
            {costData.taskCount}
          </span>
        </div>

        {/* Divider */}
        <span className="ticker-divider">|</span>

        {/* Cost per Second */}
        <div className="ticker-item">
          <span className="ticker-label">Rate:</span>
          <span className="ticker-value">
            {formatCurrency(costData.costPerSecond)}/s
          </span>
        </div>
      </div>

      {/* Agent Cost Breakdown (optional) */}
      {Object.keys(costData.dailyAgentCost).length > 0 && (
        <div className="agent-cost-breakdown">
          <div className="breakdown-header">Agent Costs:</div>
          <div className="breakdown-items">
            {Object.entries(costData.dailyAgentCost).slice(0, 3).map(([agent, cost]) => (
              <div key={agent} className="breakdown-item">
                <span>{agent}:</span>
                <span>{formatCurrency(cost as number)}</span>
              </div>
            ))}
            {Object.keys(costData.dailyAgentCost).length > 3 && (
              <div className="breakdown-item">
                <span>+{Object.keys(costData.dailyAgentCost).length - 3} more</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
