import express, { Request, Response, NextFunction } from 'express'
import { WebSocketServer, WebSocket } from 'ws'
import { createServer, Server as HttpServer } from 'http'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

// ============ TYPES ============
interface AgentState {
  [agent: string]: 'idle' | 'running' | 'error'
}

interface CostData {
  [agent: string]: number
}

interface Handoff {
  from_agent: string
  to_agent: string
  task: any
  status: 'pending' | 'accepted' | 'completed' | 'failed'
}

interface BroadcastMessage {
  type: string
  timestamp: string
  [key: string]: any
}

// ============ CONFIG ============
const WS_PORT = parseInt(process.env.WS_PORT || '3001')
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://aybxrgvvwpknkoqrevqa.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const NODE_ENV = process.env.NODE_ENV || 'development'
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || ['localhost:3000', 'localhost:5173']

console.log(`🔑 Credentials check (${NODE_ENV}):`, SUPABASE_URL ? '✅' : '❌')

// ============ APP SETUP ============
const app = express()
const server: HttpServer = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  realtime: { eventsPerSecond: 10 }
})

// ============ STATE MANAGEMENT ============
let agentState: AgentState = {
  hermes: 'idle',
  orbit: 'idle',
  subagent1: 'idle',
  subagent2: 'idle'
}

let costData: CostData = {
  hermes: 0.0042,
  orbit: 0.0018
}

// WebSocket client tracking
const wsClients = new Set<WebSocket>()

// ============ MIDDLEWARE ============
app.use(express.json({ limit: '10kb' }))
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.get('origin')?.split(':')[0] || 'unknown'
  const isAllowed = ALLOWED_ORIGINS.some(allowed => req.get('origin')?.includes(allowed))
  
  if (isAllowed || NODE_ENV === 'development') {
    res.header('Access-Control-Allow-Origin', req.get('origin') || '*')
  }
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.header('X-Content-Type-Options', 'nosniff')
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(204)
  } else {
    next()
  }
})

// Error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[ERROR]', err.message)
  res.status(err.status || 500).json({ error: 'Internal Server Error' })
})

// ============ WEBSOCKET HANDLERS ============
server.on('upgrade', (req, socket, head) => {
  if (req.url === '/ws') {
    wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
      wss.emit('connection', ws, req)
    })
  } else {
    socket.destroy()
  }
})

wss.on('connection', (ws: WebSocket) => {
  wsClients.add(ws)
  console.log(`[WS] Client connected (${wsClients.size} total)`)
  
  // Send initial state
  ws.send(JSON.stringify({
    type: 'initial-state',
    agents: agentState,
    costs: costData,
    timestamp: new Date().toISOString()
  }))
  
  ws.on('message', handleWsMessage)
  ws.on('error', (err: Error) => console.error('[WS] Error:', err.message))
  ws.on('close', () => {
    wsClients.delete(ws)
    console.log(`[WS] Client disconnected (${wsClients.size} remaining)`)
  })
})

function handleWsMessage(data: Buffer | string) {
  try {
    const msg = JSON.parse(data.toString())
    if (msg.type === 'agent-state-update') {
      agentState = { ...agentState, ...msg.payload }
      broadcast({
        type: 'agent-state',
        payload: agentState,
        timestamp: new Date().toISOString()
      })
    }
  } catch (err) {
    console.error('[WS] Parse error:', err)
  }
}

// ============ API ROUTES ============
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    ok: true,
    version: '0.2.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    agents: agentState,
    costs: costData,
    wsClients: wsClients.size
  })
})

app.get('/api/costs', (req: Request, res: Response) => {
  res.json(costData)
})

app.post('/api/costs/update', (req: Request, res: Response) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Invalid request body' })
  }
  costData = req.body as CostData
  broadcast({
    type: 'costs',
    payload: costData,
    timestamp: new Date().toISOString()
  })
  res.json({ ok: true })
})

app.get('/api/agents', (req: Request, res: Response) => {
  res.json(agentState)
})

