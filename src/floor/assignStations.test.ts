import { buildFloorModel, stationForName } from './assignStations'
import { redact } from './redact'
import { SNAPSHOT_AT, SNAPSHOT_INPUT } from './snapshot'
import type { FloorInput } from './types'

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

function run() {
  assert(redact('llama al +506 883108618 hoy') === 'llama al ••• hoy', 'phone redact')
  assert(!redact('sync 104 min').includes('•••'), 'short numbers stay')

  const model = buildFloorModel(SNAPSHOT_INPUT, {
    source: 'snapshot',
    notice: null,
    capturedAt: SNAPSHOT_AT,
  })
  assert(model.stations.length === 5, 'five stations')
  const byId = Object.fromEntries(model.stations.map((station) => [station.id, station]))
  assert(byId.ceo.agentName === 'Orbit' && !byId.ceo.isDemo, 'ceo is Orbit')
  assert(byId.ejecutivo.agentName === 'NexAI' && !byId.ejecutivo.isDemo, 'ejecutivo is NexAI')
  assert(byId.operaciones.agentName === 'Hermes' && !byId.operaciones.isDemo, 'ops is Hermes')
  assert(byId.diagnostico.isDemo && byId.diagnostico.agentName === 'DX Nova', 'dx is demo')
  assert(byId.aimae.isDemo && byId.aimae.summary.includes('NexAI Solutions CR'), 'aimae uses config')
  assert(byId.diagnostico.current.kind === 'alert', 'dx watches alerts')
  assert(model.handoffs.length === 1, 'one handoff')
  assert(byId.ceo.partner?.name === 'NexAI', 'ceo partners with NexAI')
  assert(byId.ejecutivo.partner?.name === 'Orbit', 'nexai partners with Orbit')
  assert(model.unassigned.some((agent) => agent.name === 'Secuencias'), 'secuencias unassigned')
  assert(model.kpis.length === 9, 'deduped kpis')

  const diagnosed: FloorInput = {
    ...SNAPSHOT_INPUT,
    agents: [
      ...SNAPSHOT_INPUT.agents,
      {
        id: 'dx-1',
        name: 'Diagnóstico Norte',
        type: 'custom',
        model: 'demo',
        status: 'active',
        system_prompt: '',
        config: { description: 'Agente real de diagnóstico.' },
        last_run_at: '2026-10-01T00:00:00.000Z',
        retirado_at: null,
      },
    ],
  }
  const withDx = buildFloorModel(diagnosed, { source: 'live', notice: null, capturedAt: null })
  assert(!withDx.stations.find((station) => station.id === 'diagnostico')?.isDemo, 'named dx maps')
  assert(stationForName('Secuencias') === null, 'secuencias has no station')
  console.log('assignStations ok')
}

const entry = process.argv[1] ?? ''
if (entry.includes('assignStations.test')) run()
