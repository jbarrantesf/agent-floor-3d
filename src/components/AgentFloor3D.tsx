/**
 * AgentFloor3D Component - Main 3D Container
 * Phase 6F: UI Overlay & Integration
 */

import React, { useRef, useEffect, useState } from 'react';
import { useAgentFloor3D } from '../hooks/useAgentFloor3D';
import { useCostTracking } from '../hooks/useCostTracking';
import { SupabaseClient } from '@supabase/supabase-js';
import ControlPanel from './ControlPanel';
import CostTicker from './CostTicker';
import './floor-3d.css';

interface AgentFloor3DProps {
  supabase: SupabaseClient;
}

/**
 * Main 3D agent floor component
 */
export default function AgentFloor3D({ supabase }: AgentFloor3DProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showStats, setShowStats] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; taskId: string } | null>(null);

  const {
    isInitialized,
    selectedAgent,
    metrics,
    focusAgent,
    resetCamera,
    clearSelection
  } = useAgentFloor3D(canvasRef, supabase);

  const costData = useCostTracking(supabase);

  // Handle context menu
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      // Context menu will be shown by interaction handler
    };

    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearSelection();
        setContextMenu(null);
      }
      if (e.key === 'r') {
        resetCamera();
      }
      if (e.key === 's') {
        setShowStats(!showStats);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [clearSelection, resetCamera, showStats]);

  if (!isInitialized) {
    return (
      <div className="floor-3d-loading">
        <div className="loading-spinner"></div>
        <p>Loading 3D Agent Floor...</p>
      </div>
    );
  }

  return (
    <div className="agent-floor-3d-container">
      {/* Canvas */}
      <canvas ref={canvasRef} className="floor-3d-canvas" />

      {/* Cost Ticker */}
      <CostTicker costData={costData} />

      {/* Control Panel */}
      <ControlPanel
        selectedAgent={selectedAgent}
        onClearSelection={clearSelection}
        onResetCamera={resetCamera}
        onFocusAgent={focusAgent}
        supabase={supabase}
      />

      {/* Performance Stats */}
      {showStats && (
        <div className="performance-stats">
          <div className="stat-item">
            <span>FPS:</span>
            <span className={metrics.fps >= 50 ? 'good' : 'warn'}>
              {metrics.fps.toFixed(0)}
            </span>
          </div>
          <div className="stat-item">
            <span>Memory:</span>
            <span>{(metrics.memoryUsage / 1024 / 1024).toFixed(1)}MB</span>
          </div>
          <div className="stat-item">
            <span>Draw Calls:</span>
            <span>{metrics.drawCalls}</span>
          </div>
          <div className="stat-item">
            <span>Triangles:</span>
            <span>{metrics.triangles.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Keyboard Help */}
      <div className="keyboard-help">
        <p><kbd>Click</kbd> Agent to select</p>
        <p><kbd>Right-Click</kbd> Task for options</p>
        <p><kbd>R</kbd> Reset camera</p>
        <p><kbd>S</kbd> Toggle stats</p>
        <p><kbd>Esc</kbd> Clear selection</p>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{
            position: 'absolute',
            left: contextMenu.x,
            top: contextMenu.y
          }}
        >
          <button onClick={() => {/* Pause task */}}>Pause</button>
          <button onClick={() => {/* Cancel task */}}>Cancel</button>
          <button onClick={() => {/* Reassign task */}}>Reassign</button>
        </div>
      )}
    </div>
  );
}
