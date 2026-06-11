# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

`Esta Locura` es un juego web de draft + simulación del Mundial 2026. El usuario draftea un equipo (eligiendo jugadores reales de selecciones, posicionándolos en una formación) y luego simula un Mundial completo (grupos + eliminación directa). Tiene modo **singleplayer** y **multiplayer** (salas privadas). Idioma del producto y del código/comentarios: español.

## Comandos

```bash
npm run dev          # Next.js dev server (localhost:3000)
npm run build        # next build (úsalo para verificar el proyecto entero)
npx tsc --noEmit     # type-check; es la verificación estándar antes de dar algo por hecho

# Drizzle / DB (Neon Postgres)
npm run db:generate          # genera migración desde schema.ts
npm run db:migrate           # aplica migraciones (prod / DATABASE_URL del entorno)
npm run db:migrate:local     # aplica migraciones leyendo .env.local
npm run db:studio            # Drizzle Studio
npm run db:seed-formations   # siembra las formaciones (correr en prod tras deploy)
npm run db:seed-rosters      # siembra selecciones + jugadores (club, fecha nac., ratings)
```

No hay framework de tests ni script de lint configurado (el progreso registra "0 tests"). La verificación de facto es `npx tsc --noEmit` + smoke test contra la DB real. Los scripts de seed/ETL en `scripts/*.mjs` se corren con `node --env-file=.env.local`.

## Stack y convenciones clave

- **Next.js 16 App Router + React 19 + TypeScript strict + Tailwind 3.** Alias de import `@/*` → `src/*`.
- **Drizzle ORM sobre Neon Postgres con el driver `neon-http`** (`src/lib/db/client.ts`). Implicancia crítica: **`neon-http` NO soporta `db.transaction()`**. Para atomicidad se usa **`db.batch([...])`**, que en este driver se ejecuta como transacción (rollback all-or-nothing verificado). Si necesitás escrituras atómicas, agrupalas en un batch respetando el orden de FKs (borrar antes de insertar; partidos antes que eventos). Conexión vía `DATABASE_URL_POOLED ?? DATABASE_URL`.
- **`import 'server-only'`** encabeza módulos que solo deben correr en el servidor (db client, queries, memory store, session token). Respetá esa frontera.

## Arquitectura

### Identidad y sesión
No hay login. La identidad es un `sessionToken` (UUID) en cookie httpOnly `esta-locura-session` (`src/lib/draft/session-token.ts`). Regla de Next que ya causó un bug: **los Server Components / páginas no pueden escribir cookies**. Por eso las páginas usan `getSessionTokenReadOnly()` (devuelve `null` si no existe) y **solo los Route Handlers (`/api`) crean la cookie** vía `getOrCreateSessionToken()`. Cada usuario ve solo sus propios datos: las queries se scopean por `users.sessionToken`.

### Dos rutas de persistencia para el draft (no las confundas)
- **Singleplayer draft**: estado en memoria, no en DB. `src/lib/draft/memory.ts` mantiene un `Map` en `globalThis`, keyed por session token. Es client-authoritative (sin validación server-side de reglas todavía — ver pendiente M1).
- **Multiplayer + torneos persistidos**: van a Postgres con el schema completo.

### Modelo de datos (`src/lib/db/schema.ts`)
Una sola fuente de verdad del schema; migraciones en `drizzle/`. Entidades principales:
- Catálogo: `users`, `nationalTeams`, `players` (ratings por línea: attack/midfield/defense/goalkeeping + ovr), `formations` (slots como JSONB con lane GK/DEF/MID/ATT).
- Salas: `rooms`, `roomParticipants`.
- Draft: `draftedTeams`, `draftedTeamPlayers` (un pick por slot).
- Torneo: `tournaments`, `tournamentEntries` (con ratings *computados* por línea), `groupStandings`, `matches`, `matchEvents`. Las entries pueden ser `HUMAN_DRAFTED` o `REAL_TEAM`.