app.post('/api/agents/state', (req: Request, res: Response) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Invalid request body' })
  }
  agentState = { ...agentState, ...req.body } as AgentState
  broadcast({
    type: 'agent-state',
    payload: agentState,
    timestamp: new Date().toISOString()
  })
  res.json({ ok: true })
})

app.post('/api/handoffs', async (req: Request, res: Response) => {
  const { from_agent, to_agent, task, status } = req.body
  
  // Validation
  if (!from_agent || !to_agent || !task) {
    return res.status(400).json({ error: 'Missing required fields' })
  }
  
  const startTime = Date.now()
  try {
    const { data, error } = await supabase
      .from('agent_handoffs')
      .insert([
        {
          from_agent,
          to_agent,
          task,
          status: status || 'pending',
          created_at: new Date().toISOString()
        }
      ])
      .select()
    
    if (error) throw new Error(error.message)
    
    const duration = Date.now() - startTime
    console.log(`[HANDOFF] ${from_agent} → ${to_agent} (${duration}ms)`)
    
    broadcast({
      type: 'handoff',
      from: from_agent,
      to: to_agent,
      task: task.name || task,
      status: status || 'pending',
      duration,
      timestamp: new Date().toISOString()
    })
    
    res.json({ ok: true, data: data?.[0], duration })
  } catch (err: any) {
    console.error('[ERROR] Handoff:', err.message)
    res.status(500).json({ error: 'Handoff failed' })
  }
})

app.get('/api/state/:agent', async (req: Request, res: Response) => {
  const { agent } = req.params
  if (!agent) {
    return res.status(400).json({ error: 'Agent required' })
  }
  
  try {
    const { data, error } = await supabase
      .from('agent_state')
      .select('*')
      .eq('agent', agent)
      .single()
    
    if (error && error.code !== 'PGRST116') throw error
    res.json(data || null)
  } catch (err: any) {
    console.error('[ERROR] Get state:', err.message)
    res.status(500).json({ error: 'Failed to get state' })
  }
})

app.post('/api/events', async (req: Request, res: Response) => {
  const { agent, event_type, payload } = req.body
  
  if (!agent || !event_type) {
    return res.status(400).json({ error: 'Missing required fields' })
  }
  
  try {
    const { data, error } = await supabase
      .from('agent_events')
      .insert([
        {
          agent,
          event_type,
          payload: payload || {},
          timestamp: new Date().toISOString()
        }
      ])
      .select()
    
    if (error) throw new Error(error.message)
    
    broadcast({
      type: 'event',
      agent,
      event_type,
      payload,
      timestamp: new Date().toISOString()
    })
    
    res.json({ ok: true, data: data?.[0] })
  } catch (err: any) {
    console.error('[ERROR] Create event:', err.message)
    res.status(500).json({ error: 'Failed to create event' })
  }
})

// Broadcast to all connected clients with error handling
function broadcast(data: BroadcastMessage) {
  const msg = JSON.stringify(data)
  wsClients.forEach((client: WebSocket) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg, (err?: Error) => {
        if (err) {
          console.error('[WS] Broadcast error:', err.message)
          wsClients.delete(client)
        }
      })
    }
  })
}

// ============ SUPABASE REALTIME SUBSCRIPTIONS ============
async function subscribeToRealtimeEvents() {
  console.log('[REALTIME] Initializing subscriptions...')
  
  try {
    // Handoffs channel
    supabase
      .channel('agent_handoffs_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agent_handoffs' },
        (payload: any) => {
          console.log(`[REALTIME] Handoff ${payload.eventType}`)
          broadcast({
            type: 'handoff',
            event: payload.eventType,
            data: payload.new || payload.old,
            timestamp: new Date().toISOString()
          })
        }
      )
      .subscribe()

    // Events channel
    supabase
      .channel('agent_events_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'agent_events' },
        (payload: any) => {
          console.log(`[REALTIME] Event: ${payload.new.event_type}`)
          broadcast({
            type: 'event',
            data: payload.new,
            timestamp: new Date().toISOString()
          })
        }
      )
      .subscribe()

    // Agent state channel
    supabase
      .channel('agent_state_changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'agent_state' },
        (payload: any) => {
          console.log(`[REALTIME] Agent state: ${payload.new.agent}`)
          broadcast({
            type: 'agent-state',
            data: payload.new,
            timestamp: new Date().toISOString()
          })
        }
      )
      .subscribe()
    
    console.log('[REALTIME] ✅ All subscriptions active')
  } catch (err: any) {
    console.error('[ERROR] Realtime subscription:', err.message)
    // Retry after 5 seconds
    setTimeout(subscribeToRealtimeEvents, 5000)
  }
}

