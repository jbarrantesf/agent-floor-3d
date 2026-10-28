import { redact, taskLabel } from './redact'
import type {
  FloorAlert,
  FloorHandoff,
  FloorInput,
  FloorModel,
  FloorStation,
  FloorTask,
  RawAgent,
  StationId,
  StationPartner,
  UnassignedAgent,
} from './types'

export const STATION_ORDER: StationId[] = ['diagnostico', 'operaciones', 'aimae', 'ejecutivo', 'ceo']

const STATION_LABEL: Record<StationId, string> = {
  diagnostico: 'Diagnóstico',
  operaciones: 'Operaciones',
  aimae: 'aiMae',
  ejecutivo: 'Ejecutivo',
  ceo: 'CEO',
}

const STATION_ROLE: Record<StationId, string> = {
  diagnostico: 'Analista de diagnóstico',
  operaciones: 'Operaciones',
  aimae: 'Calificación de leads',
  ejecutivo: 'Asistente ejecutivo',
  ceo: 'Dirección',
}

const STATION_EMOJI: Record<StationId, string> = {
  diagnostico: '◎',
  operaciones: '⬡',
  aimae: '✧',
  ejecutivo: '▣',
  ceo: '◈',
}

const DEMO: Record<StationId, { name: string; summary: string }> = {
  diagnostico: {
    name: 'DX Nova',
    summary:
      'Puesto de demostración. No hay un agente de diagnóstico en la tabla agents. Esta estación vigila las alertas abiertas de la torre.',
  },
  operaciones: {
    name: 'Ops Demo',
    summary: 'Puesto de demostración. No hay un agente de operaciones en la tabla agents.',
  },
  aimae: {
    name: 'aiMae',
    summary: 'Puesto de demostración. No hay fila de aiMae en agents ni ficha en aimae_config.',
  },
  ejecutivo: {
    name: 'Ejecutivo Demo',
    summary: 'Puesto de demostración. No hay un agente ejecutivo en la tabla agents.',
  },
  ceo: {
    name: 'CEO Demo',
    summary: 'Puesto de demostración. No hay un agente de dirección en la tabla agents.',
  },
}

const OPEN_TASK = new Set(['pending', 'running', 'in_progress', 'queued', 'working', 'assigned'])

const ROLE_BY_NAME: Record<string, string> = {
  orbit: 'Dirección y estrategia',
  hermes: 'Operaciones en la máquina de José',
  nexai: 'Asistente de la torre',
  secuencias: 'Correos programados',
}

export function stationForName(name: string): StationId | null {
  const n = name.trim().toLowerCase()
  if (n === 'orbit') return 'ceo'
  if (n === 'hermes') return 'operaciones'
  if (n === 'nexai') return 'ejecutivo'
  if (n.includes('aimae') || n.includes('ai mae')) return 'aimae'
  if (n.includes('orbit')) return 'ceo'
  if (n.includes('hermes')) return 'operaciones'
  if (n.includes('nexai')) return 'ejecutivo'
  if (n.includes('diag')) return 'diagnostico'
  if (n.includes('ceo') || n.includes('direccion') || n.includes('dirección')) return 'ceo'
  if (n.includes('ejec')) return 'ejecutivo'
  if (n.includes('oper')) return 'operaciones'
  return null
}

function prefer(current: RawAgent, next: RawAgent): RawAgent {
  const currentRetired = current.retirado_at ? 1 : 0
  const nextRetired = next.retirado_at ? 1 : 0
  if (currentRetired !== nextRetired) return nextRetired < currentRetired ? next : current
  const currentRun = current.last_run_at ? Date.parse(current.last_run_at) : 0
  const nextRun = next.last_run_at ? Date.parse(next.last_run_at) : 0
  return nextRun >= currentRun ? next : current
}

function descriptionOf(agent: RawAgent): string {
  const desc = agent.config.description
  if (typeof desc === 'string' && desc.trim()) return desc.trim()
  if (agent.system_prompt.trim()) return agent.system_prompt.trim().slice(0, 420)
  return 'Agente de la torre.'
}

