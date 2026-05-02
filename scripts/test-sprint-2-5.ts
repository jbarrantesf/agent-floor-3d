#!/usr/bin/env node
/**
 * SPRINT 2.5 Test Suite: Bilateral Hermes ↔ ORBIT Communication
 * Tests: Supabase handoff flow, realtime sync, latency
 */

import fetch from 'node-fetch'
import { WebSocket } from 'ws'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import path from 'path'

// Load env
config({ path: path.resolve(process.env.HOME!, '.env') })

const API_BASE = 'http://localhost:3001'
const WS_URL = 'ws://localhost:3001/ws'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
let testsPassed = 0
let testsFailed = 0

// ==================== TEST UTILITIES ====================
async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function test(name: string, fn: () => Promise<void>) {
  try {
    console.log(`\n▶️  ${name}`)
    const start = Date.now()
    await fn()
    const duration = Date.now() - start
    console.log(`   ✅ PASS (${duration}ms)`)
    testsPassed++
  } catch (err: any) {
    console.error(`   ❌ FAIL: ${err.message}`)
    testsFailed++
  }
}

// ==================== TESTS ====================

async function runTests() {
  console.log(`
╔════════════════════════════════════════╗
║ SPRINT 2.5 TEST SUITE                 ║
║ Bilateral Hermes ↔ ORBIT Communication║
╚════════════════════════════════════════╝
  `)

  // ========== API HEALTH CHECK ==========
  await test('API Health Check', async () => {
    const res = await fetch(`${API_BASE}/api/health`)
    const data = (await res.json()) as any
    if (!data.ok) throw new Error('Health check failed')
    if (!data.supabase?.connected) throw new Error('Supabase not connected')
  })

  // ========== SUPABASE CONNECTION ==========
  await test('Supabase Tables Exist', async () => {
    const { data: handoffs, error: e1 } = await supabase
      .from('agent_handoffs')
      .select('count')
      .limit(1)
    if (e1) throw new Error(`agent_handoffs: ${e1.message}`)

    const { data: events, error: e2 } = await supabase
      .from('agent_events')
      .select('count')
      .limit(1)
    if (e2) throw new Error(`agent_events: ${e2.message}`)

    const { data: state, error: e3 } = await supabase
      .from('agent_state')
      .select('*')
    if (e3) throw new Error(`agent_state: ${e3.message}`)
    if (!state || state.length === 0) throw new Error('No agent states in DB')
  })

  // ========== CREATE HANDOFF ==========
  let handoffId: string = ''
  await test('Create Handoff (Hermes → ORBIT)', async () => {
    const res = await fetch(`${API_BASE}/api/handoffs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from_agent: 'hermes',
        to_agent: 'orbit',
        task: {
          type: 'test_task',
          description: 'SPRINT 2.5 bilateral test',
          timestamp: new Date().toISOString()
        }
      })
    })
    const data = (await res.json()) as any
    if (!data.id) throw new Error('No handoff ID returned')
    handoffId = data.id
    if (data.status !== 'pending') throw new Error(`Expected status pending, got ${data.status}`)
  })

  // ========== READ HANDOFF FROM SUPABASE ==========
  await test('Read Handoff from Supabase', async () => {
    const { data, error } = await supabase
      .from('agent_handoffs')
      .select('*')
      .eq('id', handoffId)
      .single()

    if (error) throw new Error(error.message)
    if (!data) throw new Error('Handoff not found in DB')
    if (data.from_agent !== 'hermes') throw new Error('from_agent mismatch')
    if (data.to_agent !== 'orbit') throw new Error('to_agent mismatch')
  })

  // ========== UPDATE HANDOFF STATUS ==========
  await test('Update Handoff Status (pending → executing)', async () => {
    const res = await fetch(`${API_BASE}/api/handoffs/${handoffId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'executing' })
    })
    const data = (await res.json()) as any
    if (data.status !== 'executing') throw new Error(`Expected executing, got ${data.status}`)
  })

  // ========== LOG EVENT ==========
  let eventId: string = ''
  await test('Log Agent Event', async () => {
    const res = await fetch(`${API_BASE}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent: 'orbit',
        event_type: 'handoff_received',
        payload: {
          handoff_id: handoffId,
          message: 'ORBIT received and processing task',
          result: 'success'
        }
      })
    })
    const data = (await res.json()) as any
    if (!data.id) throw new Error('No event ID returned')
    eventId = data.id
  })

  // ========== READ EVENT FROM SUPABASE ==========
  await test('Read Event from Supabase', async () => {
    const { data, error } = await supabase
      .from('agent_events')
      .select('*')
      .eq('id', eventId)
      .single()

    if (error) throw new Error(error.message)
    if (!data) throw new Error('Event not found in DB')
    if (data.agent !== 'orbit') throw new Error('agent mismatch')
    if (data.event_type !== 'handoff_received') throw new Error('event_type mismatch')
  })

  // ========== UPDATE AGENT STATE ==========
  await test('Update Agent State', async () => {
    const res = await fetch(`${API_BASE}/api/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent: 'orbit',
        state: { status: 'running' },
        costs: { session: 0.0025 }
      })
    })
    const data = (await res.json()) as any
    if (data.agent !== 'orbit') throw new Error('agent mismatch')
    if (data.state?.status !== 'running') throw new Error('state not updated')
  })

  // ========== READ AGENT STATE ==========
  await test('Read Agent State', async () => {
    const res = await fetch(`${API_BASE}/api/state/orbit`)
    const data = (await res.json()) as any
    if (!data) throw new Error('State not found')
    if (data.state?.status !== 'running') throw new Error('Expected running state')
  })

  // ========== WEBSOCKET CONNECTION ==========
  await test('WebSocket Connection', async () => {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(WS_URL)
      let initialReceived = false

      ws.onopen = () => {
        console.log('   ├─ Connected')
      }

      ws.onmessage = (e) => {
        const data = JSON.parse(e.data)
        if (data.type === 'initial-state' && !initialReceived) {
          console.log('   ├─ Received initial-state')
          initialReceived = true
          ws.close()
        }
      }

      ws.onerror = (err) => {
        reject(new Error(`WS error: ${err}`))
      }

      ws.onclose = () => {
        if (initialReceived) {
          resolve()
        } else {
          reject(new Error('Did not receive initial-state'))
        }
      }

      setTimeout(() => reject(new Error('WS timeout')), 5000)
    })
  })

  // ========== COMPLETE BILATERAL FLOW ==========
  await test('Complete Bilateral Flow (Hermes → ORBIT → completion)', async () => {
    // 1. Hermes creates handoff
    const handoffRes = await fetch(`${API_BASE}/api/handoffs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from_agent: 'hermes',
        to_agent: 'orbit',
        task: {
          type: 'integration_test',
          step: 'bilateral_flow',
          timestamp: new Date().toISOString()
        }
      })
    })
    const handoff = (await handoffRes.json()) as any
    const id = handoff.id
    console.log(`   ├─ Step 1: Created handoff ${id}`)

    // 2. ORBIT updates status
    await fetch(`${API_BASE}/api/handoffs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'executing' })
    })
    console.log(`   ├─ Step 2: ORBIT processing (executing)`)

    // 3. ORBIT logs event
    await fetch(`${API_BASE}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent: 'orbit',
        event_type: 'task_completed',
        payload: { handoff_id: id, result: 'success' }
      })
    })
    console.log(`   ├─ Step 3: ORBIT logged event`)

    // 4. Update status to completed
    const completeRes = await fetch(`${API_BASE}/api/handoffs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' })
    })
    const finalHandoff = (await completeRes.json()) as any
    console.log(`   ├─ Step 4: Handoff completed`)

    if (finalHandoff.status !== 'completed') {
      throw new Error('Handoff not marked as completed')
    }

    // 5. Verify in Supabase
    const { data } = await supabase
      .from('agent_handoffs')
      .select('*')
      .eq('id', id)
      .single()

    if (data?.status !== 'completed') {
      throw new Error('Supabase handoff not persisted as completed')
    }
    console.log(`   ├─ Step 5: Verified in Supabase`)
  })

  // ========== LATENCY CHECK ==========
  await test('Latency Check (< 500ms)', async () => {
    const start = Date.now()

    const res = await fetch(`${API_BASE}/api/handoffs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from_agent: 'hermes',
        to_agent: 'orbit',
        task: { type: 'latency_test' }
      })
    })

    const latency = Date.now() - start

    if (latency > 500) {
      throw new Error(`Latency too high: ${latency}ms (expected < 500ms)`)
    }

    console.log(`   ├─ Handoff creation latency: ${latency}ms`)
  })

  // ========== SUMMARY ==========
  console.log(`
╔════════════════════════════════════════╗
║ TEST RESULTS                           ║
╠════════════════════════════════════════╣
║ Passed: ${String(testsPassed).padEnd(36, ' ')}║
║ Failed: ${String(testsFailed).padEnd(36, ' ')}║
╚════════════════════════════════════════╝
  `)

  process.exit(testsFailed > 0 ? 1 : 0)
}

// Run tests
runTests().catch((err) => {
  console.error('❌ Test suite error:', err)
  process.exit(1)
})
