export default function StatusBar({ wsConnected }: any) {
  return (
    <div className="absolute top-4 right-4 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
        <span className="text-slate-400">
          {wsConnected ? 'Connected' : 'Reconnecting...'}
        </span>
      </div>
      <div className="text-slate-600 text-xxs mt-1">
        Mission Control Alpha v0.1
      </div>
    </div>
  )
}
