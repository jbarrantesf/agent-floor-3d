export type StationId = 'diagnostico' | 'operaciones' | 'aimae' | 'ejecutivo' | 'ceo'

export type WorkKind = 'task' | 'idle' | 'alert' | 'schedule'

export interface RawAgent {
  id: string
  name: string
  type: string
  model: string | null
  status: string
  system_prompt: string
  config: Record<string, unknown>
  last_run_at: string | null
  retirado_at: string | null
}

export interface RawTask {
  id: string
  agent_id: string
  task_type: string
  status: string
  input_data: unknown
  created_at: string
}

export interface RawAlert {
  id: string
  agent_id: string | null
  severity: string
  title: string
  message: string
  category: string | null
  is_resolved: boolean
  created_at: string
}

export interface RawKpi {
  key: string
  label: string
  value: string
  unit: string | null
  category: string | null
}

export interface RawAimae {
  empresa: string
  sector: string
  rol: string
  horario: string
  escalar_a: string
  activo: boolean
}

export interface FloorInput {
  agents: RawAgent[]
  tasks: RawTask[]
  alerts: RawAlert[]
  kpis: RawKpi[]
  aimae: RawAimae | null
}

export interface FloorTask {
  id: string
  label: string
  taskType: string
  status: string
  createdAt: string
}

export interface FloorAlert {
  id: string
  severity: string
  title: string
  message: string
  category: string | null
  resolved: boolean
  createdAt: string
}

export interface CurrentWork {
  kind: WorkKind
  title: string
  detail: string
}

export interface StationPartner {
  stationId: StationId
  name: string
  label: string
}

export interface FloorStation {
  id: StationId
  label: string
  agentId: string | null
  agentName: string
  role: string
  summary: string
  prompt: string
  model: string | null
  status: string
  lastRunAt: string | null
  retired: boolean
  isDemo: boolean
  sourceNote: string | null
  emoji: string
  photoUrl: string | null
  current: CurrentWork
  tasks: FloorTask[]
  partner: StationPartner | null
}

export interface UnassignedAgent {
  name: string
  summary: string
  status: string
  retired: boolean
}

export interface FloorHandoff {
  a: StationId
  b: StationId
  label: string
}

export interface FloorModel {
  source: 'live' | 'snapshot'
  notice: string | null
  capturedAt: string | null
  stations: FloorStation[]
  unassigned: UnassignedAgent[]
  alerts: FloorAlert[]
  kpis: RawKpi[]
  handoffs: FloorHandoff[]
  openAlerts: number
}
