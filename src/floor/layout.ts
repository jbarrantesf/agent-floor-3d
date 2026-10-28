import type { StationId } from './types'

export type Vec3 = [number, number, number]
export type Pose = 'sit' | 'stand' | 'console' | 'booth'

export const STAGE = { w: 16.8, d: 9.4, y: 0.78 }

export const HOME_VIEW = {
  camera: [6.4, 3.85, 12.4] as Vec3,
  target: [0.2, 1.2, 0.15] as Vec3,
}

export const LAYOUT: Record<
  StationId,
  { position: Vec3; rotation: number; pose: Pose }
> = {
  diagnostico: { position: [-5.85, 0, 1.45], rotation: 0.72, pose: 'sit' },
  ejecutivo: { position: [-1.55, 0, -0.05], rotation: 0.08, pose: 'stand' },
  aimae: { position: [2.05, 0, 1.55], rotation: -0.18, pose: 'stand' },
  operaciones: { position: [4.85, 0, 0.2], rotation: 0.22, pose: 'console' },
  ceo: { position: [-2.45, 0.2, -2.35], rotation: 0.4, pose: 'booth' },
}

export type PanelKey = 'code' | 'stations' | 'alerts' | 'chat' | 'bars' | 'kpis' | 'bay' | 'strategy'

export interface HoloSlot {
  key: PanelKey
  position: Vec3
  rotation: Vec3
  size: [number, number]
  accent: string
  px: [number, number]
  floaty: boolean
}

export const HOLO_SLOTS: HoloSlot[] = [
  { key: 'code', position: [-7.2, 2.42, -0.15], rotation: [0, 0.46, 0], size: [2.45, 1.7], accent: '#3dffb0', px: [768, 540], floaty: true },
  { key: 'stations', position: [-3.65, 2.2, -0.55], rotation: [0, 0.3, 0], size: [1.4, 0.98], accent: '#86fff0', px: [640, 440], floaty: true },
  { key: 'alerts', position: [-0.35, 2.62, -1.05], rotation: [0, 0.05, 0], size: [1.28, 0.98], accent: '#49c2ff', px: [640, 440], floaty: true },
  { key: 'chat', position: [3.7, 2.28, 0.35], rotation: [0, -0.38, 0], size: [1.5, 1.18], accent: '#5dffe0', px: [640, 500], floaty: true },
  { key: 'bars', position: [7.45, 2.48, -0.7], rotation: [0, -0.5, 0], size: [1.75, 1.18], accent: '#4cc9ff', px: [720, 480], floaty: true },
  { key: 'strategy', position: [2.15, 2.45, -4.15], rotation: [0, -0.18, 0], size: [1.85, 1.12], accent: '#8eb6ff', px: [720, 420], floaty: true },
  { key: 'kpis', position: [-3.85, 3.2, -6.85], rotation: [0, 0.04, 0], size: [4.5, 2.5], accent: '#3ee0ff', px: [1024, 576], floaty: false },
  { key: 'bay', position: [3.95, 3.2, -6.85], rotation: [0, -0.04, 0], size: [4.5, 2.5], accent: '#49f0a8', px: [1024, 576], floaty: false },
]

export function focusView(id: StationId): { camera: Vec3; target: Vec3 } {
  const spot = LAYOUT[id]
  const y = STAGE.y + spot.position[1]
  const target: Vec3 = [spot.position[0], y + 1.2, spot.position[2]]
  const camera: Vec3 = [spot.position[0] + 1.35, y + 1.65, spot.position[2] + 3.35]
  return { camera, target }
}

export function anchor(id: StationId): Vec3 {
  const spot = LAYOUT[id]
  return [spot.position[0], STAGE.y + spot.position[1], spot.position[2]]
}
