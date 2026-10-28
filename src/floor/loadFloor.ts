import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { buildFloorModel } from './assignStations'
import { SNAPSHOT_AT, SNAPSHOT_INPUT } from './snapshot'
import type { FloorInput, FloorModel, RawAgent, RawAimae, RawAlert, RawKpi, RawTask } from './types'

const SNAPSHOT_RLS =
  'La llave anónima no puede leer agents (RLS de la torre exige sesión). Instantánea saneada del 28 oct 2026. Para datos en vivo, define VITE_SUPABASE_ACCESS_TOKEN con un JWT de la organización.'

const SNAPSHOT_ENV =
  'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Mostrando la instantánea saneada del 28 oct 2026.'

function snapshotModel(notice: string): FloorModel {
  return buildFloorModel(SNAPSHOT_INPUT, {
    source: 'snapshot',
    notice,
    capturedAt: SNAPSHOT_AT,
  })
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function asAgent(row: unknown): RawAgent | null {
  if (!row || typeof row !== 'object') return null
  const record = row as Record<string, unknown>
  if (typeof record.id !== 'string' || typeof record.name !== 'string') return null
  const config =
    record.config && typeof record.config === 'object' && !Array.isArray(record.config)
      ? (record.config as Record<string, unknown>)
      : {}
  return {
    id: record.id,
    name: record.name,
    type: text(record.type, 'custom'),
    model: textOrNull(record.model),
    status: text(record.status, 'unknown'),
    system_prompt: text(record.system_prompt),
    config,
    last_run_at: textOrNull(record.last_run_at),
    retirado_at: textOrNull(record.retirado_at),
  }
}

function asTask(row: unknown): RawTask | null {
  if (!row || typeof row !== 'object') return null
  const record = row as Record<string, unknown>
  if (typeof record.id !== 'string' || typeof record.agent_id !== 'string') return null
  return {
    id: record.id,
    agent_id: record.agent_id,
    task_type: text(record.task_type, 'task'),
    status: text(record.status, 'unknown'),
    input_data: record.input_data ?? null,
    created_at: text(record.created_at, new Date(0).toISOString()),
  }
}

function asAlert(row: unknown): RawAlert | null {
  if (!row || typeof row !== 'object') return null
  const record = row as Record<string, unknown>
  if (typeof record.id !== 'string' || typeof record.title !== 'string') return null
  return {
    id: record.id,
    agent_id: textOrNull(record.agent_id),
    severity: text(record.severity, 'info'),
    title: record.title,
    message: text(record.message),
    category: textOrNull(record.category),
    is_resolved: Boolean(record.is_resolved),
    created_at: text(record.created_at, new Date(0).toISOString()),
  }
}

function asKpi(row: unknown): RawKpi | null {
  if (!row || typeof row !== 'object') return null
  const record = row as Record<string, unknown>
  const key = text(record.kpi_key)
  if (!key) return null
  return {
    key,
    label: text(record.kpi_label, key),
    value: text(record.value, '—'),
    unit: textOrNull(record.unit),
    category: textOrNull(record.category),
  }
}

function asAimae(row: unknown): RawAimae | null {
  if (!row || typeof row !== 'object') return null
  const record = row as Record<string, unknown>
  if (typeof record.rol !== 'string') return null
  return {
    empresa: text(record.empresa, 'NexAI'),
    sector: text(record.sector, ''),
    rol: record.rol,
    horario: text(record.horario, ''),
    escalar_a: text(record.escalar_a, ''),
    activo: record.activo !== false,
  }
}

function client(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (!url || !key) return null
  const token = import.meta.env.VITE_SUPABASE_ACCESS_TOKEN as string | undefined
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  })
}

export async function loadFloorModel(): Promise<FloorModel> {
  const supabase = client()
  if (!supabase) return snapshotModel(SNAPSHOT_ENV)

  try {
    const [agentsRes, tasksRes, alertsRes, kpisRes, aimaeRes] = await Promise.all([
      supabase.from('agents').select('id,name,type,model,status,system_prompt,config,last_run_at,retirado_at'),
      supabase
        .from('agent_tasks')
        .select('id,agent_id,task_type,status,input_data,created_at')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('alerts')
        .select('id,agent_id,severity,title,message,category,is_resolved,created_at')
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('kpi_values')
        .select('kpi_key,kpi_label,value,unit,category,timestamp')
        .order('timestamp', { ascending: false })
        .limit(40),
      supabase.from('aimae_config').select('empresa,sector,rol,horario,escalar_a,activo').limit(1),
    ])

    const agents = (agentsRes.data ?? []).map(asAgent).filter((row): row is RawAgent => row !== null)
    if (agentsRes.error || agents.length === 0) return snapshotModel(SNAPSHOT_RLS)

    const input: FloorInput = {
      agents,
      tasks: tasksRes.error ? [] : (tasksRes.data ?? []).map(asTask).filter((row): row is RawTask => row !== null),
      alerts: alertsRes.error
        ? []
        : (alertsRes.data ?? []).map(asAlert).filter((row): row is RawAlert => row !== null),
      kpis: kpisRes.error ? [] : (kpisRes.data ?? []).map(asKpi).filter((row): row is RawKpi => row !== null),
      aimae: aimaeRes.error ? null : asAimae(aimaeRes.data?.[0]),
    }

    const gaps = [
      tasksRes.error ? 'tareas' : null,
      alertsRes.error ? 'alertas' : null,
      kpisRes.error ? 'KPIs' : null,
    ].filter(Boolean)

    return buildFloorModel(input, {
      source: 'live',
      notice: gaps.length ? `En vivo. No se pudieron leer: ${gaps.join(', ')}.` : null,
      capturedAt: new Date().toISOString(),
    })
  } catch {
    return snapshotModel(SNAPSHOT_RLS)
  }
}
