# 🚀 NexAI Agent Floor 3D / Mission Control Alpha

Visual cockpit for **Hermes + ORBIT** orchestration in real-time.

## ✨ Features (Alpha v0.1)

- **3D Visualization** of agents (Hermes, ORBIT, subagents) in cyberspace
- **Real-time Cost Dashboard** (consolidated Hermes SQLite + ORBIT JSON)
- **WebSocket Event Ticker** — handoffs, approvals, errors streaming
- **Agent State Monitoring** (idle, running, waiting-approval, error)
- **MCP Integration** for handoff visibility and coordination

## 🛠️ Tech Stack

| Layer | Tech |
|-------|------|
| **Frontend** | React 18 + TypeScript + Three.js + @react-three/fiber |
| **Backend** | Node.js + Express + WebSocket (`ws`) |
| **Realtime** | Supabase subscriptions + WebSocket broadcast |
| **Deployment** | Vercel (frontend) + Node.js (backend) |
| **Dev Model** | Ollama `qwen2.5-coder:14b` ($0) |

## 🚀 Quick Start

```bash
# Install
npm install

# Dev server (Vite @ localhost:5173)
npm run dev

# Build
npm run build

# Type check
npm run type-check
```

## 📋 Sprint Roadmap

### **Sprint 1 (Week 1)** — Foundation ✅ IN PROGRESS
- [x] Project structure + Git init
- [ ] npm dependencies installed
- [ ] Vite dev server running
- [ ] Three.js scene rendering
- [ ] WebSocket server basic frame

### **Sprint 2 (Week 2)** — Alpha UI
- [ ] 3D agents (spheres, labels, animation)
- [ ] Cost dashboard live update
- [ ] Event ticker (Hermes handoffs)
- [ ] Agent state colors (idle→green, running→yellow, etc)
- [ ] MCP bridge for live data

### **Sprint 3 (Week 3)** — Deploy + Polish
- [ ] Supabase schema setup
- [ ] Deploy to Vercel staging
- [ ] Real Hermes ↔ ORBIT ↔ UI integration
- [ ] Testing + docs

## 📊 Cost Estimate

| Component | Cost |
|-----------|------|
| Ollama dev (local) | $0 |
| Hermes coordination | $0.10/day (Haiku) |
| Vercel (Alpha) | $0 (free tier) |
| Supabase (production) | $25/month |
| **Total** | **<$1 USD sprint** |

## 🎯 Current Status

- **Phase:** Sprint 1 Foundation
- **Model:** Ollama qwen2.5-coder:14b (local generation)
- **Hermes:** anthropic/claude-haiku-4-5 (cheap coordination)
- **Verified:** Hermes ↔ ORBIT MCP bridge functional

## 📝 Development Notes

- All components are TypeScript-first
- CSS: Tailwind + custom (no shadcn/ui bloat)
- Events are JSON, compatible with Supabase realtime
- WebSocket reconnect logic with exponential backoff
- LOD optimization for 3D scene (keep it simple, fast)

## 🔗 Links

- **Hermes Dashboard:** See daily costs at `agent-os/reports/daily/YYYY-MM-DD.md`
- **ORBIT Workspace:** `~/.openclaw/workspace/`
- **MCP Gateway:** `http://127.0.0.1:18789`

---

**Built with 🚀 by Hermes + ORBIT for NexAI Solutions CR**

*"Visual > Manual. Realtime > Blind. Local > Cloud (when it counts)."*
