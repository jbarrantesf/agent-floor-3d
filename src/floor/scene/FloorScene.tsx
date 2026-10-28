import { useEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { HOLO_SLOTS, HOME_VIEW, LAYOUT, STAGE, anchor, type HoloSlot } from '../layout'
import { buildPanels } from '../panels'
import type { FloorModel, StationId } from '../types'
import { Chibi } from './Chibi'
import { Room } from './Room'
import { consoleTexture, laptopTexture, panelTexture } from './textures'

interface SceneProps {
  model: FloorModel
  selected: StationId | null
  focus: { camera: [number, number, number]; target: [number, number, number] } | null
  onSelect: (id: StationId) => void
}

export function FloorScene({ model, selected, focus, onSelect }: SceneProps) {
  const panels = useMemo(() => buildPanels(model), [model])
  const animating = useRef(false)

  return (
    <>
      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={4.2}
        maxDistance={22}
        minPolarAngle={0.78}
        maxPolarAngle={1.38}
        target={HOME_VIEW.target}
        onStart={() => {
          animating.current = false
        }}
      />
      <CameraRig focus={focus} animating={animating} />
      <Room />
      {HOLO_SLOTS.map((slot) => (
        <HoloPanel key={slot.key} slot={slot} panels={panels} />
      ))}
      {model.stations.map((station) => (
        <StationRig key={station.id} stationId={station.id} selected={selected === station.id} onSelect={() => onSelect(station.id)}>
          <WorkBubble
            label={station.label}
            station={station.id}
            title={bubbleTitle(station.current.kind, station.current.title)}
            detail={bubbleDetail(station)}
            partner={station.partner?.name ?? null}
            selected={selected === station.id}
            onSelect={() => onSelect(station.id)}
          />
        </StationRig>
      ))}
      {model.handoffs.map((link) => (
        <Handoff key={`${link.a}-${link.b}`} a={link.a} b={link.b} label={link.label} />
      ))}
    </>
  )
}

function bubbleTitle(kind: string, title: string): string {
  if (kind === 'task') return 'En curso'
  if (kind === 'alert') return 'Vigilando'
  if (kind === 'schedule') return title
  return 'En espera'
}

function bubbleDetail(station: FloorModel['stations'][number]): string {
  if (station.current.kind === 'schedule') return station.current.detail
  if (station.current.kind === 'idle') return station.current.detail.replace(/^Última:\s*/, '')
  return station.current.title
}

function CameraRig({
  focus,
  animating,
}: {
  focus: SceneProps['focus']
  animating: MutableRefObject<boolean>
}) {
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls) as OrbitControlsImpl | null
  const gl = useThree((state) => state.gl)
  const desiredPos = useRef(new THREE.Vector3(...HOME_VIEW.camera))
  const desiredTarget = useRef(new THREE.Vector3(...HOME_VIEW.target))
  const key = focus ? `${focus.camera.join(',')}|${focus.target.join(',')}` : 'home'

  useEffect(() => {
    const nextCamera = focus?.camera ?? HOME_VIEW.camera
    const nextTarget = focus?.target ?? HOME_VIEW.target
    desiredPos.current.set(...nextCamera)
    desiredTarget.current.set(...nextTarget)
    animating.current = true
    // `key` already encodes the focus coordinates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    const cancel = () => {
      animating.current = false
      if (controls) controls.enabled = true
    }
    gl.domElement.addEventListener('pointerdown', cancel)
    return () => gl.domElement.removeEventListener('pointerdown', cancel)
  }, [gl, controls, animating])

  useFrame(() => {
    if (!animating.current || !controls) return
    controls.enabled = false
    camera.position.lerp(desiredPos.current, 0.14)
    controls.target.lerp(desiredTarget.current, 0.16)
    if (camera.position.distanceTo(desiredPos.current) < 0.07) {
      animating.current = false
      controls.enabled = true
    }
  })

  return null
}

function HoloPanel({
  slot,
  panels,
}: {
  slot: HoloSlot
  panels: ReturnType<typeof buildPanels>
}) {
  const spec = panels[slot.key]
  const texture = useMemo(() => panelTexture(spec, slot.px[0], slot.px[1]), [spec, slot.px])
  const group = useRef<THREE.Group>(null)
  useEffect(() => () => texture.dispose(), [texture])
  useFrame((state) => {
    if (!group.current || !slot.floaty) return
    group.current.position.y = slot.position[1] + Math.sin(state.clock.elapsedTime * 0.8 + slot.position[0]) * 0.05
  })
  const [w, h] = slot.size
  return (
    <group ref={group} position={slot.position} rotation={slot.rotation}>
      <mesh position={[0, 0, -0.05]}>
        <planeGeometry args={[w * 1.08, h * 1.1]} />
        <meshBasicMaterial color={slot.accent} transparent opacity={0.18} toneMapped={false} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      <Scanline width={w} height={h} />
      <pointLight position={[0, 0, 0.9]} color={slot.accent} intensity={10} distance={4.8} decay={2} />
    </group>
  )
}

