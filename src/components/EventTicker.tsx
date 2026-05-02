export default function EventTicker({ events }: any) {
  return (
    <div className="flex flex-col gap-0.5 text-slate-400 text-xxs font-mono overflow-y-auto h-full scrollbar-thin">
      {events.length === 0 ? (
        <div className="text-slate-600 italic py-2">⏳ Waiting for events...</div>
      ) : (
        events.map((e: any, i: number) => (
          <div key={i} className="flex gap-3 text-slate-300 hover:text-white transition hover:bg-slate-900/30 px-2 py-0.5 rounded">
            <span className="text-slate-500 flex-shrink-0">
              {new Date(e.timestamp || Date.now()).toLocaleTimeString('en-US', { hour12: false })}
            </span>
            <span className={`flex-shrink-0 w-12 uppercase font-bold ${
              e.type === 'handoff' ? 'text-blue-400' :
              e.type === 'approval' ? 'text-green-400' :
              e.type === 'error' ? 'text-red-400' :
              'text-slate-400'
            }`}>
              {e.type}
            </span>
            <span className="flex-1 truncate text-slate-200">{e.message}</span>
          </div>
        ))
      )}
    </div>
  )
}
