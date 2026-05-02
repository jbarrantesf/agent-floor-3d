import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Agent3DFloor } from './Agent3DFloor'
import { CostAnalytics } from './CostAnalytics'

// ==================== SUPABASE CLIENT ====================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

let supabaseClient: any = null
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}

export default function App() {
  const [events, setEvents] = useState<any[]>([])
  const [costs, setCosts] = useState({ hermes: 0.0042, orbit: 0.0018 })
  const [wsConnected, setWsConnected] = useState(false)
  const [costAnalyticsOpen, setCostAnalyticsOpen] = useState(false)
  const [supabaseConnected, setSupabaseConnected] = useState(false)
  
  console.log('🔍 App.tsx render — costAnalyticsOpen:', costAnalyticsOpen)
  const [agentStates, setAgentStates] = useState<{
    hermes: 'idle' | 'running' | 'error'
    orbit: 'idle' | 'running' | 'error'
    subagent1: 'idle' | 'running' | 'error'
    subagent2: 'idle' | 'running' | 'error'
  }>({
    hermes: 'idle',
    orbit: 'idle',
    subagent1: 'idle',
    subagent2: 'idle'
  })

  // ==================== WEBSOCKET CONNECTION ====================
  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws'
    let ws: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout>

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl)

        ws.onopen = () => {
          console.log('✅ WebSocket connected')
          setWsConnected(true)
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'request-state' }))
          }
        }

        ws.onerror = (e) => {
          console.error('❌ WebSocket error:', e)
          setWsConnected(false)
        }

        ws.onclose = () => {
          console.log('🔌 WebSocket disconnected, reconnecting...')
          setWsConnected(false)
          reconnectTimer = setTimeout(connect, 3000)
        }

        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data)
            if (data.type === 'initial-state') {
              setCosts(data.costs)
              setAgentStates(data.agents)
            }
            if (data.type === 'costs') {
              setCosts(data.payload)
            }
            if (data.type === 'agent-state') {
              setAgentStates(data.payload)
            }
          } catch (err) {
            console.error('Parse error:', err)
          }
        }
      } catch (e) {
        console.error('Failed to create WebSocket:', e)
        setWsConnected(false)
        reconnectTimer = setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close()
      }
    }
  }, [])

  // NOTE: Polling removed. WebSocket + Supabase realtime are the source of truth.
  // This eliminates redundant requests and keeps state in sync via push model.

  // ==================== SUPABASE REALTIME SUBSCRIPTIONS ====================
  useEffect(() => {
    if (!supabaseClient) {
      console.warn('⚠️ Supabase client not configured')
      return
    }

    setSupabaseConnected(true)

    const eventsChannel = supabaseClient
      .channel('agent_events_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'agent_events' },
        (payload: any) => {
          console.log('📨 New event:', payload.new.event_type)
          setEvents((prev) => [payload.new, ...prev].slice(0, 20))
        }
      )
      .subscribe()

    return () => {
      supabaseClient.removeChannel(eventsChannel)
    }
  }, [])

  return (
    <div className="h-screen w-screen flex flex-col bg-black overflow-hidden">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-cyan-900 to-purple-900 p-4 border-b border-cyan-500/30">
        <h1 className="text-3xl font-bold text-cyan-400">
          🚀 Agent Floor 3D — Mission Control Alpha
        </h1>
        <p className="text-xs text-gray-400 mt-1">Real-time Multi-Agent Orchestration Platform</p>
      </div>

      {/* MAIN LAYOUT: 3D Floor + Right Sidebar */}
      <div style={{ flex: 1, display: 'flex', gap: '1rem', padding: '1rem', overflow: 'hidden', height: '100%' }}>
        {/* 3D FLOOR (70% width) */}
        <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          <Agent3DFloor 
            agents={agentStates}
            costs={costs}
            handoffs={[
              { from: 'hermes', to: 'orbit', active: agentStates.hermes === 'running' && agentStates.orbit === 'running' }
            ]}
          />
          
          {/* MINI STATS BELOW 3D */}
          <div className="grid grid-cols-4 gap-2 bg-slate-900/50 p-4 rounded border border-slate-800">
            <div className="text-center">
              <p className="text-xs text-gray-400">WebSocket</p>
              <p className={`text-sm font-bold ${wsConnected ? 'text-green-500' : 'text-red-500'}`}>
                {wsConnected ? '🟢 LIVE' : '🔴 OFFLINE'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400">Supabase</p>
              <p className={`text-sm font-bold ${supabaseConnected ? 'text-green-500' : 'text-red-500'}`}>
                {supabaseConnected ? '🟢 CONNECTED' : '🔴 OFFLINE'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400">Hermes Cost</p>
              <p className="text-sm font-bold text-cyan-400">${costs.hermes.toFixed(4)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400">ORBIT Cost</p>
              <p className="text-sm font-bold text-purple-400">${costs.orbit.toFixed(4)}</p>
            </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR (30% width) */}
        <div className="w-[30%] flex flex-col gap-4 bg-slate-900/50 p-4 rounded border border-slate-800 overflow-y-auto">
          {/* AGENT STATES */}
          <div>
            <h3 className="text-sm font-bold text-cyan-400 mb-3">Agent States</h3>
            <div className="space-y-2">
              {Object.entries(agentStates).map(([agent, state]) => (
                <div key={agent} className="flex items-center justify-between p-2 bg-black/50 rounded">
                  <p className="text-xs font-mono text-gray-300 capitalize">{agent}</p>
                  <span className={`px-2 py-1 text-xs font-bold rounded border border-slate-700 ${
                    state === 'running' ? 'bg-green-500/30 text-green-300' :
                    state === 'error' ? 'bg-red-500/30 text-red-300' :
                    state === 'idle' ? 'bg-gray-500/30 text-gray-300' :
                    'bg-blue-500/30 text-blue-300'
                  }`}>
                    {String(state).toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* CONTROL BUTTONS */}
          <div>
            <h3 className="text-sm font-bold text-cyan-400 mb-3">Controls</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={async () => {
                  try {
                    await fetch('http://localhost:3001/api/agents/state', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({...agentStates, hermes: 'running'})
                    })
                  } catch (err) {
                    console.error('Failed to update Hermes state:', err)
                  }
                }}
                className="px-3 py-2 bg-cyan-600 hover:bg-cyan-700 rounded text-xs font-bold transition disabled:opacity-50"
              >
                ▶️ Hermes
              </button>
              <button
                onClick={async () => {
                  try {
                    await fetch('http://localhost:3001/api/agents/state', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({...agentStates, orbit: 'running'})
                    })
                  } catch (err) {
                    console.error('Failed to update ORBIT state:', err)
                  }
                }}
                className="px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded text-xs font-bold transition disabled:opacity-50"
              >
                ▶️ ORBIT
              </button>
              <button
                onClick={async () => {
                  await fetch('http://localhost:3001/api/agents/state', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({hermes: 'idle', orbit: 'idle', subagent1: 'idle', subagent2: 'idle'})
                  })
                }}
                className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-xs font-bold transition"
              >
                ⏹️ Reset
              </button>
              <button
                onClick={async () => {
                  try {
                    await fetch('http://localhost:3001/api/handoffs', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        from_agent: 'hermes',
                        to_agent: 'orbit',
                        task: { id: `task-${Date.now()}`, type: 'data_transfer', priority: 'high' },
                        status: 'pending'
                      })
                    })
                  } catch (err) {
                    console.error('Failed to create handoff:', err)
                  }
                }}
                className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-xs font-bold transition disabled:opacity-50"
              >
                📤 Handoff
              </button>
              <button
                onClick={() => setCostAnalyticsOpen(true)}
                className="px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded text-xs font-bold transition"
              >
                💰 Cost Analytics
              </button>
            </div>
          </div>

          {/* EVENT QUEUE */}
          <div>
            <h3 className="text-sm font-bold text-cyan-400 mb-3">Event Queue ({events.length})</h3>
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {events.slice(-10).map((event, i) => (
                <div key={i} className="text-xs text-gray-400 p-1 bg-black/50 rounded font-mono">
                  <span className="text-green-400">[{event.type || 'EVENT'}]</span> {event.message || 'System event'}
                </div>
              ))}
              {events.length === 0 && (
                <p className="text-xs text-gray-500 italic">No events yet</p>
              )}
            </div>
          </div>

          {/* METRICS */}
          <div>
            <h3 className="text-sm font-bold text-cyan-400 mb-3">Metrics</h3>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-gray-400">
                <span>Total Cost:</span>
                <span className="text-yellow-400">${(costs.hermes + costs.orbit).toFixed(4)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Uptime:</span>
                <span className="text-green-400">100%</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Throughput:</span>
                <span className="text-cyan-400">{events.length} evt/s</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <CostAnalytics isOpen={costAnalyticsOpen} onClose={() => setCostAnalyticsOpen(false)} />
    </div>
  )
}
