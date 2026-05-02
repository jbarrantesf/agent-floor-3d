export default function Dashboard({ costs, agentStates }: any) {
  const totalCost = costs.hermes + costs.orbit
  
  return (
    <>
      <div className="flex-1 min-w-56 bg-gradient-to-br from-slate-900 to-slate-950 rounded border border-blue-900/50 p-4 hover:border-blue-700/80 transition">
        <div className="flex justify-between items-start mb-2">
          <div>
            <div className="text-blue-400 text-xs uppercase tracking-widest font-mono mb-1">Hermes Cost</div>
            <div className="text-white text-3xl font-mono font-bold">${costs.hermes.toFixed(4)}</div>
          </div>
          <div className="text-blue-500/50 text-2xl">🧠</div>
        </div>
        <div className="text-slate-500 text-xs font-mono">Session 2026-05-01</div>
      </div>
      
      <div className="flex-1 min-w-56 bg-gradient-to-br from-slate-900 to-slate-950 rounded border border-purple-900/50 p-4 hover:border-purple-700/80 transition">
        <div className="flex justify-between items-start mb-2">
          <div>
            <div className="text-purple-400 text-xs uppercase tracking-widest font-mono mb-1">ORBIT Cost</div>
            <div className="text-white text-3xl font-mono font-bold">${costs.orbit.toFixed(4)}</div>
          </div>
          <div className="text-purple-500/50 text-2xl">🪐</div>
        </div>
        <div className="text-slate-500 text-xs font-mono">Session 2026-05-01</div>
      </div>
      
      <div className="flex-1 min-w-56 bg-gradient-to-br from-slate-900 to-slate-950 rounded border border-emerald-900/50 p-4 hover:border-emerald-700/80 transition">
        <div className="flex justify-between items-start mb-2">
          <div>
            <div className="text-emerald-400 text-xs uppercase tracking-widest font-mono mb-1">Total Cost</div>
            <div className="text-white text-3xl font-mono font-bold">${totalCost.toFixed(4)}</div>
          </div>
          <div className="text-emerald-500/50 text-2xl">💰</div>
        </div>
        <div className="text-slate-500 text-xs font-mono">Consolidated</div>
      </div>
      
      <div className="flex-1 min-w-56 bg-gradient-to-br from-slate-900 to-slate-950 rounded border border-amber-900/50 p-4 hover:border-amber-700/80 transition">
        <div className="text-amber-400 text-xs uppercase tracking-widest font-mono mb-2">Active States</div>
        <div className="space-y-1 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-blue-300">Hermes</span>
            <span className={agentStates.hermes === 'running' ? 'text-green-400' : agentStates.hermes === 'error' ? 'text-red-400' : 'text-slate-500'}>
              {agentStates.hermes}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-purple-300">ORBIT</span>
            <span className={agentStates.orbit === 'running' ? 'text-green-400' : agentStates.orbit === 'error' ? 'text-red-400' : 'text-slate-500'}>
              {agentStates.orbit}
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
