import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { StationId } from '../types'
import type { Pose } from '../layout'
import { faceTexture } from './textures'

interface Look {
  skin: string
  hair: string
  top: string
  pants: string
  hairScale: [number, number, number]
  visor?: boolean
  glasses?: boolean
  hood?: boolean
  tie?: string
  pin?: boolean
}

const LOOK: Record<StationId, Look> = {
  diagnostico: {
    skin: '#e7b89a',
    hair: '#1b2430',
    top: '#1c6f86',
    pants: '#152028',
    hairScale: [1.05, 0.58, 1.05],
    visor: true,
  },
  ejecutivo: {
    skin: '#f0c7a8',
    hair: '#3a2c24',
    top: '#243246',
    pants: '#1a2230',
    hairScale: [1.06, 0.62, 1.04],
    glasses: true,
    tie: '#3ee0b0',
  },
  aimae: {
    skin: '#c98962',
    hair: '#9a4034',
    top: '#f3f0e8',
    pants: '#2a3138',
    hairScale: [1.08, 0.92, 1.12],
  },
  operaciones: {
    skin: '#8d5a3c',
    hair: '#161311',
    top: '#1b212b',
    pants: '#12161c',
    hairScale: [0.9, 0.4, 0.9],
    hood: true,
  },
  ceo: {
    skin: '#d7a883',
    hair: '#161616',
    top: '#12312c',
    pants: '#101816',
    hairScale: [1.04, 0.5, 1.02],
    pin: true,
  },
}

export function Chibi({ station, pose }: { station: StationId; pose: Pose }) {
  const look = LOOK[station]
  const face = useMemo(() => faceTexture(station), [station])
  const upper = useRef<THREE.Group>(null)
  const seated = pose === 'sit' || pose === 'booth'
  const hipY = seated ? -0.12 : 0

  useFrame((state) => {
    if (!upper.current) return
    const t = state.clock.elapsedTime
    upper.current.position.y = hipY + Math.sin(t * 1.7 + station.length) * 0.012
    upper.current.rotation.y = Math.sin(t * 0.6 + station.length) * 0.04
  })

  const armX = pose === 'console' ? 0.95 : seated ? 1.15 : 0.18
  const torsoX = pose === 'console' ? 0.32 : seated ? 0.06 : 0

  return (
    <group>
      {!seated && (
        <group>
          <Limb position={[-0.14, 0.36, 0]} color={look.pants} args={[0.09, 0.34]} />
          <Limb position={[0.14, 0.36, 0]} color={look.pants} args={[0.09, 0.34]} />
          <mesh position={[-0.14, 0.08, 0.06]}>
            <boxGeometry args={[0.16, 0.08, 0.24]} />
            <meshStandardMaterial color="#0e1218" roughness={0.6} />
          </mesh>
          <mesh position={[0.14, 0.08, 0.06]}>
            <boxGeometry args={[0.16, 0.08, 0.24]} />
            <meshStandardMaterial color="#0e1218" roughness={0.6} />
          </mesh>
        </group>
      )}
      <group ref={upper} position={[0, hipY, 0]} rotation={[torsoX, 0, 0]}>
        <mesh position={[0, 0.84, 0]} castShadow scale={[1.05, 1.12, 0.82]}>
          <sphereGeometry args={[0.34, 28, 20]} />
          <meshStandardMaterial color={look.top} roughness={0.5} metalness={0.06} />
        </mesh>
        <mesh position={[0, 1.05, 0]}>
          <cylinderGeometry args={[0.09, 0.11, 0.12, 12]} />
          <meshStandardMaterial color={look.skin} roughness={0.6} />
        </mesh>
        {look.tie && (
          <mesh position={[0, 0.7, 0.18]}>
            <boxGeometry args={[0.08, 0.22, 0.02]} />
            <meshStandardMaterial color={look.tie} emissive={look.tie} emissiveIntensity={0.25} />
          </mesh>
        )}
        {look.pin && (
          <mesh position={[0.16, 0.9, 0.18]}>
            <sphereGeometry args={[0.035, 12, 12]} />
            <meshStandardMaterial color="#3dffb0" emissive="#3dffb0" emissiveIntensity={0.8} />
          </mesh>
        )}
        {look.hood && (
          <mesh position={[0, 1.32, -0.08]}>
            <sphereGeometry args={[0.42, 24, 16]} />
            <meshStandardMaterial color={look.top} roughness={0.7} />
          </mesh>
        )}
        <mesh position={[0, 1.34, 0]} castShadow>
          <sphereGeometry args={[0.4, 32, 24]} />
          <meshStandardMaterial color={look.skin} roughness={0.55} metalness={0.02} />
        </mesh>
        <mesh position={[0, 1.52, -0.02]} scale={look.hairScale}>
          <sphereGeometry args={[0.36, 24, 16]} />
          <meshStandardMaterial color={look.hair} roughness={0.7} />
        </mesh>
        {station === 'aimae' && (
          <>
            <mesh position={[-0.3, 1.22, 0.02]}>
              <sphereGeometry args={[0.16, 16, 12]} />
              <meshStandardMaterial color={look.hair} roughness={0.7} />
            </mesh>
            <mesh position={[0.3, 1.22, 0.02]}>
              <sphereGeometry args={[0.16, 16, 12]} />
              <meshStandardMaterial color={look.hair} roughness={0.7} />
            </mesh>
          </>
        )}
        <mesh position={[0, 1.3, 0.36]}>
          <circleGeometry args={[0.26, 24]} />
          <meshStandardMaterial map={face} transparent roughness={0.7} />
        </mesh>
        {look.glasses && <Glasses />}
        {look.visor && (
          <mesh position={[0, 1.32, 0.4]}>
            <boxGeometry args={[0.46, 0.045, 0.02]} />
            <meshStandardMaterial color="#7dffe8" emissive="#39f3c0" emissiveIntensity={0.45} transparent opacity={0.45} />
          </mesh>
        )}
        {(station === 'aimae' || station === 'diagnostico') && <Headset color={look.hair} />}
        <Arm position={[-0.38, 0.92, 0.04]} rotation={[armX, 0, 0.45]} color={look.top} skin={look.skin} />
        <Arm position={[0.38, 0.92, 0.04]} rotation={[pose === 'console' ? 1.15 : armX, 0, -0.45]} color={look.top} skin={look.skin} />
      </group>
    </group>
  )
}

