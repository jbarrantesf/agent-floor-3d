-- SPRINT 2.5: Supabase schema for bilateral Hermes ↔ ORBIT communication
-- Project: https://aybxrgvvwpknkoqrevqa.supabase.co

-- 1. agent_handoffs: Track handoff requests between agents
CREATE TABLE IF NOT EXISTS agent_handoffs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_agent TEXT NOT NULL,
  to_agent TEXT NOT NULL,
  task JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, executing, completed, failed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. agent_events: Central event log for bilateral communication
CREATE TABLE IF NOT EXISTS agent_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent TEXT NOT NULL,
  event_type TEXT NOT NULL, -- handoff, approval, sync, error, complete, etc.
  payload JSONB NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. agent_state: Current state and costs for each agent
CREATE TABLE IF NOT EXISTS agent_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent TEXT NOT NULL UNIQUE,
  state JSONB NOT NULL, -- { status: 'idle'|'running'|'error', ... }
  costs JSONB NOT NULL, -- { total: number, session: number }
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable realtime subscriptions on all 3 tables
ALTER TABLE agent_handoffs REPLICA IDENTITY FULL;
ALTER TABLE agent_events REPLICA IDENTITY FULL;
ALTER TABLE agent_state REPLICA IDENTITY FULL;

-- Create realtime publication if not exists
CREATE PUBLICATION IF NOT EXISTS supabase_realtime FOR TABLE agent_handoffs, agent_events, agent_state;

-- 4. RLS Policies: Hermes access
-- Hermes can read/write agent_handoffs
CREATE POLICY "hermes_read_handoffs" ON agent_handoffs
  FOR SELECT USING (auth.uid()::text = 'hermes' OR from_agent = 'hermes' OR to_agent = 'hermes');

CREATE POLICY "hermes_write_handoffs" ON agent_handoffs
  FOR INSERT WITH CHECK (from_agent = 'hermes' OR to_agent = 'hermes');

CREATE POLICY "hermes_update_handoffs" ON agent_handoffs
  FOR UPDATE USING (from_agent = 'hermes' OR to_agent = 'hermes');

-- Hermes can read/write agent_state for itself
CREATE POLICY "hermes_read_state" ON agent_state
  FOR SELECT USING (agent = 'hermes' OR agent = 'HERMES');

CREATE POLICY "hermes_write_state" ON agent_state
  FOR INSERT WITH CHECK (agent = 'hermes' OR agent = 'HERMES');

CREATE POLICY "hermes_update_state" ON agent_state
  FOR UPDATE USING (agent = 'hermes' OR agent = 'HERMES');

-- Hermes can read agent_events
CREATE POLICY "hermes_read_events" ON agent_events
  FOR SELECT USING (true);

-- 5. RLS Policies: ORBIT access (vice versa)
-- ORBIT can read/write agent_handoffs
CREATE POLICY "orbit_read_handoffs" ON agent_handoffs
  FOR SELECT USING (true);

CREATE POLICY "orbit_write_handoffs" ON agent_handoffs
  FOR INSERT WITH CHECK (from_agent = 'orbit' OR to_agent = 'orbit');

CREATE POLICY "orbit_update_handoffs" ON agent_handoffs
  FOR UPDATE USING (from_agent = 'orbit' OR to_agent = 'orbit');

-- ORBIT can read/write agent_state for itself
CREATE POLICY "orbit_read_state" ON agent_state
  FOR SELECT USING (agent = 'orbit' OR agent = 'ORBIT');

CREATE POLICY "orbit_write_state" ON agent_state
  FOR INSERT WITH CHECK (agent = 'orbit' OR agent = 'ORBIT');

CREATE POLICY "orbit_update_state" ON agent_state
  FOR UPDATE USING (agent = 'orbit' OR agent = 'ORBIT');

-- ORBIT can read agent_events
CREATE POLICY "orbit_read_events" ON agent_events
  FOR SELECT USING (true);

-- 6. Anonymous access for local development (if needed)
CREATE POLICY "anon_read_all" ON agent_handoffs
  FOR SELECT USING (true);

CREATE POLICY "anon_read_state" ON agent_state
  FOR SELECT USING (true);

CREATE POLICY "anon_read_events" ON agent_events
  FOR SELECT USING (true);

-- Create indexes for performance
CREATE INDEX idx_handoffs_from_agent ON agent_handoffs(from_agent);
CREATE INDEX idx_handoffs_to_agent ON agent_handoffs(to_agent);
CREATE INDEX idx_handoffs_status ON agent_handoffs(status);
CREATE INDEX idx_events_agent ON agent_events(agent);
CREATE INDEX idx_events_type ON agent_events(event_type);
CREATE INDEX idx_events_timestamp ON agent_events(timestamp DESC);
CREATE INDEX idx_state_agent ON agent_state(agent);

-- Insert initial agent states
INSERT INTO agent_state (agent, state, costs) VALUES
  ('hermes', '{"status": "idle"}'::jsonb, '{"total": 0.0, "session": 0.0042}'::jsonb),
  ('orbit', '{"status": "idle"}'::jsonb, '{"total": 0.0, "session": 0.0018}'::jsonb)
ON CONFLICT (agent) DO NOTHING;
