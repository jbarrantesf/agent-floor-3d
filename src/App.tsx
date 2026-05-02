import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Grid } from '@react-three/drei'
import Scene3D from './components/Scene3D'
import Dashboard from './components/Dashboard'
import EventTicker from './components/EventTicker'
import StatusBar from './components/StatusBar'

export default function App() {
  const [events, setEvents] = useState<any[]>([])
  const [costs, setCosts] = useState({ hermes: 0.0, orbit: 0.0 })
  const [wsConnected, setWsConnected] = useState(false)
  const [agentStates, setAgentStates] = useState({
    hermes: 'idle',
    orbit: 'idle',
    subagent1: 'idle',
    subagent2: 'idle'
  })

  useEffect(() => {
    // WebSocket connection
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001'
    const ws = new WebSocket(wsUrl)
    
    ws.onopen = () => {
      console.log('✅ WebSocket connected')
      setWsConnected(true)
    }
    
    ws.onerror = (e) => {
      console.error('❌ WebSocket error:', e)
      setWsConnected(false)
    }
    
    ws.onclose = () => {
      console.log('🔌 WebSocket disconnected')
      setWsConnected(false)
    }
    
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        
        if (data.type === 'event') {
          setEvents(prev => [data, ...prev].slice(0, 15))
        }
        
        if (data.type === 'costs') {
          setCosts(data.payload)
        }
        
        if (data.type === 'agent-state') {
          setAgentStates(data.payload)
        }
      } catch (err) {
        console.error('Parse error:', err)
      }
    }

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close()
      }
    }
  }, [])

  return (
    <div className="h-screen w-screen flex flex-col bg-black overflow-hidden">
      {/* 3D Cockpit */}
      <div className="flex-1 relative bg-black">
        <Canvas dpr={[1, 2]}>
          <PerspectiveCamera position={[0, 5, 20]} makeDefault fov={75} />
          <OrbitControls 
            enableDamping 
            dampingFactor={0.05}
            autoRotate
            autoRotateSpeed={0.5}
          />
          
          <color attach="background" args={['#000000']} />
          <fog attach="fog" args={['#000000', 20, 100]} />
          
          <gridHelper args={[60, 60]} position={[0, -2, 0]} />
          
          <ambientLight intensity={0.3} />
          <pointLight position={[10, 15, 10]} intensity={1} />
          <pointLight position={[-10, 15, -10]} intensity={0.5} color="#0ea5e9" />
          
          <Scene3D agentStates={agentStates} />
        </Canvas>
        
        {/* Top-right status */}
        <StatusBar wsConnected={wsConnected} />
      </div>

      {/* Dashboard */}
      <div className="h-32 bg-gradient-to-b from-slate-950 to-black border-t border-slate-800 flex gap-4 p-4 overflow-x-auto">
        <Dashboard costs={costs} agentStates={agentStates} />
      </div>

      {/* Event Ticker */}
      <div className="h-24 bg-black border-t border-slate-800 p-3 overflow-hidden">
        <EventTicker events={events} />
      </div>
    </div>
  )
}
