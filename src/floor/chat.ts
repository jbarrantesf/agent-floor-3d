import type { FloorStation } from './types'

function systemPrompt(station: FloorStation): string {
  const tasks = station.tasks
    .map((task) => `- ${task.label} (${task.status})`)
    .join('\n')
  return [
    `Eres ${station.agentName}, ${station.role}, en la estación ${station.label} de Agent Floor 3D de NexAI Solutions CR.`,
    station.summary,
    station.prompt ? `Prompt de sistema: ${station.prompt}` : '',
    `Trabajo actual: ${station.current.title}. ${station.current.detail}`,
    station.partner ? `Colaboras con ${station.partner.name} en: ${station.partner.label}.` : '',
    tasks ? `Tareas recientes:\n${tasks}` : 'No hay tareas recientes.',
    'Responde en español, breve, en primera persona. No inventes cifras que no estén en este contexto. Si no sabes, dilo.',
  ]
    .filter(Boolean)
    .join('\n')
}

function stubAnswer(station: FloorStation, question: string): string {
  const normalized = question.toLowerCase()
  if (/colabor|handoff|junto/.test(normalized) && station.partner) {
    return `Estoy en la misma consulta que ${station.partner.name}: ${station.partner.label}.`
  }
  if (/tarea|haciendo|curso|trabaj/.test(normalized)) {
    return `${station.current.title}. ${station.current.detail}`.trim()
  }
  if (/alerta/.test(normalized)) {
    return station.current.kind === 'alert'
      ? `Estoy vigilando: ${station.current.title}.`
      : 'No tengo una alerta asignada en este puesto. Diagnóstico vigila las abiertas de la torre.'
  }
  if (/qui[eé]n|qu[eé] haces|rol|puesto|para qu[eé]/.test(normalized)) {
    return `Soy ${station.agentName}, ${station.role} en ${station.label}. ${station.summary}`
  }
  const latest = station.tasks[0]
  const last = latest ? ` Lo último que registré: ${latest.label} (${latest.status}).` : ''
  return `Soy ${station.agentName} en ${station.label}. ${station.summary}${last}`
}

export function llmConfigured(): boolean {
  return Boolean(import.meta.env.VITE_LLM_API_KEY)
}

export async function askStation(station: FloorStation, question: string): Promise<string> {
  const trimmed = question.trim()
  if (!trimmed) return 'Escribe una pregunta.'
  const key = import.meta.env.VITE_LLM_API_KEY as string | undefined
  if (key) {
    try {
      const base = ((import.meta.env.VITE_LLM_BASE_URL as string | undefined) || 'https://api.openai.com/v1').replace(
        /\/$/,
        ''
      )
      const model = (import.meta.env.VITE_LLM_MODEL as string | undefined) || 'gpt-4o-mini'
      const response = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.4,
          messages: [
            { role: 'system', content: systemPrompt(station) },
            { role: 'user', content: trimmed },
          ],
        }),
      })
      if (response.ok) {
        const data = (await response.json()) as { choices?: { message?: { content?: string } }[] }
        const text = data.choices?.[0]?.message?.content
        if (typeof text === 'string' && text.trim()) return text.trim()
      }
    } catch {
      // Local stub covers missing network or a rejected key.
    }
  }
  return stubAnswer(station, trimmed)
}
