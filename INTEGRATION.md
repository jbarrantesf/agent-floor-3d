# Linking Agent Floor from the Control Tower

This repo is the floor. The Control Tower Vite app is **nexai-aios-control-tower2**, deployed as the Vercel project **nexai-aios-control-tower-v2** (`prj_jUcUuOsE6AqCTmEmvlLf1mGSLOaQ`). This change does not modify that repo.

## URL

The floor is a single page. Both of these are the same view once the host rewrites to `index.html`:

- `/`
- `/agent-floor`

Use the preview origin, for example `https://<preview-host>/agent-floor`. Do not point the nav at a production alias unless someone explicitly promotes a build.

## Nav item

Add one item to the Tower shell. Suggested label: **Agent Floor**.

```tsx
const floorUrl = import.meta.env.VITE_AGENT_FLOOR_URL

// In the Tower's nav config:
{ label: 'Agent Floor', href: floorUrl, external: true }
```

Set `VITE_AGENT_FLOOR_URL` on the Tower project to the protected preview URL. Open it in a new tab so Vercel Deployment Protection can sign the viewer in. That is the reliable path.

## Iframe

An embed works only when the parent can load the preview without an extra login wall:

```tsx
<iframe
  title="Agent Floor 3D"
  src={import.meta.env.VITE_AGENT_FLOOR_URL}
  style={{ width: '100%', height: '100%', border: 0, background: '#07090d' }}
/>
```

This app does not send `X-Frame-Options`. If the preview has Deployment Protection, the iframe usually stops on the Vercel login page. Prefer the nav link in that case. Do not turn protection off to make the iframe work.

## Data

The floor reads `agents`, `agent_tasks`, `alerts`, `kpi_values`, and `aimae_config` from Supabase project **aios-control-tower** (`cpsdpmekmtqevvrmahds`). Those tables (except the config policy shape) require an authenticated org JWT. Until the Tower and the floor share a session, the floor shows the sanitized snapshot and labels demo stations. Do not copy the service role into the floor's client env to get around that.
