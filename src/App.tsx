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
  const [mobileTab, setMobileTab] = useState<'agents' | 'controls' | 'events'>('controls')
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

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

  // ==================== RESPONSIVE DETECTION ====================
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // ==================== WEBSOCKET CONNECTION ====================
  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL || 'wss://agent-floor-3d.loca.lt/ws'
    let ws: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let mounted = true

    const connect = () => {
      if (!mounted) return
      try {
        ws = new WebSocket(wsUrl)

        ws.onopen = () => {
          if (!mounted) return
          console.log('[WS] Connected')
          setWsConnected(true)
        }

        ws.onerror = (e: Event) => {
          console.error('[WS] Error:', e)
          setWsConnected(false)
        }

        ws.onclose = () => {
          if (!mounted) return
          console.log('[WS] Disconnected, retrying...')
          setWsConnected(false)
          reconnectTimer = setTimeout(connect, 3000)
        }

        ws.onmessage = (e: MessageEvent) => {
          if (!mounted) return
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
              setAgentStates(prev => ({ ...prev, ...data.payload }))
            }
          } catch (err) {
            // Silent
          }
        }
      } catch (e) {
        console.error('[WS] Failed to create:', e)
        setWsConnected(false)
        reconnectTimer = setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      mounted = false
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close()
      }
    }
  }, [])

  // ==================== SUPABASE REALTIME SUBSCRIPTIONS ====================
  useEffect(() => {
    if (!supabaseClient) {
      setSupabaseConnected(false)
      return
    }

    setSupabaseConnected(true)

    const eventsChannel = supabaseClient
      .channel('agent_events_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'agent_events' },
        (payload: any) => {
          console.log('[SUPABASE] New event:', payload.new.event_type)
          setEvents((prev) => [payload.new, ...prev].slice(0, 20))
        }
      )
      .subscribe((status: string) => {
        console.log(`[SUPABASE] Status: ${status}`)
        setSupabaseConnected(status === 'SUBSCRIBED')
      })

    return () => {
      eventsChannel.unsubscribe()
    }
  }, [])

  // API base URL
  const apiBase = import.meta.env.VITE_API_URL || 'https://agent-floor-3d.loca.lt'

  return (
    <div className="h-screen w-screen flex flex-col bg-black overflow-hidden">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-cyan-900 to-purple-900 px-3 md:px-4 py-2 md:py-3 border-b border-cyan-500/30">
        <h1 className="text-lg md:text-3xl font-bold text-cyan-400">
          🚀 Mission Control
        </h1>
        <p className="text-xs text-gray-400 mt-0.5 md:mt-1">Agent Orchestration</p>
      </div>

      {/* MAIN LAYOUT */}
      <div className="flex-1 flex flex-col md:flex-row gap-3 md:gap-4 p-2 md:p-4 overflow-hidden">
        {/* 3D SCENE - ALWAYS TOP/FULL ON DESKTOP */}
        <div className="w-full md:flex-1 h-1/2 md:h-full flex flex-col min-h-0">
          <Agent3DFloor
            agents={agentStates}
            costs={costs}
            handoffs={[
              { from: 'hermes', to: 'orbit', active: agentStates.hermes === 'running' && agentStates.orbit === 'running' }
            ]}
          />

          {/* STATS BAR */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1 md:gap-2 bg-gradient-to-r from-slate-900 to-slate-800 p-2 md:p-3 rounded border border-slate-700 text-xs md:text-sm flex-shrink-0">
            <div className="text-center">
              <p className="text-gray-400 text-xs hidden md:block">WebSocket</p>
              <p className={`font-bold flex items-center justify-center gap-1 ${
                wsConnected ? 'text-green-400' : 'text-red-500'
              }`}>
                <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="hidden md:inline">{wsConnected ? 'LIVE' : 'OFF'}</span>
              </p>
            </div>
            <div className="text-center">
              <p className="text-gray-400 text-xs hidden md:block">Supabase</p>
              <p className={`font-bold flex items-center justify-center gap-1 ${
                supabaseConnected ? 'text-green-400' : 'text-red-500'
              }`}>
                <span className={`w-2 h-2 rounded-full ${supabaseConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="hidden md:inline">{supabaseConnected ? 'OK' : 'OFF'}</span>
              </p>
            </div>
            <div className="text-center">
              <p className="text-gray-400 text-xs">Hermes</p>
              <p className="font-bold text-cyan-400">${costs.hermes?.toFixed(3) || '0.00'}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-400 text-xs">ORBIT</p>
              <p className="font-bold text-purple-400">${costs.orbit?.toFixed(3) || '0.00'}</p>
            </div>
          </div>
        </div>

        {/* CONTROLS PANEL - BOTTOM ON MOBILE, RIGHT ON DESKTOP */}
        <div className="w-full md:w-[32%] h-1/2 md:h-full flex flex-col bg-slate-900/50 rounded border border-slate-800 overflow-hidden">
          {/* Mobile Tabs */}
          {isMobile && (
            <div className="flex border-b border-slate-700 flex-shrink-0">
              {(['agents', 'controls', 'events'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setMobileTab(tab)}
                  className={`flex-1 px-2 py-2 text-xs font-bold transition ${
                    mobileTab === tab
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-2 md:p-3 space-y-3">
            {/* AGENTS TAB/SECTION */}
            {(!isMobile || mobileTab === 'agents') && (
              <div>
                <h3 className="text-xs md:text-sm font-bold text-cyan-400 mb-2">Agents</h3>
                <div className="space-y-1">
                  {Object.entries(agentStates).map(([agent, state]) => (
                    <div key={agent} className="flex items-center justify-between p-2 bg-black/50 rounded border border-slate-700">
                      <p className="text-xs font-mono text-gray-300 capitalize">{agent}</p>
                      <span className={`px-2 py-1 text-xs font-bold rounded ${
                        state === 'running' ? 'bg-green-500/30 text-green-300' :
                        state === 'error' ? 'bg-red-500/30 text-red-300' :
                        'bg-gray-500/30 text-gray-300'
                      }`}>
                        {String(state).toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CONTROLS TAB/SECTION */}
            {(!isMobile || mobileTab === 'controls') && (
              <div>
                <h3 className="text-xs md:text-sm font-bold text-cyan-400 mb-2">Controls</h3>
                <div className="grid grid-cols-2 gap-1 md:gap-2">
                  <button
                    onClick={async () => {
                      try {
                        await fetch(`${apiBase}/api/agents/state`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ ...agentStates, hermes: 'running' })
                        })
                      } catch (err) {
                        console.error('Hermes:', err)
                      }
                    }}
                    className="px-2 py-2 bg-cyan-600 hover:bg-cyan-700 rounded text-xs font-bold transition"
                  >
                    ▶️ Hermes
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await fetch(`${apiBase}/api/agents/state`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ ...agentStates, orbit: 'running' })
                        })
                      } catch (err) {
                        console.error('ORBIT:', err)
                      }
                    }}
                    className="px-2 py-2 bg-purple-600 hover:bg-purple-700 rounded text-xs font-bold transition"
                  >
                    ▶️ ORBIT
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await fetch(`${apiBase}/api/agents/state`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ hermes: 'idle', orbit: 'idle', subagent1: 'idle', subagent2: 'idle' })
                        })
                      } catch (err) {
                        console.error('Reset:', err)
                      }
                    }}
                    className="px-2 py-2 bg-red-600 hover:bg-red-700 rounded text-xs font-bold transition"
                  >
                    ⏹️ Reset
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await fetch(`${apiBase}/api/handoffs`, {
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
                        console.error('Handoff:', err)
                      }
                    }}
                    className="px-2 py-2 bg-green-600 hover:bg-green-700 rounded text-xs font-bold transition"
                  >
                    📤 HO
                  </button>
                  <button
                    onClick={() => setCostAnalyticsOpen(true)}
                    className="px-2 py-2 bg-amber-600 hover:bg-amber-700 rounded text-xs font-bold transition col-span-2"
                  >
                    💰 Analytics
                  </button>
                </div>
              </div>
            )}

            {/* EVENTS TAB/SECTION */}
            {(!isMobile || mobileTab === 'events') && (
              <div>
                <h3 className="text-xs md:text-sm font-bold text-cyan-400 mb-2">Events ({events.length})</h3>
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {events.slice(-8).map((event: any, i: number) => (
                    <div key={i} className="text-xs text-gray-400 p-1.5 bg-black/50 rounded font-mono border-l-2 border-cyan-500">
                      <span className="text-green-400">[{event.event_type || 'E'}]</span>
                      <span className="text-gray-500 ml-1">{event.agent || 'sys'}</span>
                    </div>
                  ))}
                  {events.length === 0 && (
                    <p className="text-xs text-gray-500 italic">Waiting...</p>
                  )}
                </div>
              </div>
            )}

            {/* Summary on Desktop */}
            {!isMobile && (
              <div className="pt-2 border-t border-slate-700">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="text-center p-2 bg-black/50 rounded">
                    <p className="text-gray-400">Total</p>
                    <p className="text-yellow-400 font-bold">${(costs.hermes + costs.orbit).toFixed(4)}</p>
                  </div>
                  <div className="text-center p-2 bg-black/50 rounded">
                    <p className="text-gray-400">Q</p>
                    <p className="text-cyan-400 font-bold">{events.length}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cost Analytics Modal */}
      <CostAnalytics isOpen={costAnalyticsOpen} onClose={() => setCostAnalyticsOpen(false)} />
    </div>
  )
}
