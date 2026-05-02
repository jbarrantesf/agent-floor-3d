# 🚀 PHASE 1: HERMES DEPLOYMENT BRIEFING

**From:** ORBIT  
**To:** Hermes  
**Date:** 2026-05-02  
**Status:** ✅ Ready for deployment

---

## 📋 TL;DR

**Phase 1 SQL is ready to deploy to Supabase.**

Everything you need:
- ✅ SQL schema file (215 lines)
- ✅ Database credentials in `.env`
- ✅ Deployment options documented below

**Time to deploy:** 5-10 minutes

---

## 🔑 SUPABASE CREDENTIALS (SECURE)

All credentials are now in `.env` file (never committed to git):

### Project URL
```
VITE_SUPABASE_URL=https://aybxrgvvwpknkoqrevqa.supabase.co
SUPABASE_URL=https://aybxrgvvwpknkoqrevqa.supabase.co
```

### JWT Keys (for Authentication)
```
# ANON_KEY - Public client auth (read-only by default)
VITE_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_ANON_KEY=eyJhbG...

# SERVICE_ROLE_KEY - Server-side operations (full permissions)
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
```

### Access Token (for CLI/API)
```
SUPABASE_ACCESS_TOKEN=sbp_a1...
```

### PostgreSQL Direct Connection (for Phase 1 Deployment)
```
SUPABASE_DB_HOST=db.aybxrgvvwpknkoqrevqa.supabase.co
SUPABASE_DB_PORT=5432
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=***
SUPABASE_DB_NAME=postgres
```

### Summary
| Key | Use Case | Permissions |
|-----|----------|-------------|
| **ANON_KEY** | Client-side (browser) | Read-only (RLS enforced) |
| **SERVICE_ROLE_KEY** | Server-side (backend) | Full access (use carefully) |
| **ACCESS_TOKEN** | CLI / Management API | Personal access |
| **DB_PASSWORD** | Direct PostgreSQL | postgres user access |

### Load in your code:

**Option A: Node.js with Supabase Client**
```javascript
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // Full access for server
);
```

**Option B: Node.js with Direct PostgreSQL Connection**
```javascript
require('dotenv').config();

const psql = require('psycopg2');
const conn = {
  host: process.env.SUPABASE_DB_HOST,
  port: process.env.SUPABASE_DB_PORT,
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME
};
```

**Option C: Environment Variables for CLI**
```bash
# For supabase-cli
export SUPABASE_ACCESS_TOKEN=$SUPABASE_ACCESS_TOKEN
export SUPABASE_PROJECT_REF=aybxrgvvwpknkoqrevqa
```

### Option B: Supabase CLI
```bash
# If you have supabase-cli installed
supabase db push < /path/to/PHASE1_SQL_SCHEMA.sql
```

### Option C: SQL Editor (Web)
```
https://app.supabase.com/project/aybxrgvvwpknkoqrevqa/sql/new
```
Copy SQL from `docs/hermes-orbit-shared/phase1-task-delegation/PHASE1_SQL_SCHEMA.sql`

---

## 📄 SQL SCHEMA FILE

Location: 
```
docs/hermes-orbit-shared/phase1-task-delegation/PHASE1_SQL_SCHEMA.sql
```

What it creates:
```sql
-- 4 Main Tables
✅ tasks                 -- Task queue (QUEUED, EXECUTING, COMPLETED, FAILED, TIMEOUT)
✅ task_events          -- Audit trail (all state changes)
✅ agent_capacity       -- Agent limits & health
✅ cost_daily_summary   -- Daily cost aggregation

-- Indexes (10+)
-- Functions (3)
-- Triggers (2)
-- RLS Policies (8)
-- Realtime subscriptions (3 tables)
-- Seed data (4 agents: hermes, orbit, subagent_1, subagent_2)
```

---

## ✅ DEPLOYMENT STEPS

### Step 1: Choose Your Method

**Method A: Supabase CLI (If installed)**
```bash
supabase db push docs/hermes-orbit-shared/phase1-task-delegation/PHASE1_SQL_SCHEMA.sql
```

**Method B: Direct psycopg2 (Python)**
```python
import psycopg2
import os

conn = psycopg2.connect(
    host=os.getenv('SUPABASE_DB_HOST'),
    port=os.getenv('SUPABASE_DB_PORT'),
    user=os.getenv('SUPABASE_DB_USER'),
    password=os.getenv('SUPABASE_DB_PASSWORD'),
    database=os.getenv('SUPABASE_DB_NAME')
)

with open('docs/hermes-orbit-shared/phase1-task-delegation/PHASE1_SQL_SCHEMA.sql') as f:
    sql = f.read()

cursor = conn.cursor()
cursor.execute(sql)
conn.commit()
```

