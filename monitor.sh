#!/bin/bash

# 🎯 NexAI Dashboard Monitor - Real-time test from CLI
# Este script te permite ver el estado del dashboard sin necesidad de abrir el navegador

API="http://localhost:3001/api"
DASHBOARD_URL="http://localhost:4173"

clear

cat << 'EOF'
╔════════════════════════════════════════════════════════════════╗
║     🚀 NexAI Mission Control Alpha - Dashboard Monitor         ║
║                                                                ║
║     🌐 Browser: http://localhost:4173                          ║
║     🔌 Backend: http://localhost:3001                          ║
╚════════════════════════════════════════════════════════════════╝

EOF

# Function to get current state
show_state() {
  clear
  
  echo "╔════════════════════════════════════════════════════════════════╗"
  echo "║                    📊 LIVE DASHBOARD STATE                     ║"
  echo "║                  $(date '+%Y-%m-%d %H:%M:%S')                         ║"
  echo "╚════════════════════════════════════════════════════════════════╝"
  echo ""
  
  # Get health data
  HEALTH=$(curl -s $API/health 2>/dev/null)
  
  # Parse data
  HERMES_STATE=$(echo $HEALTH | jq -r '.agents.hermes' 2>/dev/null || echo "error")
  ORBIT_STATE=$(echo $HEALTH | jq -r '.agents.orbit' 2>/dev/null || echo "error")
  SUBAGENT1=$(echo $HEALTH | jq -r '.agents.subagent1' 2>/dev/null || echo "error")
  SUBAGENT2=$(echo $HEALTH | jq -r '.agents.subagent2' 2>/dev/null || echo "error")
  
  HERMES_COST=$(echo $HEALTH | jq -r '.costs.hermes' 2>/dev/null || echo "0")
  ORBIT_COST=$(echo $HEALTH | jq -r '.costs.orbit' 2>/dev/null || echo "0")
  
  # Display as dashboard
  echo "┌─ 🤖 AGENT STATES ─────────────────────────────────────────┐"
  echo "│                                                             │"
  printf "│  Hermes:    %-15s  ORBIT:      %-15s  │\n" "$HERMES_STATE" "$ORBIT_STATE"
  printf "│  SubAgent1: %-15s  SubAgent2:  %-15s  │\n" "$SUBAGENT1" "$SUBAGENT2"
  echo "│                                                             │"
  echo "└─────────────────────────────────────────────────────────────┘"
  echo ""
  
  echo "┌─ 💰 OPERATIONAL COSTS ────────────────────────────────────┐"
  echo "│                                                             │"
  printf "│  Hermes:  \$%-10s | ORBIT:  \$%-10s             │\n" "$HERMES_COST" "$ORBIT_COST"
  echo "│                                                             │"
  echo "└─────────────────────────────────────────────────────────────┘"
  echo ""
  
  echo "🔌 CONNECTION STATUS:"
  FE=$(curl -s -o /dev/null -w "%{http_code}" $DASHBOARD_URL 2>/dev/null)
  BE=$(curl -s -o /dev/null -w "%{http_code}" $API/health 2>/dev/null)
  
  [ "$FE" = "200" ] && echo "  ✅ Frontend (4173): LIVE" || echo "  ❌ Frontend (4173): DOWN"
  [ "$BE" = "200" ] && echo "  ✅ Backend (3001):  LIVE" || echo "  ❌ Backend (3001):  DOWN"
  
  echo ""
  echo "Press Ctrl+C to exit | Press 'r' for latest data"
}

# Show initial state
show_state

# Loop for real-time updates
while true; do
  read -t 5 -p "🔄 Updating in 5s... (Ctrl+C to exit, 'r' to refresh now): " input
  if [ "$input" = "r" ]; then
    show_state
  fi
done
