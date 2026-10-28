/** Strip phone-like sequences before anything is shown in the UI. */
export function redact(input: string): string {
  return input
    .replace(/\+\d[\d\s()-]{7,}\d/g, '•••')
    .replace(/\b\d{8,}\b/g, '•••')
    .replace(/\s+/g, ' ')
    .trim()
}

export function taskLabel(taskType: string, input: unknown): string {
  let raw = taskType.replace(/_/g, ' ')
  if (input && typeof input === 'object') {
    const row = input as Record<string, unknown>
    if (typeof row.message === 'string' && row.message.trim()) raw = row.message
    else if (typeof row.job === 'string' && row.job.trim()) raw = row.job.replace(/_/g, ' ')
  }
  const clean = redact(raw)
  if (!clean) return taskType
  return clean.length > 140 ? `${clean.slice(0, 137)}…` : clean
}