El pool de draft es **DB-only** (`src/lib/game/draft-bootstrap.ts`, `src/lib/db/queries/draft-pool.ts`); el JSON en `src/lib/seeds/generated/` es **solo insumo del seed**, no se lee en runtime.

### Motor de simulación (`src/lib/sim/`)
Determinista y puro (sin I/O). Sembrado por seed → mismo seed = mismo resultado.
- `rng.ts`: RNG sembrado + Poisson. `match.ts`: simula un partido **por líneas** (`ataque*0.62+medio*0.38` vs `defensa*0.62+arquero*0.38`), no por OVR plano; `ATTACK_EXPONENT` controla cuánto pesa la brecha de nivel (subirlo = menos sorpresas). Penales ponderan el goalkeeping rival. Sin ventaja de localía (modelo simétrico, correcto para un Mundial).
- `roster.ts`: cada equipo usa **su plantel real** para goleadores/tarjetas (un bug crítico pasado: usaba un pool global de famosos). El equipo humano usa su draft. Si no hay roster, el evento va sin nombre — **nunca se inventa un jugador**.
- `group.ts` / `knockout.ts` / `bracket.ts` / `tournament.ts`: orquestan grupos → terceros → llave. Las stats reales por línea viajan hasta la fase KO vía `teamStatsById`.

### Flujo de torneo singleplayer (`src/lib/tournaments/`)
Decisión de diseño: **se pre-simula el Mundial entero al crearlo** ("Ir al Mundial"), de modo que la única espera ocurre una vez. `createSingleplayerTournament` (en `singleplayer.ts`) crea entries y llama a `simulateSingleplayerTournament` (`simulate.ts`), que persiste todo en un único `db.batch()`. El endpoint `/api/tournaments/simulate` quedó como fallback delgado para torneos viejos. La performance importa (Vercel timeout): los writes están batcheados — al editar esta capa, no reintroduzcas writes secuenciales por grupo/partido.

El cliente (`src/features/tournament/components/client-tournament.tsx`) **reproduce** el torneo ya simulado escena por escena (grupo → resumen → cada ronda KO → campeón), guardando el progreso en `localStorage` por `tournamentId`. Por eso las escenas no están en el HTML SSR — es UI client-side esperada.

### Multiplayer (salas)
Endpoints REST bajo `src/app/api/rooms/[code]/*` (join, leave, ready, start-draft, draft/save, draft/finalize, start-tournament, advance, state, restart). El estado de sala se resuelve **recalculándolo en cada poll** (`src/lib/rooms/queries.ts` → `getRoomState`, sin cache; presencia por `lastSeenAt` con umbral de 12 s). Hay variables de entorno para **PartyKit** (`*_PARTYKIT_HOST`) en `.env.example`, pero el realtime con PartyKit **aún no está implementado** (Fase 5 sin iniciar) — hoy el multiplayer es por polling HTTP.

### Frontend
Páginas en `src/app/` (App Router); lógica de UI agrupada por dominio en `src/features/{draft,rooms,tournament}/`. La card compartible del torneo es una imagen OG generada con `next/og` en `src/app/tournament/[tournamentId]/card/route.tsx` (ficha vertical 1080×1350; ojo: la fuente de Satori no tiene glifos ✓/✗, se usan puntos de color).

## Estado del proyecto

`docs/progreso.md` es la bitácora viva — consultala para saber qué está hecho, qué bug se arregló y por qué se tomó cada decisión. `docs/` además contiene el plan de implementación, fases, schema y el contrato de eventos PartyKit. Pendientes anotados que conviene tener presente: M1 (draft sin validación server-side), V1 (sin rate limiting en `simulate`, que es caro), V3 (arrays sin tope en Zod).

## Convención CSS de VTEX (de la config global del usuario)
La `CLAUDE.md` global del usuario es contexto VTEX y **no aplica a este proyecto** (esto es Next.js + Tailwind, no VTEX IO). Ignorá las reglas de VTEX/store-theme acá.
