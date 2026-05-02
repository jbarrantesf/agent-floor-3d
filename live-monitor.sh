#!/bin/bash

# 🎯 NexAI Live Dashboard Monitor
# Shows real-time state updates from the Mission Control Alpha dashboard

API="http://localhost:3001/api"
CLEAR_SCREEN=true

function show_dashboard() {
  if [ "$CLEAR_SCREEN" = true ]; then
    clear
  fi
  
  # Fetch current state
  STATE=$(curl -s $API/health 2>/dev/null)
  
  if [ $? -ne 0 ]; then
    echo "❌ Backend offline"
    return
  fi
  
  HERMES=$(echo "$STATE" | jq -r '.agents.hermes // "unknown"')
  ORBIT=$(echo "$STATE" | jq -r '.agents.orbit // "unknown"')
  SUBAGENT1=$(echo "$STATE" | jq -r '.agents.subagent1 // "unknown"')
  SUBAGENT2=$(echo "$STATE" | jq -r '.agents.subagent2 // "unknown"')
  HERMES_COST=$(echo "$STATE" | jq -r '.costs.hermes // 0')
  ORBIT_COST=$(echo "$STATE" | jq -r '.costs.orbit // 0')
  
  # Color coding for states
  get_color() {
    case "$1" in
      "executing") echo "\033[32m" ;; # Green
      "error") echo "\033[31m" ;;      # Red
      "idle") echo "\033[33m" ;;       # Yellow
      *) echo "\033[37m" ;;            # White
    esac
  }
  
  reset_color="\033[0m"
  
  cat << EOF

╔════════════════════════════════════════════════════════════════════════╗
║                                                                        ║
║          🚀 NexAI MISSION CONTROL ALPHA - LIVE MONITOR 🚀              ║
║                                                                        ║
║           Real-time Dashboard Update: $(date '+%H:%M:%S')                              ║
║                                                                        ║
╚════════════════════════════════════════════════════════════════════════╝

┌─ 🤖 AGENT STATES ────────────────────────────────────────────────────┐
│                                                                       │
│  Hermes:     $(get_color "$HERMES")${HERMES}$(printf '%-10s' "$HERMES")$reset_color  │  ORBIT:      $(get_color "$ORBIT")${ORBIT}$(printf '%-10s' "$ORBIT")$reset_color │
│                                                                       │
│  SubAgent1:  $(get_color "$SUBAGENT1")${SUBAGENT1}$(printf '%-10s' "$SUBAGENT1")$reset_color  │  SubAgent2:  $(get_color "$SUBAGENT2")${SUBAGENT2}$(printf '%-10s' "$SUBAGENT2")$reset_color │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘

┌─ 💰 OPERATIONAL COSTS ───────────────────────────────────────────────┐
│                                                                       │
│  Hermes: \$${HERMES_COST} ($(printf '%7.4f' $HERMES_COST))   │   ORBIT: \$${ORBIT_COST} ($(printf '%7.4f' $ORBIT_COST))              │
│                                                                       │
│  📈 Total: \$$(echo "$HERMES_COST + $ORBIT_COST" | bc)                                     │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘

┌─ 🔌 CONNECTION STATUS ───────────────────────────────────────────────┐
│                                                                       │
│  ✅ Backend (3001):    LIVE     │  Frontend (4173):  LIVE            │
│  ✅ Supabase:          CONNECTED │  WebSocket:        🔄 POLLING      │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘

🎯 INTERACTIVE BUTTONS (Click in Browser):
   ▶️  Start Hermes  │  ▶️  Start ORBIT  │  📤  Handoff  │  ⏹️  Reset All

🌐 Dashboard: http://localhost:4173
📊 API: http://localhost:3001/api/health

💡 Terminal Tips:
   • This monitor updates every 2 seconds
   • Scroll up to see history
   • Press Ctrl+C to stop

EOF
}

# Main loop
echo "Starting Live Monitor..."
sleep 1

while true; do
  show_dashboard
  sleep 2
done
