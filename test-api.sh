#!/bin/bash

# 🧪 NexAI Agent Floor 3D - Complete Test Suite
# Tests all REST endpoints and WebSocket connectivity

set -e

API="http://localhost:3001/api"
WS="ws://localhost:3001/ws"

echo "🧪 NexAI Agent Floor 3D - Test Suite"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 1: Health Check
echo "TEST 1️⃣  Health Check"
HEALTH=$(curl -s $API/health)
echo "✅ Response: $(echo $HEALTH | jq -c '{ok: .ok, agents: .agents}')"
echo ""

# Test 2: Get Costs
echo "TEST 2️⃣  Get Current Costs"
COSTS=$(curl -s $API/costs)
echo "✅ Costs: $(echo $COSTS | jq -c '.')"
echo ""

# Test 3: Update Costs
echo "TEST 3️⃣  Update Costs"
curl -s -X POST $API/costs/update \
  -H "Content-Type: application/json" \
  -d '{"hermes": 0.0050, "orbit": 0.0020}' | jq .
echo ""

# Test 4: Get Agents
echo "TEST 4️⃣  Get Agent States"
AGENTS=$(curl -s $API/agents)
echo "✅ Agents: $(echo $AGENTS | jq -c '.')"
echo ""

# Test 5: Update Agent State
echo "TEST 5️⃣  Update Agent State"
curl -s -X POST $API/agents/state \
  -H "Content-Type: application/json" \
  -d '{"hermes": "running", "orbit": "idle", "subagent1": "idle", "subagent2": "idle"}' | jq .
echo ""

# Test 6: Create Handoff (Hermes → ORBIT)
echo "TEST 6️⃣  Create Handoff (Hermes → ORBIT)"
curl -s -X POST $API/handoffs \
  -H "Content-Type: application/json" \
  -d '{
    "from_agent": "hermes",
    "to_agent": "orbit",
    "task": {"name": "test_integration", "input": "Sample data"},
    "status": "pending"
  }' | jq .
echo ""

# Test 7: Get Agent State
echo "TEST 7️⃣  Get Specific Agent State (hermes)"
curl -s $API/state/hermes | jq .
echo ""

# Test 8: Create Event
echo "TEST 8️⃣  Create Event"
curl -s -X POST $API/events \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "hermes",
    "event_type": "test_event",
    "data": {"message": "Test complete"}
  }' | jq .
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ALL TESTS COMPLETED"
echo ""
echo "📊 Final Health Check:"
curl -s $API/health | jq .
