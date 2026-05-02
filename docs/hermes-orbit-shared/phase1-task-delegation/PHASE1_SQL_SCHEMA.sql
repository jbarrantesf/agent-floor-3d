-- ============================================================================
-- PHASE 1: DATABASE SETUP — Task Delegation Architecture
-- ============================================================================
-- José's Configuration:
-- - ORBIT: Full executor (Git, terminal, Vercel)
-- - Subagents: Always delegated by ORBIT
-- - Timeout: 5 minutes
-- - Queue: Priority-based
-- - Alerts: Telegram webhook
-- ============================================================================

-- ============================================================================
-- TABLE 1: tasks — Main task queue
-- ============================================================================
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Task definition
  goal TEXT NOT NULL,
  context TEXT,
  priority VARCHAR(10) DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
  
  -- Assignment
  assigned_to VARCHAR(30) NOT NULL DEFAULT 'orbit', -- 'hermes' | 'orbit' | 'subagent_*'
  status VARCHAR(30) DEFAULT 'QUEUED' CHECK (status IN (
    'QUEUED', 'EXECUTING', 'COMPLETED', 'FAILED', 
    'TIMEOUT', 'BACKPRESSURE', 'PENDING_ORBIT_RECOVERY'
  )),
  
  -- Progress
  progress_percent INT DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  current_step TEXT,
  
  -- Costs (in USD)
  estimated_cost DECIMAL(10, 6) DEFAULT 0,
  actual_cost DECIMAL(10, 6) DEFAULT 0,
  
  -- Timing
  deadline_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Results
  result JSONB DEFAULT '{}'::JSONB,
  error_message TEXT,
  
  -- Retries
  retry_count INT DEFAULT 0 CHECK (retry_count >= 0),
  max_retries INT DEFAULT 3 CHECK (max_retries >= 0),
  
  -- Relationships
  parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  created_by VARCHAR(30) DEFAULT 'hermes',
  
  -- Metadata
  toolsets TEXT[] DEFAULT ARRAY[]::TEXT[],
  metadata JSONB DEFAULT '{}'::JSONB,
  
  -- Indexes
  CONSTRAINT valid_times CHECK (started_at IS NULL OR completed_at IS NULL OR completed_at >= started_at)
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_status ON tasks(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority DESC) WHERE status = 'QUEUED';
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_tasks_updated_at ON tasks;
CREATE TRIGGER trigger_tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_tasks_updated_at();

-- ============================================================================
-- TABLE 2: task_events — Audit trail & event log
-- ============================================================================
CREATE TABLE IF NOT EXISTS task_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- DELEGATED, STARTED, PROGRESS, COMPLETED, FAILED, TIMEOUT, RETRY
  
  agent_from VARCHAR(30),
  agent_to VARCHAR(30),
  
  -- Metrics snapshot
  metrics JSONB DEFAULT '{}'::JSONB, -- {tokensUsed, costAccrued, percent, timeRemaining, duration}
  
  -- Full event payload
  payload JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS idx_task_events_task_id ON task_events(task_id);
CREATE INDEX IF NOT EXISTS idx_task_events_created_at ON task_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_events_type ON task_events(event_type);

-- ============================================================================
-- TABLE 3: agent_capacity — Agent limits & health
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_capacity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  agent_name VARCHAR(30) UNIQUE NOT NULL, -- 'hermes', 'orbit', 'subagent_1', etc
  
  -- Capacity
  max_concurrent_tasks INT DEFAULT 5 CHECK (max_concurrent_tasks > 0),
  current_tasks INT DEFAULT 0 CHECK (current_tasks >= 0),
  
  -- Performance metrics
  avg_task_duration_ms INT DEFAULT 0,
  avg_tokens_per_task INT DEFAULT 0,
  avg_cost_per_task DECIMAL(10, 6) DEFAULT 0,
  
  -- Reliability
  reliability_score DECIMAL(3, 2) DEFAULT 1.0 CHECK (reliability_score >= 0 AND reliability_score <= 1),
  failed_tasks INT DEFAULT 0,
  total_tasks INT DEFAULT 0,
  
  -- Health
  last_heartbeat TIMESTAMP WITH TIME ZONE,
  is_online BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS idx_agent_capacity_name ON agent_capacity(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_capacity_online ON agent_capacity(is_online);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_agent_capacity_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_agent_capacity_updated_at ON agent_capacity;
CREATE TRIGGER trigger_agent_capacity_updated_at BEFORE UPDATE ON agent_capacity
  FOR EACH ROW EXECUTE FUNCTION update_agent_capacity_updated_at();

-- ============================================================================
-- TABLE 4: cost_daily_summary — Daily cost aggregation (for reporting)
-- ============================================================================
CREATE TABLE IF NOT EXISTS cost_daily_summary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  date DATE NOT NULL,
  agent_name VARCHAR(30) NOT NULL,
  
  total_cost DECIMAL(10, 6) DEFAULT 0,
  total_tokens INT DEFAULT 0,
  task_count INT DEFAULT 0,
  failed_task_count INT DEFAULT 0,
  
  UNIQUE(date, agent_name)
);

CREATE INDEX IF NOT EXISTS idx_cost_daily_summary_date ON cost_daily_summary(date DESC);
CREATE INDEX IF NOT EXISTS idx_cost_daily_summary_agent ON cost_daily_summary(agent_name);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_capacity ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_daily_summary ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can read all tables
CREATE POLICY "authenticated_read" ON tasks FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated_read" ON task_events FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated_read" ON agent_capacity FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated_read" ON cost_daily_summary FOR SELECT USING (auth.role() = 'authenticated');

