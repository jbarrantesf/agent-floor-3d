import type { FloorModel } from './types'
import type { PanelKey } from './layout'

export type PanelSpec = {
  title: string
  accent: string
} & (
  | { kind: 'code'; lines: string[] }
  | { kind: 'bars'; bars: { label: string; value: number; max: number; display: string }[] }
  | { kind: 'kpis'; rows: { label: string; value: string }[] }
  | { kind: 'chat'; messages: string[] }
  | { kind: 'bay' }
  | { kind: 'alerts'; open: number; items: { title: string; severity: string }[] }
  | { kind: 'stations'; rows: { label: string; state: string }[] }
  | { kind: 'strategy'; lines: string[] }
)

function kpi(model: FloorModel, key: string) {
  return model.kpis.find((row) => row.key === key)
}

function num(model: FloorModel, key: string): number {
  const value = Number(kpi(model, key)?.value ?? 0)
  return Number.isFinite(value) ? value : 0
}

function shown(model: FloorModel, key: string): string {
  const row = kpi(model, key)
  if (!row) return '—'
  return row.unit ? `${row.value} ${row.unit}` : row.value
}

export function buildPanels(model: FloorModel): Record<PanelKey, PanelSpec> {
  const ceo = model.stations.find((station) => station.id === 'ceo')
  const aimae = model.stations.find((station) => station.id === 'aimae')
  return {
    code: {
      kind: 'code',
      title: 'DIAGNÓSTICO',
      accent: '#3dffb0',
      lines: [
        'fn vigilar(alerta) {',
        '  if alerta.abierta',
        '    route(dx)',
        '}',
        `sync.ok     ${shown(model, 'munso_sync_min_desde_ok')}`,
        `errores     ${shown(model, 'munso_sync_errores_24h')}`,
        `registros   ${shown(model, 'munso_sync_registros_24h')}`,
        '> puesto dx en la planta',
      ],
    },
    stations: {
      kind: 'stations',
      title: 'PUESTOS',
      accent: '#86fff0',
      rows: model.stations.map((station) => ({
        label: station.label,
        state: station.current.kind === 'idle' ? 'espera' : station.current.kind === 'task' ? 'curso' : station.current.kind,
      })),
    },
    alerts: {
      kind: 'alerts',
      title: 'ALERTAS',
      accent: '#49c2ff',
      open: model.openAlerts,
      items: model.alerts.slice(0, 3).map((alert) => ({ title: alert.title, severity: alert.severity })),
    },
    chat: {
      kind: 'chat',
      title: 'aiMae',
      accent: '#5dffe0',
      messages: [
        aimae?.role ?? 'primer contacto',
        aimae?.current.title ?? 'En espera',
        'Escala si hace falta',
      ],
    },
    bars: {
      kind: 'bars',
      title: 'OPERACIONES',
      accent: '#4cc9ff',
      bars: [
        { label: 'Registros', value: num(model, 'munso_sync_registros_24h'), max: 40000, display: shown(model, 'munso_sync_registros_24h') },
        { label: 'Corridas', value: num(model, 'munso_sync_corridas_24h'), max: 30, display: shown(model, 'munso_sync_corridas_24h') },
        { label: 'Errores', value: num(model, 'munso_sync_errores_24h'), max: 10, display: shown(model, 'munso_sync_errores_24h') },
        { label: 'Propuestas', value: num(model, 'munso_propuestas_pend'), max: 200, display: shown(model, 'munso_propuestas_pend') },
      ],
    },
    kpis: {
      kind: 'kpis',
      title: 'TORRE · ESTADO',
      accent: '#3ee0ff',
      rows: model.kpis.slice(0, 8).map((row) => ({
        label: row.label,
        value: row.unit ? `${row.value} ${row.unit}` : row.value,
      })),
    },
    bay: { kind: 'bay', title: 'BAHÍA NEXAI', accent: '#49f0a8' },
    strategy: {
      kind: 'strategy',
      title: 'DIRECCIÓN',
      accent: '#8eb6ff',
      lines: [
        ceo?.agentName ?? 'CEO',
        ceo?.role ?? 'Dirección',
        ceo?.retired ? 'Retirado de la torre' : ceo?.status ?? 'activo',
        ceo?.current.detail ?? '',
      ].filter(Boolean),
    },
  }
}
