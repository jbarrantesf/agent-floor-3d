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

  useEffect(() => {
    if (!containerRef.current) {
      console.log('❌ No container ref')
      return
    }

    console.log('✅ Agent3DFloor mounted', {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight
    })

    // Wait for container to have size
    if (containerRef.current.clientHeight === 0) {
      console.log('⏳ Waiting for container size...')
      const timer = setTimeout(() => {
        window.dispatchEvent(new Event('resize'))
      }, 300)
      return () => clearTimeout(timer)
    }

    // Initialize THREE.js scene
    const width = containerRef.current.clientWidth
    const height = containerRef.current.clientHeight

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0e27)

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
    camera.position.set(0, 20, 25)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.shadowMap.enabled = true

    containerRef.current.appendChild(renderer.domElement)

    // Add some lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(10, 20, 10)
    directionalLight.castShadow = true
    scene.add(directionalLight)

    // Create agents as colored spheres
    const agents = [
      { name: 'Hermes', pos: [-10, 5, 0], color: 0x00ffff },
      { name: 'ORBIT', pos: [10, 5, 0], color: 0xff00ff },
      { name: 'Subagent 1', pos: [-5, 5, -10], color: 0xffff00 },
      { name: 'Subagent 2', pos: [5, 5, -10], color: 0x00ff00 }
    ]

    agents.forEach((agent) => {
      const geometry = new THREE.SphereGeometry(2, 32, 32)
      const material = new THREE.MeshStandardMaterial({ color: agent.color, emissive: agent.color, emissiveIntensity: 0.3 })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(...(agent.pos as [number, number, number]))
      mesh.castShadow = true
      mesh.receiveShadow = true
      scene.add(mesh)
    })

    // Add floor plane
    const floorGeometry = new THREE.PlaneGeometry(50, 50)
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x1a2d4d })
    const floor = new THREE.Mesh(floorGeometry, floorMaterial)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)

    // Animation loop
    let animationId: number

    const animate = () => {
      animationId = requestAnimationFrame(animate)

      // Rotate agents
      scene.children.forEach((child) => {
        if (child instanceof THREE.Mesh && child !== floor) {
          child.rotation.y += 0.005
        }
      })

      renderer.render(scene, camera)
    }

    animate()

    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current) return
      const newWidth = containerRef.current.clientWidth
      const newHeight = containerRef.current.clientHeight

      if (newHeight > 0) {
        camera.aspect = newWidth / newHeight
        camera.updateProjectionMatrix()
        renderer.setSize(newWidth, newHeight)
      }
    }

    window.addEventListener('resize', handleResize)

    console.log('🎨 3D Scene initialized successfully')

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationId)
      renderer.dispose()
      if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%'
      }}
    />
  )
}
