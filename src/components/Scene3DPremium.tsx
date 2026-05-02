import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Float, Sparkles } from '@react-three/drei'
import * as THREE from 'three'

interface AgentProps {
  position: [number, number, number]
  label: string
  color: string
  state: 'idle' | 'running' | 'error'
  cost: number
}

const AgentMesh = ({ position, label, color, state, cost }: AgentProps) => {
  const meshRef = useRef<THREE.Mesh>(null)
  const groupRef = useRef<THREE.Group>(null)
  const isRunning = state === 'running'
  const isError = state === 'error'

  useFrame((state) => {
    if (meshRef.current && groupRef.current) {
      // Smooth rotation
      meshRef.current.rotation.x += 0.002
      meshRef.current.rotation.y += 0.0015
      
      // Pulsing animation for running state
      if (isRunning) {
        const pulse = 1 + Math.sin(state.clock.elapsedTime * 2.5) * 0.15
        meshRef.current.scale.set(pulse, pulse, pulse)
      } else {
        meshRef.current.scale.set(1, 1, 1)
      }
      
      // Bobbing motion
      groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 1.2) * 0.15
    }
  })

  const baseColor = isError ? '#ef4444' : color
  const emissiveIntensity = isRunning ? 0.8 : isError ? 0.6 : 0.4

  return (
    <Float speed={1.5} rotationIntensity={0} floatIntensity={0} ref={groupRef}>
      <group position={position}>
        {/* Icosahedron mesh with metallic material */}
        <mesh ref={meshRef}>
          <icosahedronGeometry args={[0.6, 4]} />
          <meshStandardMaterial
            color={baseColor}
            emissive={baseColor}
            emissiveIntensity={emissiveIntensity}
            metalness={0.8}
            roughness={0.2}
            wireframe={isError}
          />
        </mesh>

        {/* Glow sphere (larger, transparent) */}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.9, 32, 32]} />
          <meshBasicMaterial
            color={baseColor}
            transparent
            opacity={isRunning ? 0.3 : 0.1}
            wireframe={false}
          />
        </mesh>

        {/* Rotating ring */}
        <mesh rotation={[Math.PI / 2.5, 0, 0]}>
          <torusGeometry args={[1.1, 0.06, 32, 100]} />
          <meshPhongMaterial
            color={baseColor}
            emissive={baseColor}
            emissiveIntensity={0.6}
          />
        </mesh>

        {/* Label */}
        <Text
          position={[0, -1.4, 0]}
          fontSize={0.45}
          color="white"
          anchorY="top"
          fontWeight="bold"
          maxWidth={2}
        >
          {label}
        </Text>

        {/* Status badge */}
        <Text
          position={[0, -1.85, 0]}
          fontSize={0.28}
          color={isRunning ? '#10b981' : isError ? '#ef4444' : '#9ca3af'}
          anchorY="top"
          fontWeight="600"
        >
          {state.toUpperCase()}
        </Text>

        {/* Cost ticker */}
        <Text
          position={[0, -2.2, 0]}
          fontSize={0.22}
          color={cost > 0.01 ? '#fbbf24' : '#6b7280'}
          anchorY="top"
          fontWeight="500"
        >
          ${cost.toFixed(4)}
        </Text>

        {/* Particles when running */}
        {isRunning && (
          <Sparkles
            count={20}
            scale={1.5}
            size={0.4}
            speed={0.5}
            color={baseColor}
          />
        )}
      </group>
    </Float>
  )
}

interface ConnectionProps {
  from: [number, number, number]
  to: [number, number, number]
  active: boolean
  color: string
}

