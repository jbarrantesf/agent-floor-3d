import React, { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface CostData {
  timestamp: string;
  agent: string;
  cost: number;
}

interface AgentCostSummary {
  agent: string;
  totalCost: number;
  tokenCount: number;
  requestCount: number;
  avgCostPerRequest: number;
  lastUpdate: string;
}

interface CostAnalyticsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CostAnalytics: React.FC<CostAnalyticsProps> = ({ isOpen, onClose }) => {
  const [costHistory, setCostHistory] = useState<CostData[]>([]);
  const [agentBreakdown, setAgentBreakdown] = useState<AgentCostSummary[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchCostData();
      const interval = setInterval(fetchCostData, 10000); // Update every 10s
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const fetchCostData = async () => {
    try {
      setLoading(true);
      
      // Fetch cost breakdown
      const breakdownRes = await fetch('/api/costs/breakdown');
      if (breakdownRes.ok) {
        const breakdown = await breakdownRes.json();
        setAgentBreakdown(breakdown);
        const total = breakdown.reduce((sum: number, agent: AgentCostSummary) => sum + agent.totalCost, 0);
        setTotalCost(total);
      }

      // Fetch cost history (last 24 hours)
      const historyRes = await fetch('/api/costs/history?hours=24');
      if (historyRes.ok) {
        const history = await historyRes.json();
        setCostHistory(history);
      }
    } catch (error) {
      console.error('Error fetching cost data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Aggregate history by agent
  const agentHistoryMap = new Map<string, any[]>();
  costHistory.forEach(entry => {
    if (!agentHistoryMap.has(entry.agent)) {
      agentHistoryMap.set(entry.agent, []);
    }
    agentHistoryMap.get(entry.agent)!.push(entry);
  });

  // Group by time for line chart
  const timeSeriesData = Array.from(new Set(costHistory.map(d => d.timestamp))).map(timestamp => {
    const entry: any = { timestamp };
    costHistory
      .filter(d => d.timestamp === timestamp)
      .forEach(d => {
        entry[d.agent] = d.cost;
      });
    return entry;
  });

  const colors = {
    HERMES: '#06b6d4',
    ORBIT: '#d946ef',
    SubAgent1: '#eab308',
    SubAgent2: '#22c55e',
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 overflow-auto">
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-gray-900 rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-auto">
          {/* Header */}
          <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              💰 Cost Analytics Dashboard
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Total Cost Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-cyan-900 to-cyan-700 rounded-lg p-4">
                <div className="text-sm text-cyan-300 font-semibold">Total Cost</div>
                <div className="text-3xl font-bold text-white">${totalCost.toFixed(4)}</div>
              </div>
              {agentBreakdown.map(agent => (
                <div
                  key={agent.agent}
                  className="bg-gradient-to-br rounded-lg p-4"
                  style={{
                    backgroundImage: `linear-gradient(135deg, ${colors[agent.agent as keyof typeof colors]}33 0%, ${colors[agent.agent as keyof typeof colors]}11 100%)`,
                    borderLeft: `4px solid ${colors[agent.agent as keyof typeof colors]}`,
                  }}
                >
                  <div className="text-sm text-gray-300 font-semibold">{agent.agent}</div>
                  <div className="text-2xl font-bold text-white">${agent.totalCost.toFixed(4)}</div>
                  <div className="text-xs text-gray-400 mt-1">{agent.requestCount} requests</div>
                </div>
              ))}
            </div>

            {/* Cost Breakdown Pie Chart */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Cost Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={agentBreakdown}
                    dataKey="totalCost"
                    nameKey="agent"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {agentBreakdown.map(entry => (
                      <Cell key={entry.agent} fill={colors[entry.agent as keyof typeof colors]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #444' }}
                    formatter={(value: any) => `$${(value as number).toFixed(4)}`}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Agent Performance Metrics */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Agent Performance</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-gray-300">
                  <thead className="border-b border-gray-700">
                    <tr>
                      <th className="text-left py-2 px-4">Agent</th>
                      <th className="text-right py-2 px-4">Total Cost</th>
                      <th className="text-right py-2 px-4">Requests</th>
                      <th className="text-right py-2 px-4">Avg Cost/Req</th>
                      <th className="text-right py-2 px-4">Tokens</th>
                      <th className="text-right py-2 px-4">Last Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {agentBreakdown.map(agent => (
                      <tr key={agent.agent} className="hover:bg-gray-700 transition">
                        <td className="py-3 px-4 font-semibold">{agent.agent}</td>
                        <td className="text-right py-3 px-4 text-green-400">${agent.totalCost.toFixed(4)}</td>
                        <td className="text-right py-3 px-4">{agent.requestCount}</td>
                        <td className="text-right py-3 px-4">${agent.avgCostPerRequest.toFixed(6)}</td>
                        <td className="text-right py-3 px-4">{agent.tokenCount}</td>
                        <td className="text-right py-3 px-4 text-gray-500 text-xs">
                          {new Date(agent.lastUpdate).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cost Timeline */}
            {timeSeriesData.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-white mb-4">Cost Timeline (Last 24h)</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                    <XAxis 
                      dataKey="timestamp" 
                      stroke="#999"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis stroke="#999" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #444' }}
                      formatter={(value: any) => `$${(value as number).toFixed(6)}`}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Legend />
                    {Object.entries(colors).map(([agent, color]) => (
                      <Line
                        key={agent}
                        type="monotone"
                        dataKey={agent}
                        stroke={color}
                        dot={false}
                        isAnimationActive={false}
                        strokeWidth={2}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Budget Alert */}
            {totalCost > 1.0 && (
              <div className="bg-red-900 bg-opacity-20 border border-red-700 rounded-lg p-4 flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <div className="font-semibold text-red-400">Budget Alert</div>
                  <div className="text-sm text-red-300 mt-1">
                    Total cost has reached ${totalCost.toFixed(2)}. Consider optimizing agent usage or increasing budget allocation.
                  </div>
                </div>
              </div>
            )}

            {loading && (
              <div className="text-center text-gray-400">
                <div className="inline-block animate-spin">⚙️</div> Updating...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
