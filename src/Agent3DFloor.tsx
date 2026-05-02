import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'

interface Agent3DProps {
  agents: {
    hermes: string
    orbit: string
    subagent1: string
    subagent2: string
  }
  costs: {
    hermes: number
    orbit: number
  }
  handoffs: Array<{ from: string; to: string; active: boolean }>
}

export function Agent3DFloor(props: Agent3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const camerRef = useRef<THREE.Camera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const agentsRef = useRef<Map<string, THREE.Group>>(new Map())
  const linesRef = useRef<THREE.LineSegments[]>([])

  useEffect(() => {
    if (!containerRef.current) return

    // ==================== SCENE SETUP ====================
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x000000)
    sceneRef.current = scene

    // ==================== CAMERA ====================
    const width = containerRef.current.clientWidth
    const height = containerRef.current.clientHeight
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
    camera.position.set(0, 15, 20)
    camera.lookAt(0, 0, 0)
    camerRef.current = camera

    // ==================== RENDERER ====================
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // ==================== LIGHTING ====================
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)

    const pointLight = new THREE.PointLight(0xffffff, 1)
    pointLight.position.set(20, 30, 20)
    scene.add(pointLight)

    // ==================== GROUND PLANE ====================
    const groundGeometry = new THREE.PlaneGeometry(60, 60)
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.8
    })
    const ground = new THREE.Mesh(groundGeometry, groundMaterial)
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    scene.add(ground)

    // ==================== CREATE AGENTS ====================
    const createAgent = (name: string, x: number, z: number, color: number) => {
      const group = new THREE.Group()

      // Main sphere
      const geometry = new THREE.SphereGeometry(2, 32, 32)
      const material = new THREE.MeshStandardMaterial({
        color,
        metalness: 0.7,
        roughness: 0.2,
        emissive: color,
        emissiveIntensity: 0.2
      })
      const sphere = new THREE.Mesh(geometry, material)
      sphere.position.y = 2
      group.add(sphere)

      // Ring/Status indicator
      const ringGeometry = new THREE.TorusGeometry(2.5, 0.3, 32, 100)
      const ringMaterial = new THREE.MeshStandardMaterial({
        color: 0x00ff00,
        emissive: 0x00ff00,
        emissiveIntensity: 0.8
      })
      const ring = new THREE.Mesh(ringGeometry, ringMaterial)
      ring.position.y = 2
      ring.rotation.x = Math.PI / 4
      group.add(ring)

      // Label
      const label = document.createElement('div')
      label.style.position = 'absolute'
      label.style.color = '#ffffff'
      label.style.fontSize = '16px'
      label.style.fontWeight = 'bold'
      label.style.pointerEvents = 'none'
      label.textContent = name
      ;(group as any).labelElement = label

      group.position.set(x, 0, z)
      agentsRef.current.set(name, group)
      scene.add(group)
    }

    // Create 4 agents in a square formation
    createAgent('HERMES', -15, -15, 0x00ffff)    // Cyan
    createAgent('ORBIT', 15, -15, 0xff00ff)       // Magenta
    createAgent('SubAgent1', -15, 15, 0xffff00)   // Yellow
    createAgent('SubAgent2', 15, 15, 0x00ff00)    // Green

    // ==================== ANIMATION LOOP ====================
    const clock = new THREE.Clock()
    let handoffProgress = 0
    let handoffActive = false

    const animate = () => {
      requestAnimationFrame(animate)

      const time = clock.getElapsedTime()

      // Update agent states
      Object.entries(props.agents).forEach(([name, state]) => {
        const agent = agentsRef.current.get(name.toUpperCase())
        if (!agent) return

        const sphere = agent.children[0] as THREE.Mesh
        const ring = agent.children[1] as THREE.Mesh

        // Pulse when executing
        if (state === 'executing') {
          const scale = 1 + Math.sin(time * 4) * 0.1
          sphere.scale.set(scale, scale, scale)
          ;(ring.material as THREE.Material).opacity = Math.sin(time * 4) * 0.5 + 0.5
        } else {
          sphere.scale.set(1, 1, 1)
          ;(ring.material as THREE.Material).opacity = 0.3
        }

        // Rotate orbit
        agent.rotation.y += 0.01
      })

      // Draw handoff connections
      linesRef.current.forEach(line => scene.remove(line))
      linesRef.current = []

      props.handoffs.forEach(handoff => {
        const from = agentsRef.current.get(handoff.from.toUpperCase())
        const to = agentsRef.current.get(handoff.to.toUpperCase())

        if (!from || !to) return

        const points = [
          from.position.clone().add(new THREE.Vector3(0, 2, 0)),
          to.position.clone().add(new THREE.Vector3(0, 2, 0))
        ]

        const geometry = new THREE.BufferGeometry().setFromPoints(points)
        const material = new THREE.LineBasicMaterial({
          color: handoff.active ? 0xff0000 : 0x00ff00,
          linewidth: 3
        })
        const line = new THREE.LineSegments(geometry, material)
        scene.add(line)
        linesRef.current.push(line)
      })

      renderer.render(scene, camera)
    }

    animate()

    // ==================== CLEANUP ====================
    return () => {
      renderer.dispose()
      containerRef.current?.removeChild(renderer.domElement)
    }
  }, [props.agents, props.costs, props.handoffs])

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-black rounded-lg border border-cyan-500/30"
      style={{ minHeight: '600px' }}
    />
  )
}
