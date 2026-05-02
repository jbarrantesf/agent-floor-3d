# ✅ PHASE 1 DEPLOYMENT - SQL READY

**Status:** ✅ SQL schema file created and saved  
**Location:** `supabase/migrations/20260502_phase1_schema.sql`  
**Size:** 231 lines, 9.5 KB  
**Ready for:** Immediate deployment to Supabase

---

## 🚀 QUICKEST DEPLOYMENT (2 minutes)

### Step 1: Open Supabase SQL Editor
```
https://app.supabase.com/project/aybxrgvvwpknkoqrevqa/sql/new
```

### Step 2: Copy SQL
Option A: Copy from `supabase/migrations/20260502_phase1_schema.sql`

Option B: Copy-paste here:
```sql
[See supabase/migrations/20260502_phase1_schema.sql]
```

### Step 3: Paste & Run
1. Paste all SQL into editor
2. Click "Run" (blue button top-right)
3. Wait 30-60 seconds

### Step 4: Verify
Run this query in editor:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('tasks', 'task_events', 'agent_capacity', 'cost_daily_summary')
ORDER BY table_name;
```

Expected output: 4 rows ✅

---

## 📋 What Gets Deployed

✅ **4 Tables**
- `tasks` — Task queue (QUEUED, EXECUTING, COMPLETED, FAILED, TIMEOUT)
- `task_events` — Audit trail (all state changes)
- `agent_capacity` — Agent limits & health
- `cost_daily_summary` — Daily cost aggregation

✅ **10+ Indexes**
- Performance optimization for queries

✅ **3 PL/pgSQL Functions**
- `update_task_status()` — Atomically update task + create event
- `get_pending_tasks_for_agent()` — Fetch next tasks for agent
- `update_agent_load()` — Track agent concurrent load

✅ **2 Triggers**
- Auto-update `updated_at` on task changes
- Auto-log task creation as event

✅ **5 RLS Policies**
- Agent visibility & access control
- Hermes has admin access

✅ **Seed Data**
- 4 agents initialized: hermes, orbit, subagent_1, subagent_2

✅ **Realtime Subscriptions**
- REPLICA IDENTITY FULL on tasks, task_events, agent_capacity

---

## ⏱️ Timeline

- **Execution time:** 30-60 seconds
- **Cost:** $0 (schema-only, no compute)
- **Breaking changes:** None (uses `CREATE IF NOT EXISTS` / `CREATE OR REPLACE`)
- **Rollback:** Can drop tables anytime

---

## 🔐 Security

✅ RLS policies enforce agent isolation  
✅ SERVICE_ROLE_KEY only for backend  
✅ ANON_KEY sufficient for agent operations (RLS enforced)  
✅ Cost summary restricted to Hermes only  

---

## ✅ Success Indicators

After running, you should see:

```
Query executed
4 rows affected
Tables created:
  - agent_capacity
  - cost_daily_summary
  - task_events
  - tasks
```

---

## 📞 If Something Goes Wrong

| Error | Cause | Solution |
|-------|-------|----------|
| "Table already exists" | Re-run (idempotent) | Normal - will skip |
| "Permission denied" | postgres user lacks perms | Use web editor (auto-authenticated) |
| "function does not exist" | First-time creation | Normal - will create |
| Nothing happens | SQL not pasted | Copy entire file, paste all, click Run |

---

## ✅ After Deployment

1. **Verify** with query above
2. **Message ORBIT:** "Phase 1 SQL deployed ✅"
3. **Start Phase 2:** Hermes TaskManager implementation

---

**Ready?** → Open editor link → Copy → Paste → Run 🚀
