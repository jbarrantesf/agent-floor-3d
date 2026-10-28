import * as THREE from 'three'
import type { PanelSpec } from '../panels'
import type { StationId } from '../types'

function canvasTexture(canvas: HTMLCanvasElement, repeat?: [number, number]): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(repeat[0], repeat[1])
  }
  texture.needsUpdate = true
  return texture
}

let hazardBase: THREE.CanvasTexture | null = null

export function hazardTexture(repeatX: number, repeatY = 1): THREE.CanvasTexture {
  if (!hazardBase) {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas')
    ctx.fillStyle = '#101114'
    ctx.fillRect(0, 0, 256, 256)
    ctx.save()
    ctx.translate(128, 128)
    ctx.rotate(-Math.PI / 4)
    ctx.fillStyle = '#f6c400'
    for (let x = -420; x < 420; x += 56) ctx.fillRect(x, -420, 28, 840)
    ctx.restore()
    hazardBase = canvasTexture(canvas)
    hazardBase.wrapS = THREE.RepeatWrapping
    hazardBase.wrapT = THREE.RepeatWrapping
  }
  const texture = hazardBase.clone()
  texture.repeat.set(repeatX, repeatY)
  texture.needsUpdate = true
  return texture
}

export function floorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  ctx.fillStyle = '#141a22'
  ctx.fillRect(0, 0, 512, 512)
  ctx.strokeStyle = '#24303c'
  ctx.lineWidth = 2
  for (let i = 0; i <= 512; i += 64) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, 512)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, i)
    ctx.lineTo(512, i)
    ctx.stroke()
  }
  ctx.fillStyle = '#3a4654'
  for (let y = 32; y < 512; y += 64) {
    for (let x = 32; x < 512; x += 64) {
      ctx.beginPath()
      ctx.arc(x, y, 2.4, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  return canvasTexture(canvas, [6, 6])
}

export function wallTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  ctx.fillStyle = '#12171e'
  ctx.fillRect(0, 0, 512, 512)
  ctx.strokeStyle = '#1c242e'
  ctx.lineWidth = 4
  for (let x = 16; x < 512; x += 128) {
    ctx.strokeRect(x, 24, 104, 464)
  }
  ctx.fillStyle = '#0c1016'
  ctx.fillRect(0, 0, 512, 18)
  return canvasTexture(canvas, [2, 1])
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function header(ctx: CanvasRenderingContext2D, spec: PanelSpec, w: number, h: number) {
  ctx.fillStyle = 'rgba(5, 14, 20, 0.96)'
  roundRect(ctx, 6, 6, w - 12, h - 12, 16)
  ctx.fill()
  ctx.strokeStyle = spec.accent
  ctx.lineWidth = Math.max(2, w * 0.004)
  ctx.stroke()
  ctx.fillStyle = spec.accent
  ctx.font = `600 ${Math.round(h * 0.07)}px sans-serif`
  ctx.fillText(spec.title, 28, 28 + h * 0.055)
  ctx.globalAlpha = 0.45
  ctx.fillRect(28, 40 + h * 0.07, w - 56, 2)
  ctx.globalAlpha = 1
}

export function panelTexture(spec: PanelSpec, w: number, h: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  header(ctx, spec, w, h)
  const top = 58 + h * 0.08
  if (spec.kind === 'code') paintCode(ctx, spec.lines, spec.accent, top, h)
  if (spec.kind === 'bars') paintBars(ctx, spec.bars, spec.accent, w, top, h)
  if (spec.kind === 'kpis') paintKpis(ctx, spec.rows, spec.accent, w, top, h)
  if (spec.kind === 'chat') paintChat(ctx, spec.messages, spec.accent, w, top)
  if (spec.kind === 'alerts') paintAlerts(ctx, spec, w, top, h)
  if (spec.kind === 'stations') paintStations(ctx, spec.rows, spec.accent, w, top, h)
  if (spec.kind === 'strategy') paintLines(ctx, spec.lines, spec.accent, top, h)
  if (spec.kind === 'bay') paintBay(ctx, spec.accent, w, h)
  return canvasTexture(canvas)
}

function paintCode(ctx: CanvasRenderingContext2D, lines: string[], accent: string, top: number, h: number) {
  ctx.font = `${Math.round(h * 0.048)}px monospace`
  lines.forEach((line, index) => {
    ctx.fillStyle = line.startsWith('>') ? '#eafff6' : accent
    ctx.globalAlpha = line.startsWith('>') ? 1 : 0.88
    ctx.fillText(line, 32, top + index * (h * 0.075))
  })
  ctx.globalAlpha = 1
}

function paintBars(
  ctx: CanvasRenderingContext2D,
  bars: { label: string; value: number; max: number; display: string }[],
  accent: string,
  w: number,
  top: number,
  h: number
) {
  const row = (h - top - 24) / bars.length
  bars.forEach((bar, index) => {
    const y = top + index * row
    ctx.fillStyle = '#9ad7ff'
    ctx.font = `${Math.round(h * 0.04)}px sans-serif`
    ctx.fillText(bar.label, 28, y + row * 0.35)
    ctx.fillStyle = 'rgba(80, 180, 255, 0.18)'
    ctx.fillRect(28, y + row * 0.48, w - 56, row * 0.28)
    const width = Math.max(4, (w - 56) * Math.min(1, bar.value / Math.max(bar.max, 1)))
    ctx.fillStyle = accent
    ctx.fillRect(28, y + row * 0.48, width, row * 0.28)
    ctx.fillStyle = '#e7f7ff'
    ctx.font = `${Math.round(h * 0.035)}px monospace`
    ctx.fillText(bar.display, w - 28 - ctx.measureText(bar.display).width, y + row * 0.38)
  })
}

function paintKpis(
  ctx: CanvasRenderingContext2D,
  rows: { label: string; value: string }[],
  accent: string,
  w: number,
  top: number,
  h: number
) {
  const cols = 2
  const cellW = (w - 48) / cols
  const cellH = (h - top - 20) / Math.ceil(rows.length / cols)
  rows.forEach((row, index) => {
    const col = index % cols
    const line = Math.floor(index / cols)
    const x = 24 + col * cellW
    const y = top + line * cellH
    ctx.strokeStyle = 'rgba(80, 220, 255, 0.35)'
    ctx.strokeRect(x + 8, y + 6, cellW - 20, cellH - 14)
    ctx.fillStyle = '#8eb8c8'
    ctx.font = `${Math.round(h * 0.038)}px sans-serif`
    ctx.fillText(row.label.slice(0, 32), x + 18, y + cellH * 0.38)
    ctx.fillStyle = accent
    ctx.font = `600 ${Math.round(h * 0.055)}px sans-serif`
    ctx.fillText(row.value, x + 18, y + cellH * 0.68)
  })
}

function paintChat(ctx: CanvasRenderingContext2D, messages: string[], accent: string, w: number, top: number) {
  messages.forEach((message, index) => {
    const y = top + index * 78
    const mine = index % 2 === 0
    ctx.fillStyle = mine ? 'rgba(40, 255, 200, 0.16)' : 'rgba(70, 140, 255, 0.16)'
    roundRect(ctx, mine ? 28 : 80, y, w - 120, 62, 12)
    ctx.fill()
    ctx.fillStyle = accent
    ctx.font = '20px sans-serif'
    ctx.fillText(message.slice(0, 42), mine ? 44 : 96, y + 38)
  })
}

function paintAlerts(
  ctx: CanvasRenderingContext2D,
  spec: Extract<PanelSpec, { kind: 'alerts' }>,
  w: number,
  top: number,
  h: number
) {
  ctx.fillStyle = spec.accent
  ctx.font = `700 ${Math.round(h * 0.16)}px sans-serif`
  ctx.fillText(String(spec.open), 32, top + h * 0.16)
  ctx.font = `${Math.round(h * 0.045)}px sans-serif`
  ctx.fillStyle = '#d7f3ff'
  ctx.fillText('abiertas', 32 + ctx.measureText(String(spec.open)).width + 48, top + h * 0.15)
  spec.items.forEach((item, index) => {
    ctx.fillStyle = item.severity === 'critical' ? '#ff5d7a' : item.severity === 'warning' ? '#ffc14a' : spec.accent
    ctx.fillRect(32, top + h * 0.28 + index * 36, 8, 8)
    ctx.fillStyle = '#e7f6ff'
    ctx.font = `${Math.round(h * 0.04)}px sans-serif`
    ctx.fillText(item.title.slice(0, 28), 50, top + h * 0.3 + index * 36)
  })
}

function paintStations(
  ctx: CanvasRenderingContext2D,
  rows: { label: string; state: string }[],
  accent: string,
  w: number,
  top: number,
  h: number
) {
  const rowH = (h - top - 16) / rows.length
  rows.forEach((row, index) => {
    const y = top + index * rowH
    ctx.fillStyle = accent
    ctx.fillRect(28, y + rowH * 0.35, 8, 8)
    ctx.fillStyle = '#e9fff8'
    ctx.font = `${Math.round(h * 0.05)}px sans-serif`
    ctx.fillText(row.label, 46, y + rowH * 0.55)
    ctx.fillStyle = '#9ad0c4'
    ctx.fillText(row.state, w - 120, y + rowH * 0.55)
  })
}

function paintLines(ctx: CanvasRenderingContext2D, lines: string[], accent: string, top: number, h: number) {
  ctx.font = `${Math.round(h * 0.055)}px sans-serif`
  lines.forEach((line, index) => {
    ctx.fillStyle = index === 0 ? '#f4f8ff' : accent
    ctx.fillText(line.slice(0, 42), 32, top + index * (h * 0.09))
  })
}

function paintBay(ctx: CanvasRenderingContext2D, accent: string, w: number, h: number) {
  const project = (x: number, y: number, z: number) => [w * 0.5 + (x - z) * 34, h * 0.62 + (x + z) * 16 - y * 28] as const
  const box = (x: number, z: number, height: number) => {
    const a = project(x, 0, z)
    const b = project(x + 1.2, 0, z)
    const c = project(x + 1.2, 0, z + 1.2)
    const d = project(x, 0, z + 1.2)
    const topA = project(x, height, z)
    const topB = project(x + 1.2, height, z)
    const topD = project(x, height, z + 1.2)
    ctx.fillStyle = 'rgba(12, 40, 36, 0.9)'
    ctx.beginPath()
    ctx.moveTo(a[0], a[1])
    ctx.lineTo(b[0], b[1])
    ctx.lineTo(c[0], c[1])
    ctx.lineTo(d[0], d[1])
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = 'rgba(20, 80, 64, 0.85)'
    ctx.beginPath()
    ctx.moveTo(a[0], a[1])
    ctx.lineTo(topA[0], topA[1])
    ctx.lineTo(topB[0], topB[1])
    ctx.lineTo(b[0], b[1])
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = accent
    ctx.globalAlpha = 0.9
    ctx.beginPath()
    ctx.moveTo(topA[0], topA[1])
    ctx.lineTo(topB[0], topB[1])
    ctx.lineTo(project(x + 1.2, height, z + 1.2)[0], project(x + 1.2, height, z + 1.2)[1])
    ctx.lineTo(topD[0], topD[1])
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = 1
  }
  ctx.strokeStyle = 'rgba(73, 240, 168, 0.28)'
  for (let i = -4; i <= 4; i++) {
    ctx.beginPath()
    ctx.moveTo(...project(i, 0, -3))
    ctx.lineTo(...project(i, 0, 3))
    ctx.stroke()
  }
  ;[
    [-3.2, 1.2, 1.5],
    [-1.4, 1.2, 2.3],
    [0.4, 1.2, 1.7],
    [2.2, 1.2, 2.6],
    [-2.4, -0.4, 1.2],
    [-0.4, -0.4, 2.0],
    [1.6, -0.4, 1.5],
    [3.2, -0.2, 1.1],
  ].forEach(([x, z, height]) => box(x, z, height))
}

export function laptopTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 320
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  ctx.fillStyle = '#04140f'
  ctx.fillRect(0, 0, 512, 320)
  ctx.fillStyle = '#39f3a0'
  ctx.font = '22px monospace'
  ;['dx.scan()', '  alertas.open', '  sync.last_ok', '  route -> dx', '> listo'].forEach((line, i) => {
    ctx.fillText(line, 28, 48 + i * 36)
  })
  return canvasTexture(canvas)
}

export function consoleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 768
  canvas.height = 480
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  ctx.fillStyle = '#061018'
  ctx.fillRect(0, 0, 768, 480)
  ctx.strokeStyle = '#4cc9ff'
  ctx.lineWidth = 4
  ctx.strokeRect(12, 12, 744, 456)
  ctx.fillStyle = '#4cc9ff'
  ctx.font = '600 28px sans-serif'
  ctx.fillText('FLUJO OPS', 36, 58)
  ctx.strokeStyle = '#7ee0ff'
  ctx.beginPath()
  ctx.moveTo(40, 360)
  ;[80, 140, 110, 180, 150, 220, 190, 250].forEach((y, i) => {
    ctx.lineTo(60 + i * 70, 400 - y)
  })
  ctx.stroke()
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = 'rgba(76, 201, 255, 0.2)'
    ctx.fillRect(40 + i * 170, 90, 150, 70)
  }
  return canvasTexture(canvas)
}

