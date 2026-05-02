# 🚀 PHASE 1 DEPLOYMENT: SQL Schema Setup

**Status:** Ready for Supabase deployment  
**Time:** 10 minutes  
**Complexity:** Copy-paste only

---

## 📋 PREREQUISITOS

✅ Tienes acceso a Supabase  
✅ Ya creaste `nexai-orchestrator-v2` project (o similar)  
✅ Estás autenticado en Supabase

---

## 🎯 PASO 1: Abre Supabase SQL Editor

**Link directo:**
```
https://app.supabase.com/project/aybxrgvvwpknkoqrevqa/sql/new
```

O manualmente:
1. Login en https://app.supabase.com
2. Click en tu proyecto `nexai-orchestrator-v2`
3. Click en el ícono de **SQL Editor** (lado izquierdo)
4. Click en **"New query"** (botón azul arriba)

**Screenshot de referencia:**
```
┌─────────────────────────────────────────────┐
│ Supabase Dashboard                          │
├─────────────────────────────────────────────┤
│ Projects:                                   │
│ ├─ Coybo                                    │
│ ├─ MUNSO                                    │
│ ├─ nexai-mission-board                      │
│ ├─ nexai-orchestrator-v2  ← CLICK HERE      │
│ └─ Sydney Events                            │
└─────────────────────────────────────────────┘

(Inside nexai-orchestrator-v2):
SQL Editor (left sidebar) → New Query (blue button)
```

---

## 🎬 PASO 2: Copiar el SQL Schema

Abre este archivo en tu terminal:

```bash
cat ~/.hermes/plans/PHASE1_SQL_SCHEMA.sql
```

Selecciona TODO el contenido y cópialo a tu clipboard.

**O directamente:**
```bash
cat ~/.hermes/plans/PHASE1_SQL_SCHEMA.sql | pbcopy
```
(macOS: `pbcopy`)  
(Linux: `xclip -selection clipboard`)  
(Windows: `clip`)

---

## 📝 PASO 3: Pegar en Supabase SQL Editor

1. En la ventana de Supabase, haz click en el editor SQL (área grande blanca)
2. Presiona `Cmd+V` (Mac) o `Ctrl+V` (Windows/Linux) para pegar todo
3. Deberías ver ~300 líneas de SQL en el editor

**Verifica que tiene estas secciones:**
```sql
-- TABLE 1: tasks
-- TABLE 2: task_events
-- TABLE 3: agent_capacity
-- TABLE 4: cost_daily_summary
-- ENABLE ROW LEVEL SECURITY
-- ENABLE REALTIME
-- SEED DATA
```

---

## ⚡ PASO 4: Ejecutar SQL

1. En la esquina superior derecha, busca el botón **"Run"** (play icon o "▶ Run")
2. Click en "Run"
3. Espera 10-30 segundos (depende del tamaño)

**Expected output:**
```
✅ Query executed successfully
(no result rows)
```

O puede mostrar:
```
CREATE TABLE
CREATE INDEX
ALTER TABLE
...
```

---

## ✅ PASO 5: Verificar Tablas Creadas

En el mismo SQL editor, corre esta query de verificación:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('tasks', 'task_events', 'agent_capacity', 'cost_daily_summary')
ORDER BY table_name;
```

**Expected output:**
```
table_name
──────────────────────────
agent_capacity
cost_daily_summary
task_events
tasks
```

Si ves estas 4 tablas ✅ → **PHASE 1 COMPLETADA**

---

## 🔍 PASO 6: Verificar Realtime Habilitado

En el mismo SQL editor:

```sql
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';
```

**Expected output:**
```
schemaname │ tablename
────────────┼─────────────────────
public     │ tasks
public     │ task_events
public     │ agent_capacity
```

Si ves estas 3 tablas ✅ → Realtime está habilitado

---

## 🚨 TROUBLESHOOTING

### Error: "Table already exists"
```
ERROR: relation "tasks" already exists
```
**Solución:** Las tablas ya existen. Eso es normal si las creaste antes.
- **Opción A:** Nada que hacer, continuar
- **Opción B:** Si quieres limpiar todo y empezar:
```sql
DROP TABLE IF EXISTS cost_daily_summary CASCADE;
DROP TABLE IF EXISTS task_events CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS agent_capacity CASCADE;
```
Luego pegar y ejecutar el schema completo de nuevo.

### Error: "Function already exists"
```
ERROR: function update_tasks_updated_at already exists
```
**Solución:** Las funciones ya existen. Es normal.
El script usa `CREATE OR REPLACE` así que es seguro re-ejecutar.

### Error: "Permission denied"
```
ERROR: permission denied for schema public
```
**Solución:** Tu usuario no tiene permisos. 
- Verifica que estés usando `supabase_admin` role
- En Supabase UI, esto es automático (está OK)

### Error: "Publication supabase_realtime does not exist"
```
ERROR: publication "supabase_realtime" does not exist
```
**Solución:** Supabase no tiene realtime habilitado.
- Esto es muy raro. Verifica que Supabase está actualizado
- Ignora este error por ahora, funciona igual sin realtime (fallback to polling)

---

## 📊 PASO 7: Test de Datos

Opcionalmente, inserta datos de prueba para verificar que todo funciona:

```sql
-- Insert a test task
INSERT INTO tasks (goal, context, assigned_to, priority, estimated_cost)
VALUES (
  'Test task from PHASE 1',
  'Verify database works',
  'orbit',
  'HIGH',
  0.05
);

-- Verify
SELECT id, goal, status, priority, assigned_to FROM tasks ORDER BY created_at DESC LIMIT 1;
```

**Expected output:**
```
id                                   │ goal                           │ status │ priority │ assigned_to
─────────────────────────────────────┼────────────────────────────────┼────────┼──────────┼─────────────
550e8400-e29b-41d4-a716-446655440000 │ Test task from PHASE 1         │ QUEUED │ HIGH     │ orbit
```

Si ves una fila → **Database works! ✅**

---

## 🎯 FINAL VERIFICATION CHECKLIST

```
☐ Abriste Supabase SQL Editor
☐ Copiaste PHASE1_SQL_SCHEMA.sql
☐ Pegaste en el editor
☐ Ejecutaste el query
☐ Verificaste 4 tablas creadas
☐ Verificaste realtime habilitado
☐ (Opcional) Insertaste datos de prueba
☐ Viste una fila de salida ✅

→ Si checkiste todo: PHASE 1 = COMPLETADA ✅
```

---

## 📞 NEXT STEP

Una vez completados estos pasos:

1. Envía a Hermes: "Phase 1 SQL schema deployed ✅"
2. Avanzamos a **Phase 2: Hermes TaskManager implementation**

---

## 📁 FILES PARA REFERENCIA

- **PHASE1_SQL_SCHEMA.sql** — Schema completo (copia-pega)
- **PHASE1_DEPLOYMENT.md** — Este documento
- **task-delegation-code.md** — TypeScript después

---

**Estimated time:** 10 minutes  
**Difficulty:** Easy (copy-paste)  
**Status:** Ready to go 🚀