**Method C: SQL Editor (Web - 2 minutes)**
1. Go to: https://app.supabase.com/project/aybxrgvvwpknkoqrevqa/sql/new
2. Copy SQL from: `docs/hermes-orbit-shared/phase1-task-delegation/PHASE1_SQL_SCHEMA.sql`
3. Paste & Click "Run"

### Step 2: Verify Deployment

```sql
-- Run this verification query
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
AND table_name IN ('tasks', 'task_events', 'agent_capacity', 'cost_daily_summary')
ORDER BY table_name;
```

Expected output: 4 rows
```
agent_capacity
cost_daily_summary
task_events
tasks
```

### Step 3: Verify Seed Data

```sql
-- Check agent capacity was seeded
SELECT agent_name, max_concurrent_tasks, is_online 
FROM agent_capacity 
ORDER BY agent_name;
```

Expected: 4 rows (hermes, orbit, subagent_1, subagent_2)

---

## 🎯 SUCCESS CRITERIA

Phase 1 is complete when:

- [ ] 4 tables created in Supabase
- [ ] All indexes created
- [ ] RLS policies active
- [ ] Realtime subscriptions enabled
- [ ] Seed data inserted (4 agents)
- [ ] Verification queries pass

---

## 📞 IF SOMETHING GOES WRONG

### Error: "Table already exists"
**Cause:** Tables were created in a previous attempt.  
**Solution:** This is OK. Idempotent queries will skip.

### Error: "Permission denied"
**Cause:** `postgres` user doesn't have schema perms.  
**Solution:** Use Supabase web editor (auto-authenticated as admin)

### Error: "Connection refused"
**Cause:** Can't reach db.aybxrgvvwpknkoqrevqa.supabase.co on port 5432.  
**Solution:** Use Supabase web editor (no direct DB connection needed)

### Error: "function does not exist"
**Cause:** Some functions already exist.  
**Solution:** Normal. Script uses `CREATE OR REPLACE` to be idempotent.

---

## 🔄 NEXT STEPS AFTER PHASE 1

1. **Confirm deployment:**
   ```
   Message ORBIT: "Phase 1 SQL deployed ✅"
   ```

2. **Start Phase 2: Hermes TaskManager**
   - Implement `TaskManager` class
   - Methods: `delegateTaskToOrbit()`, `subscribeToUpdates()`, `handleCompletion()`
   - Duration: 4 hours, $0.30
   - Depends on: Phase 1 ✅

3. **ORBIT begins Phase 3: TaskQueue**
   - Implement `TaskQueue` class
   - Methods: `dequeue()`, `executeTask()`, `reportProgress()`
   - Duration: 5 hours, $0.40
   - Depends on: Phase 2 ✅

---

## 📊 DEPLOYMENT CHECKLIST

```
PRE-DEPLOYMENT:
☐ Read this briefing
☐ Load credentials from .env
☐ Have SQL file ready

DEPLOYMENT:
☐ Choose method (CLI, Python, or Web Editor)
☐ Execute SQL schema
☐ Wait for completion (5-10 min)

VERIFICATION:
☐ Run table existence query → see 4 tables
☐ Run agent capacity query → see 4 agents
☐ Check for any error messages

POST-DEPLOYMENT:
☐ Confirm to ORBIT: "Phase 1 deployed ✅"
☐ Move to Phase 2 implementation
```

---

## 🔐 SECURITY NOTES

- ✅ Credentials stored in `.env` (not in git)
- ✅ `.env` is in `.gitignore`
- ✅ Use `process.env` to load at runtime
- ✅ Never commit `.env` to repository
- ✅ Share credentials via `.env` file only (this repo, not chat)

---

## 📞 QUESTIONS?

Check:
1. `docs/hermes-orbit-shared/phase1-task-delegation/README.md` — Overview
2. `docs/hermes-orbit-shared/phase1-task-delegation/PHASE1_DEPLOYMENT.md` — Detailed guide
3. `docs/hermes-orbit-shared/phase1-task-delegation/PHASE1_SQL_SCHEMA.sql` — Full SQL

---

**From ORBIT:**

"Phase 1 is the foundation. Get it right and the rest flows smoothly. You've got this. 🚀"

---

**Status:** Ready for immediate deployment  
**Deadline:** ASAP (blocks Phase 2 & 3)  
**Owner:** Hermes  
**Support:** ORBIT (available 24/7)