const Connection = ({ from, to, active, color }: ConnectionProps) => {
  const lineRef = useRef<THREE.Line>(null)
  const tubeRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (tubeRef.current && active) {
      // Pulsing material
      const pulseMaterial = tubeRef.current.material as THREE.Material
      if ('emissiveIntensity' in pulseMaterial) {
        (pulseMaterial as any).emissiveIntensity = 0.6 + Math.sin(state.clock.elapsedTime * 3) * 0.4
      }
    }
  })

  // Calculate curve points for a nice bezier-like connection
  const midX = (from[0] + to[0]) / 2
  const midY = Math.max(from[1], to[1]) + 1.5
  const midZ = (from[2] + to[2]) / 2

  return (
    <group>
      {/* Animated tube */}
      <mesh ref={tubeRef} position={[(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2]}>
        <cylinderGeometry
          args={[0.08, 0.08, new THREE.Vector3(...from).distanceTo(new THREE.Vector3(...to)), 8, 1]}
        />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={active ? 0.6 : 0.2}
          metalness={0.9}
          roughness={0.1}
          transparent
          opacity={active ? 0.9 : 0.3}
        />
      </mesh>

      {/* Simple line for connectivity indicator */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([...from, ...to])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color={color}
          linewidth={2}
          transparent
          opacity={active ? 0.8 : 0.2}
        />
      </line>
    </group>
  )
}

interface Scene3DProps {
  agentStates: {
    [agent: string]: 'idle' | 'running' | 'error'
  }
  costs?: {
    [agent: string]: number
  }
  handoffs?: {
    from: string
    to: string
    active: boolean
  }[]
}

export default function Scene3DPremium({ agentStates, costs = {}, handoffs = [] }: Scene3DProps) {
  const agents: AgentProps[] = useMemo(
    () => [
      {
        position: [0, 0, 0],
        label: 'HERMES',
        color: '#0ea5e9',
        state: agentStates.hermes || 'idle',
        cost: costs.hermes || 0
      },
      {
        position: [6, 2, 0],
        label: 'ORBIT',
        color: '#a855f7',
        state: agentStates.orbit || 'idle',
        cost: costs.orbit || 0
      },
      {
        position: [-6, 2, 0],
        label: 'SUBAGENT-1',
        color: '#10b981',
        state: agentStates.subagent1 || 'idle',
        cost: costs.subagent1 || 0
      },
      {
        position: [0, 6, 0],
        label: 'SUBAGENT-2',
        color: '#f59e0b',
        state: agentStates.subagent2 || 'idle',
        cost: costs.subagent2 || 0
      }
    ],
    [agentStates, costs]
  )

  const connections = useMemo(
    () => [
      {
        from: agents[0].position,
        to: agents[1].position,
        active: handoffs.some((h) => h.from === 'hermes' && h.to === 'orbit' && h.active),
        color: '#06b6d4'
      },
      {
        from: agents[0].position,
        to: agents[2].position,
        active: handoffs.some((h) => h.from === 'hermes' && h.to === 'subagent1' && h.active),
        color: '#06b6d4'
      },
      {
        from: agents[0].position,
        to: agents[3].position,
        active: handoffs.some((h) => h.from === 'hermes' && h.to === 'subagent2' && h.active),
        color: '#06b6d4'
      },
      {
        from: agents[1].position,
        to: agents[2].position,
        active: handoffs.some((h) => h.from === 'orbit' && h.to === 'subagent1' && h.active),
        color: '#a855f7'
      }
    ],
    [agents, handoffs]
  )

  return (
    <>
      {/* Environment: Grid floor */}
      <gridHelper args={[50, 50]} position={[0, -0.5, 0]} />

      {/* Environment: Lighting */}
      <hemisphereLight args={['#0f172a', '#1e293b', 0.5]} />
      <pointLight position={[10, 10, 10]} intensity={0.8} color="#0ea5e9" />
      <pointLight position={[-10, 10, 10]} intensity={0.8} color="#a855f7" />
      <pointLight position={[0, 15, 0]} intensity={1} color="#ffffff" />
      <ambientLight intensity={0.3} />

      {/* Fog for depth */}
      <fog attach="fog" args={['#000000', 15, 80]} />

      {/* Agents */}
      {agents.map((agent, i) => (
        <AgentMesh
          key={i}
          position={agent.position}
          label={agent.label}
          color={agent.color}
          state={agent.state}
          cost={agent.cost}
        />
      ))}

      {/* Connections */}
      {connections.map((conn, i) => (
        <Connection
          key={i}
          from={conn.from}
          to={conn.to}
          active={conn.active}
          color={conn.color}
        />
      ))}

      {/* Ambient particles */}
      <Sparkles
        count={100}
        scale={30}
        size={1}
        speed={0.3}
        color="#ffffff"
        opacity={0.1}
      />
    </>
  )
}
