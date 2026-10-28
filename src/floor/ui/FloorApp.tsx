import { useCallback, useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { askStation, llmConfigured } from '../chat'
import { focusView } from '../layout'
import { loadFloorModel } from '../loadFloor'
import { FloorScene } from '../scene/FloorScene'
import type { FloorModel, FloorStation, StationId } from '../types'

const STATUS: Record<string, string> = {
  active: 'activo',
  demo: 'demo',
  completed: 'completada',
  failed: 'falló',
  pending: 'pendiente',
  running: 'en curso',
  idle: 'en espera',
}

export function FloorApp() {
  const [model, setModel] = useState<FloorModel | null>(null)
  const [selectedId, setSelectedId] = useState<StationId | null>(null)
  const [home, setHome] = useState(true)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    setBusy(true)
    try {
      setModel(await loadFloorModel())
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const selected = model?.stations.find((station) => station.id === selectedId) ?? null
  const focus = !home && selected ? focusView(selected.id) : null

  const choose = useCallback((id: StationId) => {
    setSelectedId(id)
    setHome(false)
  }, [])

  const clear = useCallback(() => {
    setSelectedId(null)
    setHome(true)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
      if (!model) return
      const index = ['1', '2', '3', '4', '5'].indexOf(event.key)
      if (index >= 0) choose(model.stations[index].id)
      if (event.key === 'Escape') clear()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [model, choose, clear])

  if (!model) {
    return (
      <div className="floor-root">
        <div className="floor-loader">Armando la planta…</div>
      </div>
    )
  }

  return (
    <div className={`floor-root${selected ? ' is-open' : ''}`}>
      <div className="floor-canvas">
        <Canvas
          shadows
          dpr={[1, 1.75]}
          camera={{ position: [6.4, 3.85, 12.4], fov: 32, near: 0.1, far: 80 }}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping
            gl.toneMappingExposure = 1.08
            gl.setClearColor('#07090d')
          }}
        >
          <FloorScene model={model} selected={selectedId} focus={focus} onSelect={choose} />
        </Canvas>
      </div>
      <div className="floor-vignette" />
      <header className="topbar">
        <div className="brand">
          <Mark />
          <div>
            <strong>NEXAI</strong>
            <span>Agent Floor 3D</span>
          </div>
        </div>
        <div className="top-meta">
          <div className="pills">
            <button className={`pill ${model.source === 'live' ? 'live' : 'snap'}`} onClick={() => void reload()} disabled={busy} title={model.notice ?? 'Datos de la torre'}>
              {busy ? 'Leyendo…' : model.source === 'live' ? 'Torre en vivo' : 'Instantánea 28 oct'}
            </button>
            <span className="pill">{model.openAlerts} alertas</span>
          </div>
          {model.unassigned.length > 0 && (
            <p className="meta-note">Sin estación: {model.unassigned.map((agent) => agent.name).join(', ')}</p>
          )}
        </div>
      </header>
      <nav className="station-rail" aria-label="Estaciones">
        {model.stations.map((station) => (
          <button
            key={station.id}
            className={`rail-btn${station.id === selectedId ? ' is-on' : ''}`}
            onClick={() => choose(station.id)}
          >
            {station.label}
            <small>{station.agentName}</small>
          </button>
        ))}
        <button className="rail-btn" onClick={clear}>
          Vista general
          <small>órbita</small>
        </button>
      </nav>
      {selected && <Profile station={selected} onClose={clear} />}
    </div>
  )
}

function Profile({ station, onClose }: { station: FloorStation; onClose: () => void }) {
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const greeting = useMemo(
    () => `Soy ${station.agentName}, en ${station.label}. ${station.summary}`,
    [station]
  )
  const [messages, setMessages] = useState<{ role: 'user' | 'agent'; text: string }[]>([
    { role: 'agent', text: greeting },
  ])

  useEffect(() => {
    setMessages([{ role: 'agent', text: `Soy ${station.agentName}, en ${station.label}. ${station.summary}` }])
    setDraft('')
  }, [station.id, station.agentName, station.label, station.summary])

  const send = async () => {
    const question = draft.trim()
    if (!question || pending) return
    setDraft('')
    setMessages((current) => [...current, { role: 'user', text: question }])
    setPending(true)
    try {
      const reply = await askStation(station, question)
      setMessages((current) => [...current, { role: 'agent', text: reply }])
    } finally {
      setPending(false)
    }
  }

  return (
    <aside className="profile" aria-label={`Ficha de ${station.agentName}`}>
      <div className="profile-head">
        <div className="who">
          <div className="portrait">
            {station.photoUrl ? (
              <img src={station.photoUrl} alt="" />
            ) : (
              <Portrait station={station.id} />
            )}
          </div>
          <div>
            <h2>
              {station.emoji} {station.agentName}
            </h2>
            <p>
              {station.role} · {station.label}
            </p>
          </div>
        </div>
        <button className="ghost" onClick={onClose} type="button">
          Cerrar
        </button>
      </div>
      <div className="badges">
        {station.isDemo && <span className="badge demo">Demo</span>}
        {!station.isDemo && <span className="badge">Torre</span>}
        {station.retired && <span className="badge retired">Retirado de la torre</span>}
        <span className="badge">{STATUS[station.status] ?? station.status}</span>
        {station.model && <span className="badge">{station.model}</span>}
      </div>
      {station.sourceNote && <p className="profile-source">{station.sourceNote}</p>}
      <p className="summary">{station.summary}</p>
      <p className="section-label">Tarea actual</p>
      <div className="now-card">
        {station.current.title}
        <small>{station.current.detail}</small>
      </div>
      {station.partner && (
        <p className="summary">
          Colabora con {station.partner.name}: {station.partner.label}
        </p>
      )}
      <p className="section-label">Últimas tareas</p>
      {station.tasks.length === 0 ? (
        <p className="profile-source">Sin tareas en agent_tasks.</p>
      ) : (
        <ul className="task-list">
          {station.tasks.map((task) => (
            <li key={task.id}>
              {task.label}
              <small>
                {STATUS[task.status] ?? task.status} · {formatWhen(task.createdAt)}
              </small>
            </li>
          ))}
        </ul>
      )}
      <p className="profile-source">Última corrida: {formatWhen(station.lastRunAt)}</p>
      <p className="section-label">Pregúntale</p>
      <div className="chat-log">
        {messages.map((message, index) => (
          <p key={`${message.role}-${index}`} className={message.role}>
            {message.text}
          </p>
        ))}
        {pending && <p className="agent">Pensando…</p>}
      </div>
      <form
        className="chat-form"
        onSubmit={(event) => {
          event.preventDefault()
          void send()
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={`Pregúntale a ${station.agentName}…`}
          aria-label={`Pregunta para ${station.agentName}`}
        />
        <button className="send" type="submit" disabled={pending}>
          Enviar
        </button>
      </form>
      <p className="chat-mode">{llmConfigured() ? 'Modelo conectado' : 'Respuesta local · sin VITE_LLM_API_KEY'}</p>
    </aside>
  )
}

function formatWhen(iso: string | null): string {
  if (!iso) return 'sin registro'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'sin registro'
  return new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function Mark() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="28" fill="none" stroke="#3dffb0" strokeWidth="3" />
      <path d="M18 40 V24 H28 L36 34 V24 H46 V40 H36 L28 30 V40 Z" fill="#3dffb0" />
    </svg>
  )
}

const SKIN: Record<StationId, string> = {
  diagnostico: '#e7b89a',
  ejecutivo: '#f0c7a8',
  aimae: '#c98962',
  operaciones: '#8d5a3c',
  ceo: '#d7a883',
}

const HAIR: Record<StationId, string> = {
  diagnostico: '#1b2430',
  ejecutivo: '#3a2c24',
  aimae: '#9a4034',
  operaciones: '#161311',
  ceo: '#161616',
}

const TOP: Record<StationId, string> = {
  diagnostico: '#1c6f86',
  ejecutivo: '#243246',
  aimae: '#f3f0e8',
  operaciones: '#1b212b',
  ceo: '#12312c',
}

function Portrait({ station }: { station: StationId }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" fill="#102028" />
      <rect x="12" y="44" width="40" height="24" rx="8" fill={TOP[station]} />
      <circle cx="32" cy="28" r="14" fill={SKIN[station]} />
      <path d="M18 28 Q32 8 46 28 Q40 16 32 16 Q24 16 18 28" fill={HAIR[station]} />
      <circle cx="26" cy="30" r="1.6" fill="#102018" />
      <circle cx="38" cy="30" r="1.6" fill="#102018" />
    </svg>
  )
}