function emojiOf(agent: RawAgent | null, station: StationId): string {
  const emoji = agent?.config.emoji
  if (typeof emoji === 'string' && emoji.trim()) return emoji.trim()
  return STATION_EMOJI[station]
}

function photoOf(agent: RawAgent | null): string | null {
  if (!agent) return null
  for (const key of ['avatar_url', 'photo_url', 'photo', 'image']) {
    const value = agent.config[key]
    if (typeof value === 'string' && /^https:\/\//.test(value)) return value
  }
  return null
}

export function inBusinessHours(horario: string, now = new Date()): boolean | null {
  if (!/l\s*-\s*v/i.test(horario) || !/8/.test(horario)) return null
  const costaRica = new Date(now.getTime() - 6 * 60 * 60 * 1000)
  const day = costaRica.getUTCDay()
  const hour = costaRica.getUTCHours()
  if (day === 0 || day === 6) return false
  return hour >= 8 && hour < 17
}

function normalizeLabel(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function similar(a: string, b: string): boolean {
  const left = normalizeLabel(a)
  const right = normalizeLabel(b)
  if (left.length < 8 || right.length < 8) return false
  return left === right || left.includes(right) || right.includes(left)
}

function mapAlerts(input: FloorInput): FloorAlert[] {
  return input.alerts.map((alert) => ({
    id: alert.id,
    severity: alert.severity,
    title: redact(alert.title),
    message: redact(alert.message),
    category: alert.category,
    resolved: alert.is_resolved,
    createdAt: alert.created_at,
  }))
}

function mapTasks(input: FloorInput): Map<string, FloorTask[]> {
  const grouped = new Map<string, FloorTask[]>()
  const sorted = [...input.tasks].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
  for (const task of sorted) {
    const list = grouped.get(task.agent_id) ?? []
    list.push({
      id: task.id,
      label: taskLabel(task.task_type, task.input_data),
      taskType: task.task_type,
      status: task.status,
      createdAt: task.created_at,
    })
    grouped.set(task.agent_id, list)
  }
  return grouped
}

export function buildFloorModel(
  input: FloorInput,
  meta: { source: 'live' | 'snapshot'; notice: string | null; capturedAt: string | null }
): FloorModel {
  const chosen = new Map<StationId, RawAgent>()
  for (const agent of input.agents) {
    const station = stationForName(agent.name)
    if (!station) continue
    const existing = chosen.get(station)
    chosen.set(station, existing ? prefer(existing, agent) : agent)
  }

  const tasksByAgent = mapTasks(input)
  const alerts = mapAlerts(input)
  const openAlert =
    alerts.find((alert) => !alert.resolved && (alert.severity === 'critical' || alert.severity === 'warning')) ??
    alerts.find((alert) => !alert.resolved) ??
    null

  const draft = new Map<StationId, FloorStation>()

  for (const id of STATION_ORDER) {
    const agent = chosen.get(id) ?? null
    const tasks = agent ? (tasksByAgent.get(agent.id) ?? []).slice(0, 5) : []
    const open = tasks.find((task) => OPEN_TASK.has(task.status))
    let current = idleWork(tasks)
    let summary = agent ? descriptionOf(agent) : DEMO[id].summary
    let role = agent ? ROLE_BY_NAME[agent.name.trim().toLowerCase()] ?? STATION_ROLE[id] : STATION_ROLE[id]
    let name = agent?.name ?? DEMO[id].name
    let isDemo = !agent
    let sourceNote: string | null = isDemo ? 'Demo · puesto sin fila en agents.' : null

    if (id === 'diagnostico' && isDemo && openAlert) {
      current = {
        kind: 'alert',
        title: openAlert.title,
        detail: 'Alerta abierta en la torre',
      }
      sourceNote = 'Demo · vigilando alertas reales.'
    }

    if (id === 'aimae' && input.aimae) {
      const config = input.aimae
      role = config.rol
      if (!agent) {
        name = 'aiMae'
        summary = `${config.empresa}. ${config.rol}. Horario ${config.horario}. Escala a ${config.escalar_a}.`
        sourceNote = 'Demo · sin fila en agents. Ficha tomada de aimae_config.'
        const hours = inBusinessHours(config.horario)
        if (!open) {
          current =
            hours === true
              ? { kind: 'schedule', title: 'En horario', detail: config.rol }
              : hours === false
                ? { kind: 'schedule', title: 'Fuera de horario', detail: config.horario }
                : { kind: 'idle', title: 'En espera', detail: config.rol }
        }
      }
    }

    if (open) {
      current = { kind: 'task', title: open.label, detail: open.status }
    }

    draft.set(id, {
      id,
      label: STATION_LABEL[id],
      agentId: agent?.id ?? null,
      agentName: name,
      role,
      summary,
      prompt: agent?.system_prompt ?? '',
      model: agent?.model ?? null,
      status: agent?.status ?? (id === 'aimae' && input.aimae?.activo ? 'active' : 'demo'),
      lastRunAt: agent?.last_run_at ?? null,
      retired: Boolean(agent?.retirado_at),
      isDemo,
      sourceNote,
      emoji: emojiOf(agent, id),
      photoUrl: photoOf(agent),
      current,
      tasks,
      partner: null,
    })
  }

  const { handoffs, partners } = findHandoffs(draft)
  for (const [id, partner] of partners) {
    const station = draft.get(id)
    if (station) station.partner = partner
  }

  const placed = new Set([...chosen.values()].map((agent) => agent.id))
  const unassigned: UnassignedAgent[] = input.agents
    .filter((agent) => !placed.has(agent.id))
    .map((agent) => ({
      name: agent.name,
      summary: descriptionOf(agent),
      status: agent.status,
      retired: Boolean(agent.retirado_at),
    }))

  return {
    source: meta.source,
    notice: meta.notice,
    capturedAt: meta.capturedAt,
    stations: STATION_ORDER.map((id) => draft.get(id)!),
    unassigned,
    alerts,
    kpis: dedupeKpis(input),
    handoffs,
    openAlerts: alerts.filter((alert) => !alert.resolved).length,
  }
}

function idleWork(tasks: FloorTask[]): FloorStation['current'] {
  const latest = tasks[0]
  return {
    kind: 'idle',
    title: 'En espera',
    detail: latest ? `Última: ${latest.label}` : 'Sin tareas recientes',
  }
}

function dedupeKpis(input: FloorInput) {
  const seen = new Set<string>()
  const rows = []
  for (const kpi of input.kpis) {
    if (seen.has(kpi.key)) continue
    seen.add(kpi.key)
    rows.push(kpi)
  }
  return rows
}

function findHandoffs(draft: Map<StationId, FloorStation>): {
  handoffs: FloorHandoff[]
  partners: Map<StationId, StationPartner>
} {
  const hits: { a: StationId; b: StationId; label: string; at: number }[] = []
  const stations = [...draft.values()]
  for (let i = 0; i < stations.length; i++) {
    for (let j = i + 1; j < stations.length; j++) {
      const left = stations[i]
      const right = stations[j]
      for (const taskA of left.tasks) {
        for (const taskB of right.tasks) {
          const atA = Date.parse(taskA.createdAt)
          const atB = Date.parse(taskB.createdAt)
          if (!Number.isFinite(atA) || !Number.isFinite(atB)) continue
          if (Math.abs(atA - atB) > 3 * 60 * 1000) continue
          if (!similar(taskA.label, taskB.label)) continue
          hits.push({ a: left.id, b: right.id, label: taskA.label, at: Math.max(atA, atB) })
        }
      }
    }
  }
  hits.sort((a, b) => b.at - a.at)
  const partners = new Map<StationId, StationPartner>()
  const handoffs: FloorHandoff[] = []
  const seen = new Set<string>()
  for (const hit of hits) {
    const key = [hit.a, hit.b].sort().join('|')
    if (seen.has(key) || partners.has(hit.a) || partners.has(hit.b)) continue
    seen.add(key)
    const nameA = draft.get(hit.a)?.agentName ?? hit.a
    const nameB = draft.get(hit.b)?.agentName ?? hit.b
    partners.set(hit.a, { stationId: hit.b, name: nameB, label: hit.label })
    partners.set(hit.b, { stationId: hit.a, name: nameA, label: hit.label })
    handoffs.push({ a: hit.a, b: hit.b, label: hit.label })
  }
  return { handoffs, partners }
}