function Scanline({ width, height }: { width: number; height: number }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    if (!ref.current) return
    const t = (state.clock.elapsedTime * 0.28) % 1
    ref.current.position.y = height / 2 - t * height
  })
  return (
    <mesh ref={ref} position={[0, 0, 0.012]}>
      <planeGeometry args={[width * 0.9, 0.025]} />
      <meshBasicMaterial color="#d9fff4" transparent opacity={0.35} toneMapped={false} depthWrite={false} />
    </mesh>
  )
}

function StationRig({
  stationId,
  selected,
  onSelect,
  children,
}: {
  stationId: StationId
  selected: boolean
  onSelect: () => void
  children: ReactNode
}) {
  const layout = LAYOUT[stationId]
  const y = STAGE.y + layout.position[1]
  return (
    <group position={[layout.position[0], y, layout.position[2]]} rotation={[0, layout.rotation, 0]}>
      <mesh
        position={[0, 0.9, 0]}
        onClick={(event) => {
          event.stopPropagation()
          onSelect()
        }}
        onPointerOver={(event) => {
          event.stopPropagation()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto'
        }}
      >
        <cylinderGeometry args={[0.55, 0.55, 1.9, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.52, 0.62, 40]} />
        <meshBasicMaterial color={selected ? '#8dffe8' : '#16383a'} toneMapped={false} />
      </mesh>
      {(layout.pose === 'sit' || layout.pose === 'booth') && <Chair />}
      {layout.pose === 'sit' && <DeskLaptop />}
      {layout.pose === 'console' && <OpsConsole />}
      {stationId === 'aimae' && <Pedestal />}
      {layout.pose === 'booth' && <Booth />}
      <group scale={1.12}>
        <Chibi station={stationId} pose={layout.pose} />
      </group>
      {children}
    </group>
  )
}

function Chair() {
  return (
    <group position={[0, 0, -0.08]}>
      <mesh position={[0, 0.42, 0]} castShadow>
        <boxGeometry args={[0.52, 0.08, 0.5]} />
        <meshStandardMaterial color="#1a212b" metalness={0.45} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.78, -0.22]}>
        <boxGeometry args={[0.52, 0.62, 0.08]} />
        <meshStandardMaterial color="#121820" metalness={0.4} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 0.4, 8]} />
        <meshStandardMaterial color="#0d1218" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  )
}

function DeskLaptop() {
  const screen = useMemo(() => laptopTexture(), [])
  return (
    <group position={[0.15, 0, 0.72]}>
      <mesh position={[0, 0.64, 0]} castShadow>
        <boxGeometry args={[1.35, 0.06, 0.72]} />
        <meshStandardMaterial color="#232b36" metalness={0.55} roughness={0.32} />
      </mesh>
      {[-0.55, 0.55].map((x) =>
        [-0.26, 0.26].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.32, z]}>
            <cylinderGeometry args={[0.035, 0.04, 0.6, 8]} />
            <meshStandardMaterial color="#121820" metalness={0.7} roughness={0.3} />
          </mesh>
        ))
      )}
      <group position={[0, 0.7, 0.02]}>
        <mesh>
          <boxGeometry args={[0.48, 0.025, 0.34]} />
          <meshStandardMaterial color="#0e141c" metalness={0.7} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0.16, -0.15]} rotation={[-0.45, 0, 0]}>
          <planeGeometry args={[0.44, 0.28]} />
          <meshBasicMaterial map={screen} toneMapped={false} />
        </mesh>
      </group>
      <pointLight position={[0, 0.95, -0.05]} color="#39f3a0" intensity={1.6} distance={1.8} decay={2} />
    </group>
  )
}

function OpsConsole() {
  const screen = useMemo(() => consoleTexture(), [])
  return (
    <group position={[0.45, 0, 0.82]}>
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[1.25, 0.9, 0.4]} />
        <meshStandardMaterial color="#171d27" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, 1.05, 0.12]} rotation={[-0.55, 0, 0]}>
        <planeGeometry args={[1.2, 0.72]} />
        <meshBasicMaterial map={screen} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 1.1, 0.4]} color="#4cc9ff" intensity={8} distance={2.6} decay={2} />
    </group>
  )
}