function Limb({ position, color, args }: { position: Vec; color: string; args: [number, number] }) {
  return (
    <mesh position={position} castShadow>
      <capsuleGeometry args={[args[0], args[1], 4, 8]} />
      <meshStandardMaterial color={color} roughness={0.65} />
    </mesh>
  )
}

function Arm({
  position,
  rotation,
  color,
  skin,
}: {
  position: Vec
  rotation: Vec
  color: string
  skin: string
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, -0.24, 0]} castShadow>
        <capsuleGeometry args={[0.07, 0.28, 4, 8]} />
        <meshStandardMaterial color={color} roughness={0.62} />
      </mesh>
      <mesh position={[0, -0.46, 0]}>
        <sphereGeometry args={[0.075, 12, 12]} />
        <meshStandardMaterial color={skin} roughness={0.6} />
      </mesh>
    </group>
  )
}

function Glasses() {
  return (
    <group position={[0, 1.32, 0.38]}>
      <mesh position={[-0.12, 0, 0]}>
        <torusGeometry args={[0.09, 0.012, 8, 18]} />
        <meshStandardMaterial color="#d9fff6" metalness={0.8} roughness={0.15} />
      </mesh>
      <mesh position={[0.12, 0, 0]}>
        <torusGeometry args={[0.09, 0.012, 8, 18]} />
        <meshStandardMaterial color="#d9fff6" metalness={0.8} roughness={0.15} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.08, 0.015, 0.015]} />
        <meshStandardMaterial color="#d9fff6" metalness={0.8} roughness={0.15} />
      </mesh>
    </group>
  )
}

function Headset({ color }: { color: string }) {
  return (
    <group position={[0, 1.36, 0]}>
      <mesh rotation={[0, 0, 0]}>
        <torusGeometry args={[0.38, 0.025, 8, 24, Math.PI]} />
        <meshStandardMaterial color={color} metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[0.34, -0.08, 0.12]}>
        <boxGeometry args={[0.06, 0.12, 0.08]} />
        <meshStandardMaterial color="#10151c" />
      </mesh>
    </group>
  )
}

type Vec = [number, number, number]
