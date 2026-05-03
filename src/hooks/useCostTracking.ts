/**
 * useCostTracking - Cost ticker subscription hook
 */

import { useEffect, useState } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { CostData } from '../types/floor-3d';

export function useCostTracking(supabase: SupabaseClient) {
  const [costData, setCostData] = useState<CostData>({
    lastTaskCost: 0,
    dailyAgentCost: {},
    totalDailyCost: 0,
    runningTasksCost: 0,
    taskCount: 0,
    costPerSecond: 0
  });

  useEffect(() => {
    // Fetch initial cost data
    const fetchInitialCosts = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        
        const { data: costEvents } = await supabase
          .from('cost_tracking')
          .select('*')
          .gte('created_at', today);

        if (costEvents) {
          let totalCost = 0;
          let taskCnt = 0;
          const agentCosts: Record<string, number> = {};

          costEvents.forEach((event: any) => {
            const agent = event.agent_name || 'unknown';
            agentCosts[agent] = (agentCosts[agent] || 0) + (event.cost_usd || 0);
            totalCost += event.cost_usd || 0;
            taskCnt++;
          });

          setCostData({
            lastTaskCost: costEvents[0]?.cost_usd || 0,
            dailyAgentCost: agentCosts,
            totalDailyCost: totalCost,
            runningTasksCost: 0,
            taskCount: taskCnt,
            costPerSecond: totalCost / (24 * 3600) // Rough estimate
          });
        }
      } catch (error) {
        console.error('Failed to fetch cost data:', error);
      }
    };

    fetchInitialCosts();

    // Subscribe to cost updates
    const channel = supabase
      .channel('cost_tracking_updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'cost_tracking'
        },
        (payload: any) => {
          const newCost = payload.new;
          
          setCostData(prev => ({
            ...prev,
            lastTaskCost: newCost.cost_usd || 0,
            totalDailyCost: prev.totalDailyCost + (newCost.cost_usd || 0),
            taskCount: prev.taskCount + 1,
            dailyAgentCost: {
              ...prev.dailyAgentCost,
              [newCost.agent_name]: (prev.dailyAgentCost[newCost.agent_name] || 0) + (newCost.cost_usd || 0)
            }
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  return costData;
}
