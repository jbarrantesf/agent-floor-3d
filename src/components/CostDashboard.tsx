/**
 * CostDashboard Component
 * Main analytics dashboard for cost tracking
 * Phase 5: Cost Tracking & Analytics
 */

import React, { useState, useEffect } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import MetricCard from './MetricCard';
import AgentCostChart from './AgentCostChart';
import CostTrendChart from './CostTrendChart';
import RecommendationsList from './RecommendationsList';
import { CostTracker } from '../lib/cost-tracker';
import { CostCalculator, costCalculator } from '../lib/cost-calculator';
import { CostOptimizer, costOptimizer } from '../lib/cost-optimizer';
import {
  EfficiencyMetrics,
  DailyCostTrend,
  AgentCostBreakdown,
  Recommendation,
  DailyCostSummary,
} from '../types/cost';

export interface CostDashboardProps {
  supabase: SupabaseClient;
  calculator?: CostCalculator;
  refreshInterval?: number;
}

export function CostDashboard({
  supabase,
  calculator = costCalculator,
  refreshInterval = 60000, // 1 minute
}: CostDashboardProps): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [dailyCost, setDailyCost] = useState(0);
  const [costByAgent, setCostByAgent] = useState<AgentCostBreakdown[]>([]);
  const [metrics, setMetrics] = useState<EfficiencyMetrics | null>(null);
  const [costTrends, setCostTrends] = useState<DailyCostTrend[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [costTracker, setCostTracker] = useState<CostTracker | null>(null);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  // Initialize cost tracker
  useEffect(() => {
    const tracker = new CostTracker({ supabase, calculator });
    setCostTracker(tracker);

    // Subscribe to real-time cost updates
    tracker.subscribeToTaskCosts();

    return () => {
      tracker.stop();
    };
  }, [supabase, calculator]);

  // Fetch data on component mount and when date changes
  useEffect(() => {
    if (!costTracker) return;

    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch metrics
        const metricsData = await costTracker.getEfficiencyMetrics(selectedDate);
        setMetrics(metricsData);
        setDailyCost(metricsData.totalCost);

        // Fetch agent breakdown
        const agentData = await costTracker.getCostByAgent(selectedDate);
        setCostByAgent(agentData);

        // Fetch 7-day trends
        const trendsData = await costTracker.getCostTrends(7);
        setCostTrends(trendsData);

        // Generate recommendations
        if (metricsData) {
          const recs = costOptimizer.generateRecommendations(
            metricsData,
            agentData,
            []
          );
          setRecommendations(recs);
        }

        setLoading(false);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setLoading(false);
      }
    };

    fetchData();

    // Set up polling for updates
    const interval = setInterval(fetchData, refreshInterval);

    return () => clearInterval(interval);
  }, [costTracker, selectedDate, refreshInterval]);

  const handleExportCSV = async () => {
    if (!costTracker) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      const data = await costTracker.getAllCostData(thirtyDaysAgo, today);

      const csv = [
        ['Date', 'Task Type', 'Agent', 'Total Tasks', 'Success Count', 'Total Cost', 'Avg Execution Time (ms)'],
        ...data.map((row) => [
          row.date,
          row.task_type,
          row.executor_name,
          row.total_tasks,
          row.success_count,
          row.total_cost_usd.toFixed(4),
          row.avg_execution_time_ms.toFixed(0),
        ]),
      ]
        .map((row) => row.join(','))
        .join('\n');

      const element = document.createElement('a');
      element.setAttribute(
        'href',
        'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
      );
      element.setAttribute('download', `cost-analytics-${today}.csv`);
      element.style.display = 'none';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } catch (error) {
      console.error('Error exporting CSV:', error);
    }
  };

  if (loading && !metrics) {
    return (
      <div className="p-8 bg-gray-50 rounded-lg">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const previousDay = new Date(new Date(selectedDate).getTime() - 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  return (
    <div className="cost-dashboard p-6 bg-gray-50 rounded-lg space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">💰 Cost Analytics</h1>
          <p className="text-gray-600">Real-time cost tracking and optimization insights</p>
        </div>
        <div className="flex gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          />
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium"
          >
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Today's Cost"
          value={`$${dailyCost.toFixed(3)}`}
          color="primary"
          icon="💵"
          loading={loading}
        />
        <MetricCard
          title="Total Tasks"
          value={metrics?.totalTasks || 0}
          color="info"
          icon="📋"
          loading={loading}
        />
        <MetricCard
          title="Success Rate"
          value={`${((metrics?.successRate || 0) * 100).toFixed(1)}%`}
          color={
            (metrics?.successRate || 0) > 0.95
              ? 'success'
              : (metrics?.successRate || 0) > 0.9
                ? 'warning'
                : 'danger'
          }
          icon="✅"
          loading={loading}
        />
        <MetricCard
          title="Avg Cost/Task"
          value={`$${(metrics?.costPerTask || 0).toFixed(4)}`}
          color="warning"
          icon="⚡"
          loading={loading}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agent Cost Breakdown */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-900">
            Cost by Agent (Today)
          </h2>
          <AgentCostChart data={costByAgent} height={300} />
        </div>

        {/* 7-Day Trend */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-900">
            7-Day Cost Trend
          </h2>
          <CostTrendChart data={costTrends} height={300} />
        </div>
      </div>

      {/* Efficiency Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white rounded-lg shadow p-6">
        <div>
          <p className="text-gray-600 text-sm mb-1">Total Cost/Success</p>
          <p className="text-2xl font-bold">
            ${(metrics?.costPerSuccess || 0).toFixed(4)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {metrics?.successCount || 0} successful tasks
          </p>
        </div>
        <div>
          <p className="text-gray-600 text-sm mb-1">Avg Execution Time</p>
          <p className="text-2xl font-bold">
            {((metrics?.averageExecutionTime || 0) / 1000).toFixed(2)}s
          </p>
          <p className="text-xs text-gray-500 mt-1">per task</p>
        </div>
        <div>
          <p className="text-gray-600 text-sm mb-1">Failed Tasks</p>
          <p className="text-2xl font-bold">
            {metrics?.totalTasks ? metrics.totalTasks - metrics.successCount : 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {metrics ? ((1 - metrics.successRate) * 100).toFixed(1) : 0}% failure rate
          </p>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4 text-gray-900">
          💡 Optimization Recommendations
        </h2>
        <RecommendationsList recommendations={recommendations} />
      </div>

      {/* Savings Summary */}
      {recommendations.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-bold text-blue-900 mb-2">Potential Daily Savings</h3>
          <p className="text-2xl font-bold text-blue-900">
            ${recommendations.reduce((sum, r) => sum + r.potentialSavings, 0).toFixed(4)}
          </p>
          <p className="text-sm text-blue-700 mt-1">
            If all recommendations are applied
          </p>
        </div>
      )}
    </div>
  );
}

export default CostDashboard;
