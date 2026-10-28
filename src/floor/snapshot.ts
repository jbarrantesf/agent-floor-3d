import type { FloorInput } from './types'

/**
 * Sanitized copy of aios-control-tower (cpsdpmekmtqevvrmahds) read on 2026-10-28.
 * Used when the anon key cannot pass RLS. No customer phone numbers or chat bodies.
 */
export const SNAPSHOT_AT = '2026-10-28T20:00:00.000Z'

const ORBIT = 'a0000001-0000-0000-0000-000000000001'
const HERMES = 'a0000002-0000-0000-0000-000000000002'
const SECUENCIAS = 'a0000003-0000-0000-0000-000000000003'
const NEXAI = 'a0000004-0000-0000-0000-000000000004'

export const SNAPSHOT_INPUT: FloorInput = {
  agents: [
    {
      id: ORBIT,
      name: 'Orbit',
      type: 'custom',
      model: 'claude-sonnet-4-6',
      status: 'active',
      system_prompt: '',
      config: {
        emoji: '🪐',
        description:
          'IA principal de NexAI Solutions CR. Estrategia, ejecución y desarrollo de producto. Canal directo con José.',
      },
      last_run_at: '2026-09-05T18:53:25.060Z',
      retirado_at: '2026-09-02T18:41:36.212Z',
    },
    {
      id: HERMES,
      name: 'Hermes',
      type: 'custom',
      model: null,
      status: 'active',
      system_prompt: '',
      config: {
        emoji: '🛠️',
        description:
          'Agente local de José. Corre en su máquina, con sus plugins y su gateway. Le manda latido a la torre.',
      },
      last_run_at: '2026-09-07T15:55:22.868Z',
      retirado_at: '2026-09-10T03:53:53.325Z',
    },
    {
      id: SECUENCIAS,
      name: 'Secuencias',
      type: 'custom',
      model: null,
      status: 'active',
      system_prompt: '',
      config: {
        description:
          'Worker de correos programados. Cron de Vercel cada 15 minutos: lee correos pendientes y marca cada envío.',
      },
      last_run_at: null,
      retirado_at: '2026-09-02T18:41:36.212Z',
    },
    {
      id: NEXAI,
      name: 'NexAI',
      type: 'custom',
      model: 'claude-sonnet-4-6',
      status: 'active',
      system_prompt: '',
      config: {
        emoji: '⚡',
        description:
          'Asistente del AIOS Control Tower. Corre en la nube, lee y escribe con el JWT de quien pregunta, y puede crear tareas, mover proyectos y levantar alertas.',
      },
      last_run_at: '2026-10-22T01:26:02.960Z',
      retirado_at: null,
    },
  ],
  tasks: [
    {
      id: 'nexai-finanzas',
      agent_id: NEXAI,
      task_type: 'chat',
      status: 'completed',
      input_data: { message: 'Consulta sobre la tabla de finanzas' },
      created_at: '2026-10-22T01:26:02.951Z',
    },
    {
      id: 'nexai-leads-bd',
      agent_id: NEXAI,
      task_type: 'chat',
      status: 'completed',
      input_data: { message: 'Leads en la base de la torre' },
      created_at: '2026-10-22T01:25:02.502Z',
    },
    {
      id: 'nexai-leads-mes',
      agent_id: NEXAI,
      task_type: 'chat',
      status: 'completed',
      input_data: { message: 'Conteo de leads del mes' },
      created_at: '2026-10-22T01:24:29.793Z',
    },
    {
      id: 'nexai-facturacion',
      agent_id: NEXAI,
      task_type: 'chat',
      status: 'completed',
      input_data: { message: 'Facturación de octubre' },
      created_at: '2026-10-21T23:30:32.048Z',
    },
    {
      id: 'orbit-facturacion',
      agent_id: ORBIT,
      task_type: 'chat_message',
      status: 'failed',
      input_data: { message: 'Facturación de octubre' },
      created_at: '2026-10-21T23:30:32.829Z',
    },
    {
      id: 'orbit-ubicacion',
      agent_id: ORBIT,
      task_type: 'chat_message',
      status: 'completed',
      input_data: { message: 'Ubicación de Orbit' },
      created_at: '2026-09-17T01:17:23.873Z',
    },
    {
      id: 'orbit-ayuda',
      agent_id: ORBIT,
      task_type: 'chat_message',
      status: 'completed',
      input_data: { message: 'En qué puede ayudar' },
      created_at: '2026-09-17T01:15:02.550Z',
    },
    {
      id: 'orbit-resumen',
      agent_id: ORBIT,
      task_type: 'chat_message',
      status: 'completed',
      input_data: { message: 'Resumen del día' },
      created_at: '2026-09-10T03:46:35.650Z',
    },
    {
      id: 'orbit-munso',
      agent_id: ORBIT,
      task_type: 'chat_message',
      status: 'completed',
      input_data: { message: 'Estado del proyecto MUNSO' },
      created_at: '2026-08-21T02:05:34.942Z',
    },
  ],
  alerts: [
    {
      id: 'alert-sync',
      agent_id: null,
      severity: 'critical',
      title: 'Sync Softland MUNSO estancado',
      message: 'Último sync exitoso por encima del umbral de 26 h cuando se abrió la alerta.',
      category: 'sync',
      is_resolved: false,
      created_at: '2026-06-22T10:15:00.048Z',
    },
    {
      id: 'alert-notif',
      agent_id: null,
      severity: 'warning',
      title: 'Notificaciones críticas sin atender en MUNSO',
      message: 'Notificaciones de SLA y sync sin leer en el dashboard de MUNSO.',
      category: 'agentes',
      is_resolved: false,
      created_at: '2026-06-13T01:51:50.939Z',
    },
    {
      id: 'alert-orbit',
      agent_id: ORBIT,
      severity: 'info',
      title: 'Orbit Bridge Online',
      message: 'Integración Orbit y AIOS Control Tower activada.',
      category: 'system',
      is_resolved: false,
      created_at: '2026-05-27T04:35:38.964Z',
    },
    {
      id: 'alert-mrr',
      agent_id: null,
      severity: 'warning',
      title: 'MRR activo en cero al abrir la alerta',
      message: 'Alerta histórica de finanzas. Confirmar contra facturación vigente.',
      category: 'finance',
      is_resolved: false,
      created_at: '2026-05-27T01:36:01.169Z',
    },
  ],
  kpis: [
    { key: 'munso_sync_min_desde_ok', label: 'Minutos desde último sync OK', value: '104', unit: 'min', category: 'salud' },
    { key: 'munso_sync_corridas_24h', label: 'Corridas de sync (24h)', value: '20', unit: 'runs', category: 'salud' },
    { key: 'munso_sync_errores_24h', label: 'Errores de sync (24h)', value: '0', unit: 'errs', category: 'salud' },
    { key: 'munso_sync_registros_24h', label: 'Registros sincronizados (24h)', value: '35083', unit: 'rows', category: 'salud' },
    { key: 'munso_propuestas_pend', label: 'Propuestas esperando aprobación', value: '148', unit: 'props', category: 'agentes' },
    { key: 'munso_notif_criticas', label: 'Notificaciones críticas sin leer', value: '21', unit: 'notifs', category: 'agentes' },
    { key: 'munso_sla_breach', label: 'Pasos CxC en breach de SLA', value: '0', unit: 'pasos', category: 'cxc' },
    { key: 'munso_pagos_abiertos', label: 'Pagos en conciliación', value: '1', unit: 'pagos', category: 'cxc' },
    { key: 'munso_facturas_total', label: 'Facturas en el espejo Softland', value: '56188', unit: 'docs', category: 'volumen' },
  ],
  aimae: {
    empresa: 'NexAI Solutions CR',
    sector: 'otro',
    rol: 'primer contacto y calificación de leads',
    horario: 'L-V 8am-5pm',
    escalar_a: 'Jose Barrantes',
    activo: true,
  },
}
