import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { ContactShadows, MeshReflectorMaterial } from '@react-three/drei'
import * as THREE from 'three'
import { STAGE } from '../layout'
import { floorTexture, hazardTexture, wallTexture } from './textures'

export function Room() {
  const floorMap = useMemo(() => floorTexture(), [])
  const wallMap = useMemo(() => wallTexture(), [])
  const glow = useRef<THREE.MeshBasicMaterial>(null)

  useFrame((state) => {
    if (!glow.current) return
    glow.current.opacity = 0.22 + Math.sin(state.clock.elapsedTime * 1.3) * 0.05
  })

  return (
    <group>
      <color attach="background" args={['#07090d']} />
      <fog attach="fog" args={['#07090d', 18, 42]} />
      <hemisphereLight args={['#1c4650', '#07080b', 0.55]} />
      <directionalLight
        position={[6, 9, 8]}
        intensity={3.4}
        color="#e7eef8"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={32}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-7, 4, 3]} intensity={0.7} color="#7ef0d4" />
      <directionalLight position={[0, 5, -8]} intensity={0.85} color="#9ad8ff" />
      <pointLight position={[0, 0.35, 0]} intensity={18} distance={9} color="#2dffc8" decay={2} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 32]} />
        <meshStandardMaterial map={floorMap} metalness={0.55} roughness={0.48} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} scale={[1.55, 1, 1]}>
        <ringGeometry args={[5.15, 6.55, 72]} />
        <meshBasicMaterial
          ref={glow}
          color="#1dffc4"
          transparent
          opacity={0.24}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, STAGE.d / 2 + 0.08]}>
        <planeGeometry args={[STAGE.w - 0.4, 0.42]} />
        <meshBasicMaterial color="#46ffd2" transparent opacity={0.4} toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      <Platform />

      <Wall position={[0, 3.1, -7.15]} args={[26, 6.2, 0.28]} map={wallMap} />
      <Wall position={[-12.4, 3.1, 1.2]} args={[0.28, 6.2, 18]} map={wallMap} />
      <Wall position={[12.4, 3.1, 1.2]} args={[0.28, 6.2, 18]} map={wallMap} />
      <mesh position={[0, 6.15, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[26, 18]} />
        <meshStandardMaterial color="#0c1016" roughness={0.85} metalness={0.3} />
      </mesh>
      {[-6, 0, 6].map((x) => (
        <mesh key={x} position={[x, 6.05, -1]}>
          <boxGeometry args={[1.6, 0.06, 0.35]} />
          <meshBasicMaterial color="#9eb0c2" toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[0, 5.2, -7]}>
        <boxGeometry args={[18, 0.08, 0.12]} />
        <meshStandardMaterial color="#1a222c" metalness={0.7} roughness={0.35} />
      </mesh>

      <ContactShadows position={[0, STAGE.y + 0.02, 0]} opacity={0.45} scale={22} blur={2.4} far={4} color="#000000" />
    </group>
  )
}

function Wall({ position, args, map }: { position: Vec; args: Vec; map: THREE.CanvasTexture }) {
  return (
    <mesh position={position} receiveShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial map={map} metalness={0.48} roughness={0.62} />
    </mesh>
  )
}

function Platform() {
  const { w, d, y } = STAGE
  return (
    <group>
      <mesh position={[0, y - 0.28, 0]} receiveShadow castShadow>
        <boxGeometry args={[w - 0.2, 0.42, d - 0.2]} />
        <meshStandardMaterial color="#1a212b" metalness={0.62} roughness={0.38} />
      </mesh>
      <Hazard position={[0, y - 0.22, d / 2]} args={[w, 0.52, 0.18]} repeat={[18, 1]} />
      <Hazard position={[0, y - 0.22, -d / 2]} args={[w, 0.52, 0.18]} repeat={[18, 1]} />
      <Hazard position={[-w / 2, y - 0.22, 0]} args={[0.18, 0.52, d]} repeat={[10, 1]} />
      <Hazard position={[w / 2, y - 0.22, 0]} args={[0.18, 0.52, d]} repeat={[10, 1]} />
      <Hazard position={[0, y + 0.015, d / 2 - 0.18]} args={[w, 0.045, 0.36]} repeat={[22, 1]} />
      <Hazard position={[0, y + 0.015, -d / 2 + 0.18]} args={[w, 0.045, 0.36]} repeat={[22, 1]} />
      <Hazard position={[-w / 2 + 0.18, y + 0.015, 0]} args={[0.36, 0.045, d - 0.7]} repeat={[12, 1]} />
      <Hazard position={[w / 2 - 0.18, y + 0.015, 0]} args={[0.36, 0.045, d - 0.7]} repeat={[12, 1]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y + 0.03, 0]}>
        <planeGeometry args={[w - 0.78, d - 0.78]} />
        <MeshReflectorMaterial
          mirror={0.78}
          blur={[240, 60]}
          resolution={768}
          mixBlur={0.85}
          mixStrength={2.1}
          roughness={0.35}
          depthScale={1.1}
          minDepthThreshold={0.35}
          maxDepthThreshold={1.35}
          color="#101820"
          metalness={0.72}
        />
      </mesh>
    </group>
  )
}

function Hazard({ position, args, repeat }: { position: Vec; args: Vec; repeat: [number, number] }) {
  const map = useMemo(() => hazardTexture(repeat[0], repeat[1]), [repeat[0], repeat[1]])
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial
        map={map}
        emissive="#ffb000"
        emissiveMap={map}
        emissiveIntensity={0.42}
        roughness={0.38}
        metalness={0.08}
      />
    </mesh>
  )
}

type Vec = [number, number, number]