function Pedestal() {
  return (
    <group position={[0.15, 0, 0.7]}>
      <mesh position={[0, 0.48, 0]}>
        <cylinderGeometry args={[0.28, 0.34, 0.9, 16]} />
        <meshStandardMaterial color="#1a222c" metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.96, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 0.06, 20]} />
        <meshStandardMaterial color="#2a3542" metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  )
}

function Booth() {
  return (
    <group>
      <mesh position={[0, -0.14, 0]}>
        <boxGeometry args={[2.5, 0.28, 2.05]} />
        <meshStandardMaterial color="#182028" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.02, 0.95]}>
        <boxGeometry args={[2.5, 0.08, 0.16]} />
        <meshStandardMaterial color="#f6c400" emissive="#f6c400" emissiveIntensity={0.35} />
      </mesh>
      <Glass position={[-1.15, 1.05, 0]} args={[0.04, 1.7, 1.5]} />
      <Glass position={[1.15, 1.05, 0]} args={[0.04, 1.7, 1.5]} />
      <Glass position={[0, 1.05, -0.7]} args={[2.2, 1.7, 0.04]} />
      <mesh position={[0, 1.92, 0]}>
        <boxGeometry args={[2.4, 0.05, 1.6]} />
        <meshStandardMaterial color="#10161c" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, 1.95, 0.8]}>
        <boxGeometry args={[2.2, 0.03, 0.03]} />
        <meshBasicMaterial color="#7dffe8" toneMapped={false} />
      </mesh>
    </group>
  )
}

function Glass({ position, args }: { position: [number, number, number]; args: [number, number, number] }) {
  return (
    <mesh position={position}>
      <boxGeometry args={args} />
      <meshBasicMaterial color="#9fffea" transparent opacity={0.07} depthWrite={false} />
    </mesh>
  )
}

function bubblePos(station: StationId): [number, number, number] {
  if (station === 'ejecutivo') return [-0.15, 2.62, 0]
  if (station === 'aimae') return [0.35, 2.05, 0]
  if (station === 'ceo') return [0.2, 2.85, 0]
  if (station === 'operaciones') return [0.15, 2.28, 0]
  return [-0.1, 2.18, 0]
}

function WorkBubble({
  label,
  station,
  title,
  detail,
  partner,
  selected,
  onSelect,
}: {
  label: string
  station: StationId
  title: string
  detail: string
  partner: string | null
  selected: boolean
  onSelect: () => void
}) {
  return (
    <Html position={bubblePos(station)} center distanceFactor={12} zIndexRange={[12, 0]} style={{ pointerEvents: 'none' }}>
      <button
        type="button"
        className={`bubble${selected ? ' is-on' : ''}`}
        data-station={station}
        style={{ pointerEvents: 'auto' }}
        onClick={(event) => {
          event.stopPropagation()
          onSelect()
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <span className="bubble-kicker">{label}</span>
        <strong>{title}</strong>
        <em>{detail.length > 28 ? `${detail.slice(0, 26)}…` : detail}</em>
        {partner && <span className="bubble-chip">con {partner}</span>}
      </button>
    </Html>
  )
}

function Handoff({ a, b, label }: { a: StationId; b: StationId; label: string }) {
  const start = useMemo(() => {
    const [x, y, z] = anchor(a)
    return new THREE.Vector3(x, y + 1.35, z)
  }, [a])
  const end = useMemo(() => {
    const [x, y, z] = anchor(b)
    return new THREE.Vector3(x, y + 1.35, z)
  }, [b])
  const mid = useMemo(() => start.clone().lerp(end, 0.5), [start, end])
  const packet = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    if (!packet.current) return
    const t = (state.clock.elapsedTime % 2.4) / 2.4
    packet.current.position.lerpVectors(start, end, t)
  })
  return (
    <group>
      <Line points={[start, end]} color="#7dffe4" lineWidth={1.5} transparent opacity={0.8} dashed dashScale={6} dashSize={0.25} gapSize={0.15} />
      <mesh ref={packet}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshBasicMaterial color="#d9fff4" toneMapped={false} />
      </mesh>
      <Html position={mid} center zIndexRange={[11, 0]} style={{ pointerEvents: 'none' }}>
        <span className="handoff-chip">{label.length > 28 ? `${label.slice(0, 26)}…` : label}</span>
      </Html>
    </group>
  )
}
