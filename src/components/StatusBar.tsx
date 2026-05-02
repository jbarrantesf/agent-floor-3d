export default function StatusBar({ wsConnected, supabaseConnected }: any) {
  return (
    <div className="absolute top-4 right-4 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono space-y-1.5">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
        <span className="text-slate-400">
          {wsConnected ? 'WebSocket ✓' : 'WS Connecting...'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${supabaseConnected ? 'bg-blue-500 animate-pulse' : 'bg-orange-500'}`} />
        <span className="text-slate-400">
          {supabaseConnected ? 'Supabase ✓' : 'Supabase ✗'}
        </span>
      </div>
      <div className="text-slate-600 text-xxs pt-1 border-t border-slate-700">
        SPRINT 2.5 | Bilateral Comms
      </div>
    </div>
  )
}
