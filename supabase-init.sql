-- ============================================================
-- AGENT FLOOR 3D - Supabase Schema
-- Project: aybxrgvvwpknkoqrevqa
-- ============================================================

-- ============================================================
-- 1. TABLE: agent_handoffs
-- Hermes → ORBIT handoff tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agent_handoffs (
  id BIGSERIAL PRIMARY KEY,
  from_agent TEXT NOT NULL,
  to_agent TEXT NOT NULL,
  task JSONB NOT NULL DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_handoffs_from_agent ON public.agent_handoffs(from_agent);
CREATE INDEX IF NOT EXISTS idx_agent_handoffs_to_agent ON public.agent_handoffs(to_agent);
CREATE INDEX IF NOT EXISTS idx_agent_handoffs_status ON public.agent_handoffs(status);
CREATE INDEX IF NOT EXISTS idx_agent_handoffs_created_at ON public.agent_handoffs(created_at DESC);

-- ============================================================
-- 2. TABLE: agent_events
-- Agent activity log (events, errors, approvals)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agent_events (
  id BIGSERIAL PRIMARY KEY,
  agent TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_events_agent ON public.agent_events(agent);
CREATE INDEX IF NOT EXISTS idx_agent_events_event_type ON public.agent_events(event_type);
CREATE INDEX IF NOT EXISTS idx_agent_events_timestamp ON public.agent_events(timestamp DESC);

-- ============================================================
-- 3. TABLE: agent_state
-- Current state + cost tracking for each agent
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agent_state (
  agent TEXT PRIMARY KEY,
  state JSONB DEFAULT '{"status":"idle","started_at":null}'::jsonb,
  costs JSONB DEFAULT '{"session":0,"total":0,"rate":0.015}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- ENABLE REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.agent_handoffs;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.agent_events;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.agent_state;

-- ============================================================
-- ROW LEVEL SECURITY (Optional - for production)
-- ============================================================
-- Uncomment if you want RLS enabled
-- ALTER TABLE public.agent_handoffs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.agent_events ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.agent_state ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- INITIAL DATA
-- ============================================================
INSERT INTO public.agent_state (agent, state, costs) VALUES
  ('hermes', '{"status":"idle"}'::jsonb, '{"session":0,"total":0,"rate":0.015}'::jsonb),
  ('orbit', '{"status":"idle"}'::jsonb, '{"session":0,"total":0,"rate":0.010}'::jsonb),
  ('subagent-1', '{"status":"idle"}'::jsonb, '{"session":0,"total":0,"rate":0.005}'::jsonb),
  ('subagent-2', '{"status":"idle"}'::jsonb, '{"session":0,"total":0,"rate":0.005}'::jsonb)
ON CONFLICT (agent) DO NOTHING;

-- ============================================================
-- DONE
-- ============================================================
-- Tables created: agent_handoffs, agent_events, agent_state
-- Realtime enabled on all 3 tables
-- Indexes created for performance
-- Initial state seeded
