import express, { Request, Response } from 'express'
import { WebSocketServer, WebSocket } from 'ws'
import { createServer } from 'http'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

const WS_PORT = process.env.WS_PORT || 3001

// Types
interface AgentState {
  hermes: 'idle' | 'running' | 'error'
  orbit: 'idle' | 'running' | 'error'
  subagent1: 'idle' | 'running' | 'error'
  subagent2: 'idle' | 'running' | 'error'
}

interface CostData {
  hermes: number
  orbit: number
}

// Simulated state
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

// Middleware
app.use(express.json())

// API Routes
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    agents: agentState,
    costs: costData
  })
})

app.get('/api/costs', (req: Request, res: Response) => {
  res.json(costData)
})

app.post('/api/costs/update', (req: Request, res: Response) => {
  costData = req.body
  
  // Broadcast to clients
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
  agentState = req.body
  
  // Broadcast to clients
  broadcast({
    type: 'agent-state',
    payload: agentState,
    timestamp: new Date().toISOString()
  })
  
  res.json({ ok: true })
})

app.post('/api/events', (req: Request, res: Response) => {
  const event = {
    ...req.body,
    timestamp: new Date().toISOString()
  }
  
  // Broadcast to clients
  broadcast({
    type: 'event',
    ...event
  })
  
  res.json({ ok: true })
})

// WebSocket handlers
wss.on('connection', (ws: WebSocket) => {
  console.log('✅ Client connected')
  
  // Send initial state
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
  
  ws.on('error', (err) => {
    console.error('❌ WebSocket error:', err.message)
  })
  
  ws.on('close', () => {
    console.log('🔌 Client disconnected')
  })
})

// Broadcast to all connected clients
function broadcast(data: any) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data))
    }
  })
}

// Mock event generator for demo (every 3-5 seconds)
setInterval(() => {
  const events = [
    { type: 'handoff', message: 'Hermes → ORBIT: Request approved' },
    { type: 'approval', message: 'ORBIT executed task successfully' },
    { type: 'sync', message: 'Cost sync completed' },
    { type: 'event', message: 'Subagent-1 spawned' },
    { type: 'complete', message: 'Task completed in 2.3s' }
  ]
  
  const randomEvent = events[Math.floor(Math.random() * events.length)]
  
  broadcast({
    type: 'event',
    ...randomEvent,
    timestamp: new Date().toISOString()
  })
}, 4000)

// Start server
server.listen(WS_PORT, () => {
  console.log(`
🚀 Mission Control Alpha Backend
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 WebSocket: ws://localhost:${WS_PORT}
🌐 REST API: http://localhost:${WS_PORT}/api
🏥 Health: http://localhost:${WS_PORT}/api/health
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `)
})

export default server
