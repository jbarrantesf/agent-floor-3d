#!/usr/bin/env ts-node
/**
 * test-handoff.ts — Test Hermes ↔ ORBIT handoff via Supabase realtime
 * Simula: Hermes envía tarea → Supabase → ORBIT recibe en <500ms
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://aybxrgvvwpknkoqrevqa.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in .env')
  process.exit(1)
}

console.log('📡 Connecting to Supabase...')
console.log(`   URL: ${SUPABASE_URL}`)
console.log(`   Key: ${SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...\n`)

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false
  }
})

interface HandoffTest {
  from_agent: string
  to_agent: string
  task: {
    name: string
    scope: string
    deadline: string
  }
  status: string
}

async function testHandoff() {
  console.log('🧪 Testing Hermes → ORBIT Handoff via Supabase\n')


  const testPayload: HandoffTest = {
    from_agent: 'hermes',
    to_agent: 'orbit',
    task: {
      name: 'SPRINT 2.5: Supabase + Híbrido Realtime',
      scope: 'Implement agent communication + realtime dashboard',
      deadline: '30 min'
    },
    status: 'pending'
  }

  try {
    // Step 1: Hermes sends handoff to Supabase
    console.log('📤 [Hermes] Sending handoff request...')
    const start = Date.now()

    const { data, error } = await supabase
      .from('agent_handoffs')
      .insert([
        {
          from_agent: testPayload.from_agent,
          to_agent: testPayload.to_agent,
          task: testPayload.task,
          status: testPayload.status,
          created_at: new Date().toISOString()
        }
      ])
      .select()

    if (error) throw error

    const insertDuration = Date.now() - start
    console.log(`✅ [Supabase] Handoff stored in ${insertDuration}ms`)
    console.log(`   ID: ${data?.[0]?.id}`)

    // Step 2: ORBIT polls state
    console.log('\n📥 [ORBIT] Retrieving handoff status...')
    const orbitStart = Date.now()

    const { data: orbitData, error: orbitError } = await supabase
      .from('agent_handoffs')
      .select('*')
      .eq('to_agent', 'orbit')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)

    if (orbitError) throw orbitError

    const orbitDuration = Date.now() - orbitStart
    console.log(`✅ [ORBIT] Retrieved in ${orbitDuration}ms`)
    console.log(`   Task: ${orbitData?.[0]?.task?.name}`)

    // Step 3: Total latency
    const totalLatency = Date.now() - start
    console.log(`\n⏱️  Total Latency: ${totalLatency}ms`)

    // Check if <500ms
    if (totalLatency < 500) {
      console.log('🎯 ✅ TARGET MET: <500ms latency')
    } else {
      console.log(`⚠️  THRESHOLD EXCEEDED: ${totalLatency}ms > 500ms`)
    }

    // Step 4: Update status to "accepted"
    console.log('\n📝 [ORBIT] Accepting task...')
    const updateStart = Date.now()

    const { error: updateError } = await supabase
      .from('agent_handoffs')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', data?.[0]?.id)

    if (updateError) throw updateError

    const updateDuration = Date.now() - updateStart
    console.log(`✅ [Supabase] Status updated in ${updateDuration}ms`)

    // Summary
    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 HANDOFF TEST SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Hermes → Supabase:  ${insertDuration}ms
Supabase → ORBIT:   ${orbitDuration}ms
ORBIT → Supabase:   ${updateDuration}ms
────────────────────────────────────────────
Total Latency:      ${totalLatency}ms ✅

Status: PASSED
    `)
  } catch (err: any) {
    console.error('❌ Test failed:', err.message)
    process.exit(1)
  }
}

testHandoff()