// ============ COST ANALYTICS ============
app.get('/api/costs/breakdown', async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 500, 1000)
  
  try {
    const { data: events, error } = await supabase
      .from('agent_events')
      .select('agent, cost, tokens, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw new Error(error.message)

    const breakdown: Record<string, any> = {}
    events?.forEach((event: any) => {
      if (!breakdown[event.agent]) {
        breakdown[event.agent] = {
          agent: event.agent,
          totalCost: 0,
          tokenCount: 0,
          requestCount: 0,
          avgCostPerRequest: 0,
          lastUpdate: event.created_at
        }
      }
      breakdown[event.agent].totalCost += event.cost || 0
      breakdown[event.agent].tokenCount += event.tokens || 0
      breakdown[event.agent].requestCount += 1
    })

    Object.values(breakdown).forEach((agent: any) => {
      agent.avgCostPerRequest = agent.requestCount > 0 ? agent.totalCost / agent.requestCount : 0
    })

    res.json(Object.values(breakdown))
  } catch (err: any) {
    console.error('[ERROR] Cost breakdown:', err.message)
    res.status(500).json({ error: 'Failed to fetch cost breakdown' })
  }
})

app.get('/api/costs/history', async (req: Request, res: Response) => {
  const hours = Math.min(parseInt(req.query.hours as string) || 24, 720)
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
  
  try {
    const { data: events, error } = await supabase
      .from('agent_events')
      .select('agent, cost, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: true })

    if (error) throw new Error(error.message)

    const history = events?.map((event: any) => ({
      timestamp: new Date(event.created_at).toLocaleTimeString(),
      agent: event.agent,
      cost: event.cost || 0
    })) || []

    res.json(history)
  } catch (err: any) {
    console.error('[ERROR] Cost history:', err.message)
    res.status(500).json({ error: 'Failed to fetch cost history' })
  }
})

app.get('/api/costs/total', async (req: Request, res: Response) => {
  try {
    const { data: events, error } = await supabase
      .from('agent_events')
      .select('cost')
      .limit(10000)

    if (error) throw new Error(error.message)

    const totalCost = events?.reduce((sum: number, e: any) => sum + (e.cost || 0), 0) || 0
    res.json({ totalCost })
  } catch (err: any) {
    console.error('[ERROR] Total cost:', err.message)
    res.status(500).json({ error: 'Failed to fetch total cost' })
  }
})

// ============ SERVER STARTUP ============
subscribeToRealtimeEvents()

server.listen(WS_PORT, () => {
  console.log(`
${'━'.repeat(50)}
🚀 NexAI Agent Floor 3D — Mission Control
${'━'.repeat(50)}
📡 WebSocket: ws://localhost:${WS_PORT}/ws
🌐 REST API: http://localhost:${WS_PORT}
🏥 Health: http://localhost:${WS_PORT}/api/health
🗄️  Supabase: ${SUPABASE_URL}
🔐 CORS: ${ALLOWED_ORIGINS.join(' | ')}
${'━'.repeat(50)}
`)
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[SHUTDOWN] Closing connections...')
  wss.clients.forEach((ws: WebSocket) => ws.close())
  server.close(() => {
    console.log('[SHUTDOWN] ✅ Server stopped')
    process.exit(0)
  })
})

export default server
