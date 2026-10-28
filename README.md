# NexAI · Agent Floor 3D

Interactive command floor for **NexAI Solutions CR**. Five stations on a dark industrial platform, holographic panels, work bubbles, and a profile card with a short “Pregúntale” chat.

The look is an original NexAI lab: metallic room, yellow/black hazard lip, green and blue holograms, stylized agents. It does not use the NVIDIA logo or any celebrity likeness.

Older phase notes in this repo (`PHASE*.md`, `docs/hermes-orbit-shared/`) describe a previous cube-floor plan. This MVP replaces that visual. Those files are historical.

## Run locally

```bash
npm install
cp .env.example .env
# fill VITE_SUPABASE_ANON_KEY — never commit it
npm run dev
```

Open `http://localhost:5173`. The same app is served at `/agent-floor` (the host must rewrite unknown paths to `index.html`; Vite and `vercel.json` do).

```bash
npm run build
npm run test:floor
```

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | yes, for live data | `https://cpsdpmekmtqevvrmahds.supabase.co` (project **aios-control-tower**) |
| `VITE_SUPABASE_ANON_KEY` | yes, for live data | Publishable or legacy anon key. Not the service role. |
| `VITE_SUPABASE_ACCESS_TOKEN` | no | User JWT. `agents`, `agent_tasks`, `alerts`, and `kpi_values` are protected by RLS (`authenticated` + `current_org()`). The anon key alone cannot read them. |
| `VITE_LLM_API_KEY` | no | Enables “Pregúntale” against an OpenAI-compatible chat API. |
| `VITE_LLM_BASE_URL` | no | Default `https://api.openai.com/v1`. |
| `VITE_LLM_MODEL` | no | Default `gpt-4o-mini`. |

The retired Supabase project `aybxrgvvwpknkoqrevqa` is not used.

If the anon key cannot read the tables, the floor shows a **sanitized snapshot from 28 Oct 2026** (agent names, roles, task titles, alerts, KPIs, aiMae config). Customer phone numbers and raw chat bodies are not in that snapshot. The top bar says **Instantánea** and explains why. A successful read says **Torre en vivo**.

## Stations

| Puesto | Source when the tower has the current rows |
| --- | --- |
| CEO | Orbit |
| Ejecutivo | NexAI |
| Operaciones | Hermes |
| aiMae | Demo badge. Copy comes from `aimae_config` when that row is readable. There is no `agents` row named aiMae. |
| Diagnóstico | Demo badge (**DX Nova**) until an agent name maps to diagnóstico. The bubble watches open alerts. |

`Secuencias` stays in the tower data but has no station. The header lists it as “Sin estación”.

Click a station (or press 1–5) to focus the camera and open the card. Escape or “Vista general” returns to the orbit view. There is no walking pathfinding and no multiplayer.

## Preview vs production

Deploy a **protected preview** only. Do not promote this app to production and do not attach or change custom domains unless that was asked for explicitly.

Keep Vercel Deployment Protection on. A preview URL still ships the anon key inside the browser bundle; RLS is what keeps tower rows private. Do not put a user JWT or the service role in `VITE_*`.

How the Control Tower should link here: [INTEGRATION.md](./INTEGRATION.md).

## Stack

React 18, Vite, Three.js, React Three Fiber, drei. Supabase JS reads the tower. No keys belong in git.
