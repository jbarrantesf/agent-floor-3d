/**
 * Phase 5 Integration Example
 * Shows how to integrate the cost analytics dashboard
 */

import React from 'react';
import { createClient } from '@supabase/supabase-js';
import { CostDashboard } from './components/CostDashboard';
import { CostCalculator } from './lib/cost-calculator';
import { CostTracker } from './lib/cost-tracker';
import './styles/cost-dashboard.css';

// Initialize Supabase
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL || '',
  process.env.REACT_APP_SUPABASE_ANON_KEY || ''
);

// Optional: Custom calculator with modified cost tiers
const customCalculator = new CostCalculator();

// Example: Adjust cost tier for specific task type
customCalculator.setCostTier('high_priority_shell', {
  base: 0.0001,        // Higher base cost
  overhead: 0.00015,   // Higher overhead for priority handling
});

/**
 * Main App Component
 * Renders the cost analytics dashboard
 */
export function App(): JSX.Element {
  return (
    <div className="app">
      <header>
        <h1>Agent Floor 3D - Cost Analytics</h1>
      </header>

      <main>
        <CostDashboard
          supabase={supabase}
          calculator={customCalculator}
          refreshInterval={60000} // Refresh every minute
        />
      </main>

      <footer>
        <p>Phase 5: Cost Tracking & Analytics Dashboard</p>
      </footer>
    </div>
  );
}

/**
 * Alternative: Standalone cost tracker usage
 */
export function StandaloneCostTrackerExample(): void {
  const tracker = new CostTracker({
    supabase,
    calculator: customCalculator,
    pollIntervalMs: 30000, // Poll every 30 seconds
  });

  // Subscribe to real-time task completions
  tracker.subscribeToTaskCosts();

  // Listen for cost updates
  const unsubscribe = tracker.subscribe((event) => {
    console.log('Cost update:', event);

    if (event.type === 'task_completed') {
      console.log(`Task ${event.taskId} cost: $${event.cost?.toFixed(6)}`);
    }
  });

  // Fetch current day's metrics
  const today = new Date().toISOString().split('T')[0];
  tracker.getEfficiencyMetrics(today).then((metrics) => {
    console.log('Daily metrics:', {
      totalTasks: metrics.totalTasks,
      successRate: `${(metrics.successRate * 100).toFixed(1)}%`,
      totalCost: `$${metrics.totalCost.toFixed(4)}`,
      costPerTask: `$${metrics.costPerTask.toFixed(6)}`,
    });
  });

  // Cleanup when done
  return () => {
    unsubscribe();
    tracker.stop();
  };
}

/**
 * Alternative: Hooks-based usage
 */
export function useCostMetrics() {
  const [metrics, setMetrics] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const tracker = new CostTracker({ supabase, calculator: customCalculator });
    const today = new Date().toISOString().split('T')[0];

    const fetchMetrics = async () => {
      try {
        const data = await tracker.getEfficiencyMetrics(today);
        setMetrics(data);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();

    const interval = setInterval(fetchMetrics, 60000);

    return () => {
      clearInterval(interval);
      tracker.stop();
    };
  }, []);

  return { metrics, loading };
}

export default App;