-- Policy: All authenticated users can insert/update tasks
CREATE POLICY "authenticated_write" ON tasks FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "authenticated_write" ON tasks FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated_write" ON task_events FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "authenticated_write" ON agent_capacity FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "authenticated_write" ON agent_capacity FOR UPDATE USING (auth.role() = 'authenticated');

-- ============================================================================
-- ENABLE REALTIME (for WebSocket subscriptions)
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE task_events;
ALTER PUBLICATION supabase_realtime ADD TABLE agent_capacity;

-- ============================================================================
-- SEED DATA: Initialize agent capacity records
-- ============================================================================
INSERT INTO agent_capacity (agent_name, max_concurrent_tasks, current_tasks, is_online)
VALUES 
  ('hermes', 10, 0, TRUE),
  ('orbit', 5, 0, TRUE),
  ('subagent_1', 3, 0, FALSE),
  ('subagent_2', 3, 0, FALSE)
ON CONFLICT (agent_name) DO NOTHING;

-- ============================================================================
-- VIEWS: Useful queries
-- ============================================================================

-- View: Active tasks per agent
CREATE OR REPLACE VIEW v_active_tasks_by_agent AS
SELECT 
  assigned_to,
  status,
  COUNT(*) as count,
  AVG(progress_percent) as avg_progress,
  SUM(actual_cost) as total_cost
FROM tasks
WHERE status IN ('QUEUED', 'EXECUTING')
GROUP BY assigned_to, status
ORDER BY assigned_to, status;

-- View: Task completion stats (last 24 hours)
CREATE OR REPLACE VIEW v_task_stats_24h AS
SELECT 
  assigned_to,
  COUNT(*) as total_tasks,
  COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed,
  COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed,
  COUNT(CASE WHEN status = 'TIMEOUT' THEN 1 END) as timeout,
  AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_sec,
  SUM(actual_cost) as total_cost
FROM tasks
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY assigned_to;

-- View: Cost tracking per agent (cumulative)
CREATE OR REPLACE VIEW v_cost_by_agent AS
SELECT 
  assigned_to,
  COUNT(*) as task_count,
  SUM(actual_cost) as total_cost,
  AVG(actual_cost) as avg_cost_per_task,
  MAX(completed_at) as last_task_completed
FROM tasks
WHERE status = 'COMPLETED'
GROUP BY assigned_to
ORDER BY total_cost DESC;

-- ============================================================================
-- FUNCTIONS: Helpers
-- ============================================================================

-- Function: Get queue status for an agent
CREATE OR REPLACE FUNCTION get_agent_queue_status(p_agent_name VARCHAR)
RETURNS TABLE (
  agent_name VARCHAR,
  max_concurrent INT,
  current_tasks INT,
  available_slots INT,
  queue_high INT,
  queue_medium INT,
  queue_low INT,
  executing INT
) AS $$
SELECT 
  ac.agent_name,
  ac.max_concurrent_tasks,
  ac.current_tasks,
  ac.max_concurrent_tasks - ac.current_tasks,
  (SELECT COUNT(*) FROM tasks WHERE assigned_to = p_agent_name AND status = 'QUEUED' AND priority = 'HIGH'),
  (SELECT COUNT(*) FROM tasks WHERE assigned_to = p_agent_name AND status = 'QUEUED' AND priority = 'MEDIUM'),
  (SELECT COUNT(*) FROM tasks WHERE assigned_to = p_agent_name AND status = 'QUEUED' AND priority = 'LOW'),
  (SELECT COUNT(*) FROM tasks WHERE assigned_to = p_agent_name AND status = 'EXECUTING')
FROM agent_capacity ac
WHERE ac.agent_name = p_agent_name;
$$ LANGUAGE SQL;

-- Function: Mark task as timed out
CREATE OR REPLACE FUNCTION mark_task_timeout(p_task_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE tasks SET status = 'TIMEOUT', completed_at = NOW() WHERE id = p_task_id;
  INSERT INTO task_events (task_id, event_type, agent_from, payload)
  VALUES (p_task_id, 'TIMEOUT', (SELECT assigned_to FROM tasks WHERE id = p_task_id), 
          jsonb_build_object('timeout_at', NOW()));
END;
$$ LANGUAGE plpgsql;

-- Function: Get task with full event history
CREATE OR REPLACE FUNCTION get_task_with_history(p_task_id UUID)
RETURNS TABLE (
  task_id UUID,
  goal TEXT,
  status VARCHAR,
  progress_percent INT,
  actual_cost DECIMAL,
  events JSONB
) AS $$
SELECT 
  t.id,
  t.goal,
  t.status,
  t.progress_percent,
  t.actual_cost,
  jsonb_agg(
    jsonb_build_object(
      'event_type', te.event_type,
      'created_at', te.created_at,
      'metrics', te.metrics
    )
  ) as events
FROM tasks t
LEFT JOIN task_events te ON t.id = te.task_id
WHERE t.id = p_task_id
GROUP BY t.id, t.goal, t.status, t.progress_percent, t.actual_cost;
$$ LANGUAGE SQL;

-- ============================================================================
-- DONE: Schema created successfully
-- ============================================================================
-- Next steps:
-- 1. Verify all tables created: SELECT * FROM information_schema.tables WHERE schema = 'public'
-- 2. Test RLS: Verify policies are active
-- 3. Verify realtime: Check publication status
-- 4. Insert test data
-- 5. Test queries