const FACE: Record<StationId, { skin: string; iris: string; smile: string }> = {
  diagnostico: { skin: '#e7b89a', iris: '#1b3a4a', smile: '#a86458' },
  ejecutivo: { skin: '#f0c7a8', iris: '#243044', smile: '#b56d62' },
  aimae: { skin: '#c98962', iris: '#2a140e', smile: '#8d4038' },
  operaciones: { skin: '#8d5a3c', iris: '#1a120e', smile: '#6a382c' },
  ceo: { skin: '#d7a883', iris: '#24180f', smile: '#8d5344' },
}

export function faceTexture(station: StationId): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  const look = FACE[station]
  ctx.clearRect(0, 0, 256, 256)
  const eye = (x: number) => {
    ctx.fillStyle = '#f7fbff'
    ctx.beginPath()
    ctx.ellipse(x, 118, 22, 26, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = look.iris
    ctx.beginPath()
    ctx.arc(x, 122, 11, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#081018'
    ctx.beginPath()
    ctx.arc(x, 122, 5, 0, Math.PI * 2)
    ctx.fill()
  }
  eye(92)
  eye(164)
  ctx.strokeStyle = look.iris
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(74, 82)
  ctx.quadraticCurveTo(96, 74, 112, 84)
  ctx.moveTo(148, 84)
  ctx.quadraticCurveTo(168, 74, 186, 82)
  ctx.stroke()
  ctx.strokeStyle = look.smile
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(108, 168)
  ctx.quadraticCurveTo(128, 184, 150, 168)
  ctx.stroke()
  ctx.fillStyle = look.skin
  ctx.globalAlpha = 0.0
  ctx.fillRect(0, 0, 1, 1)
  return canvasTexture(canvas)
}
