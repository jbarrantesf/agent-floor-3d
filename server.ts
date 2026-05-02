import express from 'express'
import { WebSocketServer } from 'ws'
import { createServer } from 'http'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

const WS_PORT = process.env.WS_PORT || 3001
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://aybxrgvvwpknkoqrevqa.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

console.log('🔑 Credentials check:')
console.log(`   Supabase URL: ${SUPABASE_URL ? '✅' : '❌'}`)
console.log(`   Service Role Key: ${SUPABASE_SERVICE_ROLE_KEY ? '✅' : '❌'}\n`)

// Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

// Simulated state
let agentState = {
  hermes: 'idle',
  orbit: 'idle',
  subagent1: 'idle',
  subagent2: 'idle'
}

let costData = {
  hermes: 0.0042,
  orbit: 0.0018
}

// Middleware
app.use(express.json())
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.sendStatus(200)
  } else {
    next()
  }
})

// WebSocket upgrade handling with proper CORS headers
server.on('upgrade', (req, socket, head) => {
  if (req.url === '/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req)
    })
  } else {
    socket.destroy()
  }
})

// API Routes
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    agents: agentState,
    costs: costData
  })
})

app.get('/api/costs', (req, res) => {
  res.json(costData)
})

app.post('/api/costs/update', (req, res) => {
  costData = req.body
  broadcast({
    type: 'costs',
    payload: costData,
    timestamp: new Date().toISOString()
  })
  res.json({ ok: true })
})

app.get('/api/agents', (req, res) => {
  res.json(agentState)
})

app.post('/api/agents/state', (req, res) => {
  agentState = req.body
  broadcast({
    type: 'agent-state',
    payload: agentState,
    timestamp: new Date().toISOString()
  })
  res.json({ ok: true })
})

app.post('/api/handoffs', async (req, res) => {
  const { from_agent, to_agent, task, status } = req.body
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
    
    if (error) throw error
    
    const duration = Date.now() - startTime
    console.log(`✅ Handoff created in ${duration}ms`)
    
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
    console.error('❌ Handoff error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/state/:agent', async (req, res) => {
  const { agent } = req.params
  
  try {
    const { data, error } = await supabase
      .from('agent_state')
      .select('*')
      .eq('agent', agent)
      .single()
    
    if (error && error.code !== 'PGRST116') throw error
    
    res.json(data || null)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/events', async (req, res) => {
  const { agent, event_type, payload } = req.body
  
  try {
    const { data, error } = await supabase
      .from('agent_events')
      .insert([
        {
          agent,
          event_type,
          payload,
          timestamp: new Date().toISOString()
        }
      ])
      .select()
    
    if (error) throw error
    
    broadcast({
      type: 'event',
      agent,
      event_type,
      payload,
      timestamp: new Date().toISOString()
    })
    
    res.json({ ok: true, data: data?.[0] })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// WebSocket handlers
wss.on('connection', (ws) => {
  console.log('✅ Client connected')
  
  ws.send(JSON.stringify({
    type: 'initial-state',
    agents: agentState,
    costs: costData,
    timestamp: new Date().toISOString()
  }))
  
  ws.on('message', (data: string) => {
    try {
      const msg = JSON.parse(data)
      console.log('📨 Message from client:', msg.type)
      
      if (msg.type === 'agent-state-update') {
        agentState = msg.payload
        broadcast({
          type: 'agent-state',
          payload: agentState,
          timestamp: new Date().toISOString()
        })
      }
      
      if (msg.type === 'event') {
        broadcast({
          type: 'event',
          ...msg,
          timestamp: new Date().toISOString()
        })
      }
    } catch (err) {
      console.error('Parse error:', err)
    }
  })
  
  ws.on('error', (err: any) => {
    console.error('❌ WebSocket error:', err.message)
  })
  
  ws.on('close', () => {
    console.log('🔌 Client disconnected')
  })
})

// Broadcast to all connected clients
function broadcast(data: any) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(JSON.stringify(data))
    }
  })
}

// Supabase Realtime Subscriptions
async function subscribeToRealtimeEvents() {
  console.log('🔗 Initializing Supabase realtime subscriptions...')
  
  try {
    supabase
      .channel('public:agent_handoffs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agent_handoffs' },
        (payload: any) => {
          console.log('🔄 Handoff event:', payload.eventType)
          broadcast({
            type: 'handoff',
            payload: payload.new || payload.old,
            timestamp: new Date().toISOString()
          })
        }
      )
      .subscribe()

    supabase
      .channel('public:agent_events')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'agent_events' },
        (payload: any) => {
          console.log('📡 Agent event:', payload.new.event_type)
          broadcast({
            type: 'event',
            payload: payload.new,
            timestamp: new Date().toISOString()
          })
        }
      )
      .subscribe()

    supabase
      .channel('public:agent_state')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'agent_state' },
        (payload: any) => {
          console.log('🤖 Agent state update:', payload.new.agent)
          broadcast({
            type: 'agent-state',
            payload: payload.new,
            timestamp: new Date().toISOString()
          })
        }
      )
      .subscribe()
    
    console.log('✨ Supabase realtime subscriptions active')
  } catch (err: any) {
    console.error('⚠️  Realtime subscription error:', err.message)
  }
}

subscribeToRealtimeEvents()

// Start server
server.listen(WS_PORT, () => {
  console.log(`
🚀 Mission Control Alpha Backend
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 WebSocket: ws://localhost:${WS_PORT}/ws
🌐 REST API: http://localhost:${WS_PORT}/api
🏥 Health: http://localhost:${WS_PORT}/api/health
✨ Supabase Realtime: ENABLED
🎯 Project: aybxrgvvwpknkoqrevqa
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `)
})

export default server
