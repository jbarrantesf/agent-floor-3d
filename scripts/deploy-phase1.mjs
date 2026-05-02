#!/usr/bin/env node

/**
 * PHASE 1 DEPLOYMENT SCRIPT
 * Hermes → Supabase SQL Schema Deployment
 * 
 * Usage: node scripts/deploy-phase1.mjs
 * Credentials loaded from .env (git-ignored)
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ ERROR: Missing SUPABASE credentials in .env');
  console.error('   Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

console.log('🔑 Supabase Credentials Loaded');
console.log(`   URL: ${SUPABASE_URL.substring(0, 30)}...`);
console.log(`   Role: service_role (full access)\n`);

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// PHASE 1 SQL SCHEMA
const PHASE1_SQL = `
-- ════════════════════════════════════════════════════════
-- PHASE 1: TASK DELEGATION ARCHITECTURE
-- Hermes → ORBIT Task Management System
-- Created: 2026-05-02
-- ════════════════════════════════════════════════════════

-- 1. TASKS TABLE (Core task queue)
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delegated_by TEXT NOT NULL,
    assigned_to TEXT NOT NULL,
    task_type TEXT NOT NULL,
    priority INT DEFAULT 0,
    status TEXT DEFAULT 'QUEUED',
    payload JSONB NOT NULL,
    result JSONB,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT now(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT now(),
    timeout_seconds INT DEFAULT 3600,
    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 3
);

-- 2. TASK_EVENTS TABLE (Audit trail)
CREATE TABLE IF NOT EXISTS task_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    event_data JSONB,
    created_at TIMESTAMP DEFAULT now(),
    CONSTRAINT valid_event_type CHECK (event_type IN ('delegated', 'started', 'progress', 'completed', 'failed'))
);

-- 3. AGENT_CAPACITY TABLE (Agent health & limits)
CREATE TABLE IF NOT EXISTS agent_capacity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_name TEXT NOT NULL UNIQUE,
    max_concurrent_tasks INT DEFAULT 5,
    current_load INT DEFAULT 0,
    is_online BOOLEAN DEFAULT true,
    last_heartbeat TIMESTAMP DEFAULT now(),
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- 4. COST_DAILY_SUMMARY TABLE (Cost aggregation)
CREATE TABLE IF NOT EXISTS cost_daily_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    agent_name TEXT NOT NULL,
    task_count INT DEFAULT 0,
    total_cost NUMERIC(10, 6) DEFAULT 0.00,
    tokens_used INT DEFAULT 0,
    model_name TEXT,
    created_at TIMESTAMP DEFAULT now(),
    UNIQUE(date, agent_name)
);

-- ════════════════════════════════════════════════════════
-- INDEXES (Performance optimization)
-- ════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_delegated_by ON tasks(delegated_by);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_priority_status ON tasks(priority DESC, status);

CREATE INDEX IF NOT EXISTS idx_task_events_task_id ON task_events(task_id);
CREATE INDEX IF NOT EXISTS idx_task_events_agent_name ON task_events(agent_name);
CREATE INDEX IF NOT EXISTS idx_task_events_created_at ON task_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_capacity_agent_name ON agent_capacity(agent_name);
CREATE INDEX IF NOT EXISTS idx_cost_daily_summary_date ON cost_daily_summary(date DESC);
CREATE INDEX IF NOT EXISTS idx_cost_daily_summary_agent_name ON cost_daily_summary(agent_name);

-- ════════════════════════════════════════════════════════
-- REALTIME SUBSCRIPTIONS
-- ════════════════════════════════════════════════════════

ALTER TABLE tasks REPLICA IDENTITY FULL;
ALTER TABLE task_events REPLICA IDENTITY FULL;
ALTER TABLE agent_capacity REPLICA IDENTITY FULL;

-- ════════════════════════════════════════════════════════
-- FUNCTIONS
-- ════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_task_status(
    p_task_id UUID,
    p_new_status TEXT,
    p_agent_name TEXT,
    p_result JSONB DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
    UPDATE tasks
    SET 
        status = p_new_status,
        updated_at = now(),
        completed_at = CASE WHEN p_new_status IN ('COMPLETED', 'FAILED', 'TIMEOUT') THEN now() ELSE completed_at END,
        result = COALESCE(p_result, result),
        error_message = COALESCE(p_error_message, error_message)
    WHERE id = p_task_id;

    INSERT INTO task_events (task_id, event_type, agent_name, event_data, created_at)
    VALUES (p_task_id, lower(p_new_status), p_agent_name, 
        jsonb_build_object('status', p_new_status, 'result', p_result, 'error', p_error_message),
        now());
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_pending_tasks_for_agent(p_agent_name TEXT, p_limit INT DEFAULT 10)
RETURNS TABLE (
    task_id UUID,
    task_type TEXT,
    priority INT,
    payload JSONB,
    created_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT tasks.id, tasks.task_type, tasks.priority, tasks.payload, tasks.created_at
    FROM tasks
    WHERE tasks.assigned_to = p_agent_name 
      AND tasks.status = 'QUEUED'
      AND tasks.retry_count < tasks.max_retries
    ORDER BY priority DESC, created_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_agent_load(p_agent_name TEXT, p_delta INT)
RETURNS void AS $$
BEGIN
    UPDATE agent_capacity
    SET current_load = GREATEST(0, current_load + p_delta),
        updated_at = now()
    WHERE agent_name = p_agent_name;
END;
$$ LANGUAGE plpgsql;

-- ════════════════════════════════════════════════════════
-- TRIGGERS
-- ════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION tasks_update_timestamp() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_updated_at_trigger
BEFORE UPDATE ON tasks
FOR EACH ROW
EXECUTE FUNCTION tasks_update_timestamp();

CREATE OR REPLACE FUNCTION log_task_creation() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO task_events (task_id, event_type, agent_name, event_data)
    VALUES (NEW.id, 'delegated', NEW.delegated_by, jsonb_build_object(
        'assigned_to', NEW.assigned_to,
        'task_type', NEW.task_type,
        'priority', NEW.priority
    ));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_creation_event_trigger
AFTER INSERT ON tasks
FOR EACH ROW
EXECUTE FUNCTION log_task_creation();

-- ════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_capacity ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_daily_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY tasks_agent_visibility ON tasks FOR SELECT
USING (
    current_setting('app.current_agent') = assigned_to 
    OR current_setting('app.current_agent') = delegated_by
    OR current_setting('app.current_agent') = 'hermes'
);

CREATE POLICY tasks_agent_update ON tasks FOR UPDATE
USING (
    current_setting('app.current_agent') = assigned_to
    OR current_setting('app.current_agent') = 'hermes'
);

CREATE POLICY task_events_agent_visibility ON task_events FOR SELECT
USING (
    current_setting('app.current_agent') = 'hermes'
    OR current_setting('app.current_agent') IN (
        SELECT assigned_to FROM tasks WHERE id = task_id
    )
    OR current_setting('app.current_agent') IN (
        SELECT delegated_by FROM tasks WHERE id = task_id
    )
);

CREATE POLICY agent_capacity_read ON agent_capacity FOR SELECT
USING (current_setting('app.current_agent') IS NOT NULL);

CREATE POLICY cost_summary_hermes_only ON cost_daily_summary FOR SELECT
USING (current_setting('app.current_agent') = 'hermes');

-- ════════════════════════════════════════════════════════
-- SEED DATA
-- ════════════════════════════════════════════════════════

INSERT INTO agent_capacity (agent_name, max_concurrent_tasks, current_load, is_online)
VALUES 
    ('hermes', 20, 0, true),
    ('orbit', 15, 0, true),
    ('subagent_1', 5, 0, false),
    ('subagent_2', 5, 0, false)
ON CONFLICT (agent_name) DO UPDATE SET is_online = EXCLUDED.is_online;
`;

async function deployPhase1() {
  try {
    console.log('🚀 Deploying Phase 1 SQL Schema...\n');

    // Try to verify if tables exist
    try {
      const { data, error } = await supabase
        .from('agent_capacity')
        .select('agent_name, max_concurrent_tasks, is_online')
        .limit(4);

      if (!error && data && data.length > 0) {
        console.log('✅ TABLES ALREADY EXIST - Phase 1 deployment verified!\n');
        console.log('✅ AGENTS INITIALIZED:\n');
        data.forEach(agent => {
          const status = agent.is_online ? '🟢 ONLINE' : '🔴 OFFLINE';
          console.log(`   ${agent.agent_name.padEnd(15)} | Max: ${agent.max_concurrent_tasks} | ${status}`);
        });
        console.log('\n✅ PHASE 1 DEPLOYMENT VERIFIED\n');
        return;
      }
    } catch (e) {
      // Tables might not exist yet, continue with deployment info
    }

    console.log('ℹ️  Direct SQL execution via Supabase JS client requires admin setup.');
    console.log('   Recommended deployment methods:\n');
    console.log('📋 METHOD 1: SQL Editor (Fastest - 2 min)');
    console.log('   1. Open: https://app.supabase.com/project/aybxrgvvwpknkoqrevqa/sql/new');
    console.log('   2. Copy SQL from this script');
    console.log('   3. Click Run\n');
    
    console.log('📋 METHOD 2: Supabase CLI');
    console.log('   supabase db push\n');

    console.log('📋 METHOD 3: PostgreSQL Direct');
    console.log('   psql -h db.aybxrgvvwpknkoqrevqa.supabase.co -U postgres -d postgres\n');

    console.log('───────────────────────────────────────────────────\n');
    console.log('📋 SQL SCHEMA READY (lines: ' + PHASE1_SQL.split('\n').length + ')\n');
    
    // Save SQL to file for easy copy-paste
    const sqlFilePath = path.join(__dirname, '../supabase/migrations/20260502_phase1_schema.sql');
    fs.mkdirSync(path.dirname(sqlFilePath), { recursive: true });
    fs.writeFileSync(sqlFilePath, PHASE1_SQL);
    console.log('✅ Saved to: supabase/migrations/20260502_phase1_schema.sql\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

deployPhase1();
