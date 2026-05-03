/**
 * ControlPanel Component - UI Overlay
 */

import React, { useEffect, useState } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { AgentStatus } from '../types/floor-3d';

interface ControlPanelProps {
  selectedAgent: string | null;
  onClearSelection: () => void;
  onResetCamera: () => void;
  onFocusAgent: (agentName: string) => void;
  supabase: SupabaseClient;
}

/**
 * Control panel for agent details and scene controls
 */
export default function ControlPanel({
  selectedAgent,
  onClearSelection,
  onResetCamera,
  onFocusAgent,
  supabase
}: ControlPanelProps): React.ReactElement {
  const [agentDetails, setAgentDetails] = useState<AgentStatus | null>(null);
  const [activeTasks, setActiveTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedAgent) {
      setAgentDetails(null);
      setActiveTasks([]);
      return;
    }

    // Fetch agent details
    const fetchAgentDetails = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('agent_capacity')
          .select('*')
          .eq('agent_name', selectedAgent)
          .single();

        if (data) {
          setAgentDetails(data);
        }

        // Fetch active tasks for this agent
        const { data: tasks } = await supabase
          .from('tasks')
          .select('*')
          .eq('assigned_to', selectedAgent)
          .in('status', ['QUEUED', 'EXECUTING']);

        setActiveTasks(tasks || []);
      } catch (error) {
        console.error('Failed to fetch agent details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAgentDetails();
  }, [selectedAgent, supabase]);

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'idle': return 'badge-idle';
      case 'working': return 'badge-working';
      case 'error': return 'badge-error';
      case 'offline': return 'badge-offline';
      default: return 'badge-default';
    }
  };

  const utilization = agentDetails
    ? (agentDetails.current_load / agentDetails.max_concurrent_tasks) * 100
    : 0;

  return (
    <div className="control-panel">
      <div className="panel-header">
        <h2>Agent Floor Control</h2>
        <button className="close-button" onClick={onClearSelection}>×</button>
      </div>

      {/* Scene Controls */}
      <div className="scene-controls">
        <button onClick={onResetCamera} className="btn-primary">
          Reset Camera
        </button>
        <button onClick={() => window.location.reload()} className="btn-secondary">
          Refresh
        </button>
      </div>

      {/* Agent Details */}
      {agentDetails && (
        <div className="agent-details">
          <div className="details-header">
            <h3>{agentDetails.agent_name}</h3>
            <span className={`status-badge ${getStatusBadgeClass(agentDetails.status)}`}>
              {agentDetails.status.toUpperCase()}
            </span>
          </div>

          {loading ? (
            <p className="loading">Loading details...</p>
          ) : (
            <>
              {/* Status Info */}
              <div className="stat-section">
                <div className="stat">
                  <span>Status:</span>
                  <span className={agentDetails.is_online ? 'online' : 'offline'}>
                    {agentDetails.is_online ? '🟢 Online' : '🔴 Offline'}
                  </span>
                </div>

                <div className="stat">
                  <span>Load:</span>
                  <span>
                    {agentDetails.current_load} / {agentDetails.max_concurrent_tasks}
                  </span>
                </div>

                <div className="stat">
                  <span>Utilization:</span>
                  <div className="utilization-bar">
                    <div
                      className="utilization-fill"
                      style={{ width: `${utilization}%` }}
                    ></div>
                  </div>
                  <span className="utilization-percent">{utilization.toFixed(0)}%</span>
                </div>

                <div className="stat">
                  <span>Total Cost:</span>
                  <span>${agentDetails.total_cost_usd?.toFixed(2) || '0.00'}</span>
                </div>

                <div className="stat">
                  <span>Tasks Completed:</span>
                  <span>{agentDetails.total_tasks_completed || 0}</span>
                </div>
              </div>

              {/* Active Tasks */}
              {activeTasks.length > 0 && (
                <div className="tasks-section">
                  <h4>Active Tasks ({activeTasks.length})</h4>
                  <div className="tasks-list">
                    {activeTasks.slice(0, 5).map((task) => (
                      <div key={task.id} className="task-item">
                        <span className="task-id">{task.id.substring(0, 8)}...</span>
                        <span className={`task-status ${task.status.toLowerCase()}`}>
                          {task.status}
                        </span>
                      </div>
                    ))}
                    {activeTasks.length > 5 && (
                      <p className="more-tasks">+{activeTasks.length - 5} more</p>
                    )}
                  </div>
                </div>
              )}

              {/* Last Result */}
              {agentDetails.last_result && (
                <div className="result-section">
                  <h4>Last Result</h4>
                  <pre className="result-data">
                    {JSON.stringify(agentDetails.last_result, null, 2).substring(0, 200)}...
                  </pre>
                </div>
              )}

              {/* Focus Button */}
              <button
                className="btn-primary"
                onClick={() => onFocusAgent(agentDetails.agent_name)}
              >
                Focus Agent
              </button>
            </>
          )}
        </div>
      )}

      {/* No Selection Message */}
      {!agentDetails && (
        <div className="no-selection">
          <p>Click on an agent in the 3D scene to view details</p>
        </div>
      )}
    </div>
  );
}
