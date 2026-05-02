import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Sphere } from '@react-three/drei'
import * as THREE from 'three'

interface Agent {
  position: [number, number, number]
  label: string
  color: string
  state: string
}

const AgentMesh = ({ position, label, color, state }: any) => {
  const meshRef = useRef<THREE.Mesh>(null)
  const isRunning = state === 'running'
  const isError = state === 'error'
  
  useFrame((state) => {
    if (meshRef.current) {
      // Pulse animation for running agents
      if (isRunning) {
        const scale = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.1
        meshRef.current.scale.set(scale, scale, scale)
      } else {
        meshRef.current.scale.set(1, 1, 1)
      }
    }
  })

  const baseColor = isError ? '#ef4444' : color
  const emissiveColor = isError ? '#dc2626' : color

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.7, 32, 32]} />
        <meshPhongMaterial 
          color={baseColor}
          emissive={emissiveColor}
          emissiveIntensity={isRunning ? 0.6 : 0.3}
          wireframe={isError}
        />
      </mesh>
      
      {/* Status ring */}
      <mesh position={[0, 0.01, 0]}>
        <torusGeometry args={[1, 0.08, 32, 100]} />
        <meshBasicMaterial 
          color={baseColor}
          transparent
          opacity={isRunning ? 0.8 : 0.4}
        />
      </mesh>
      
      {/* Label */}
      <Text 
        position={[0, -1.3, 0]} 
        fontSize={0.5} 
        color="white" 
        anchorY="top"
        fontWeight="bold"
      >
        {label}
      </Text>
      
      {/* Status indicator */}
      <Text 
        position={[0, -1.7, 0]} 
        fontSize={0.3} 
        color={isRunning ? '#10b981' : isError ? '#ef4444' : '#9ca3af'}
        anchorY="top"
      >
        {state.toUpperCase()}
      </Text>
    </group>
  )
}

export default function Scene3D({ agentStates }: any) {
  const agents: Agent[] = [
    { position: [0, 0, 0], label: 'HERMES', color: '#0ea5e9', state: agentStates.hermes },
    { position: [6, 2, 0], label: 'ORBIT', color: '#a855f7', state: agentStates.orbit },
    { position: [-6, 2, 0], label: 'SUBAGENT-1', color: '#10b981', state: agentStates.subagent1 },
    { position: [0, 6, 0], label: 'SUBAGENT-2', color: '#f59e0b', state: agentStates.subagent2 },
  ]

  return (
    <>
      {agents.map((agent, i) => (
        <AgentMesh
          key={i}
          position={agent.position}
          label={agent.label}
          color={agent.color}
          state={agent.state}
        />
      ))}
      
      {/* Connection lines between agents */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={8}
            array={new Float32Array([0,0,0, 6,2,0, 0,0,0, -6,2,0, 0,0,0, 0,6,0, 6,2,0, -6,2,0])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#334155" linewidth={1} transparent opacity={0.3} />
      </line>
    </>
  )
}
