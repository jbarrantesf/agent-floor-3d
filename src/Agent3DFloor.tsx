import React, { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import Scene3DPremium from './components/Scene3DPremium'

interface Agent3DProps {
  agents: {
    hermes: 'idle' | 'running' | 'error'
    orbit: 'idle' | 'running' | 'error'
    subagent1: 'idle' | 'running' | 'error'
    subagent2: 'idle' | 'running' | 'error'
  }
  costs: {
    hermes: number
    orbit: number
    [key: string]: number
  }
  handoffs: Array<{ from: string; to: string; active: boolean }>
}

function LoadingFallback() {
  return (
    <mesh position={[0, 0, 0]}>
      <sphereGeometry args={[0.5, 32, 32]} />
      <meshBasicMaterial color="#0ea5e9" wireframe />
    </mesh>
  )
}

export function Agent3DFloor({ agents, costs, handoffs }: Agent3DProps) {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{
          position: [0, 3, 5],
          fov: 85,
          far: 100
        }}
        gl={{
          antialias: true,
          alpha: true,
          logarithmicDepthBuffer: true
        }}
        style={{
          width: '100%',
          height: '100%'
        }}
      >
        {/* Controls */}
        <OrbitControls
          autoRotate
          autoRotateSpeed={2}
          minDistance={8}
          maxDistance={30}
          dampingFactor={0.05}
          enableDamping
        />

        {/* Scene */}
        <Suspense fallback={<LoadingFallback />}>
          <Scene3DPremium
            agentStates={agents}
            costs={costs}
            handoffs={handoffs}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}
