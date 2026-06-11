# Plan de Implementación — Modo Multijugador

> Plan detallado y concreto para el modo multijugador de *Esta Locura*.
> Complementa la visión de [`plan-implementacion.md`](./plan-implementacion.md) (secciones 10–11) y el estado de [`progreso.md`](./progreso.md) (Fases 5–7).
> Última actualización: 2026-06-10.

---

## 0. Decisiones de diseño (confirmadas)

| Tema | Decisión | Implicancia |
|------|----------|-------------|
| **Draft** | **Independiente / a su ritmo**. Cada participante draftea su propio equipo (ruleta de país individual, igual que singleplayer). El lobby muestra en vivo quién va completando. | No hay turnos ni reloj compartido en el draft. Robusto a desconexiones. |
| **Torneo** | **Reveal sincronizado por fase**. El Mundial se **pre-simula una vez** en el server (determinista, idéntico para todos) y la sala **avanza junta** fase por fase: Grupos → 32avos → 16avos → 4tos → Semis → Final. | El host (o un timer) dispara "avanzar fase". El estado compartido es un solo entero. |
| **Realtime** | **Polling sobre Neon. Sin PartyKit.** | Endpoints cortos + `setInterval` en el cliente. Más robusto que SSE/WebSockets en serverless de Vercel free-tier. Se puede subir a SSE (Edge) más adelante sin reescribir la lógica. |
| **Cuadro** | **Humanos separados**: máximo 1 humano por grupo (8 humanos ≤ 12 grupos). Nunca se cruzan en fase de grupos; los cruces entre participantes recién pasan en eliminatorias. | Recorrido más limpio de leer. La fase de grupos de cada humano es siempre contra selecciones reales. |
| **Identidad** | Guest session (cookie ya existente) + **nickname obligatorio** para entrar a una sala. El nickname es el `display_name` que diferencia los drafts. | Sin auth real. El invite link crea sesión guest al vuelo. |

**Atajo clave ya disponible:** el motor (`simulateFullTournament(groups, seed)` en [`src/lib/sim/tournament.ts`](../src/lib/sim/tournament.ts)) es **agnóstico al tipo de entry**. Ya soporta hoy N equipos `HUMAN_DRAFTED` + (48−N) `REAL_TEAM` en el mismo torneo. El schema (`rooms`, `room_participants`, `tournaments.type=MULTIPLAYER`, `tournament_entries` con `HUMAN_DRAFTED|REAL_TEAM`) ya está completo. El grueso del trabajo es **orquestación de sala + reveal sincronizado + UI**, no motor.

---

## 1. Arquitectura de estado

### 1.1 Fuente de verdad

- **Neon (Drizzle)** = autoritativo para todo: salas, participantes, drafts, torneo pre-simulado, y **el índice de fase revelada** (estado de reproducción compartido).
- **Cliente** = solo render + polling. Nunca decide resultados, picks válidos ni avance de fase.
- **No hay `localStorage` de progreso** en multiplayer (a diferencia del singleplayer): el progreso de reproducción es **compartido y vive en la sala**.

### 1.2 Ciclo de vida de la sala (`room_status` enum, ya existe)

```
LOBBY ──(host: start-draft)──► DRAFT ──(host: start-tournament)──► TOURNAMENT ──(host: advance × N)──► FINISHED
  │                                                                                                       
  └──(host: cancel / sala vacía)──► CANCELLED
```

- **LOBBY**: host creó la sala; los invitados entran por código/link, cargan nickname y marcan "listo".
- **DRAFT**: el host inició; todos draftean en paralelo de forma independiente. El lobby muestra el % de cada uno.
- **TOURNAMENT**: el host cierra el draft → el server **genera + pre-simula** el Mundial compartido. La sala reproduce fase por fase (`revealStageIndex`).
- **FINISHED**: se reveló la final; campeón a la vista. Card compartible por participante.

### 1.3 Estado de reproducción compartido (`revealStageIndex`)

Un entero a nivel **sala**:

| Valor | Fase revelada |
|-------|---------------|
| `-1` | Torneo generado, nada revelado todavía (pantalla "El Mundial está por empezar") |
| `0` | Fase de grupos |
| `1` | 32avos |
| `2` | 16avos |
| `3` | Cuartos |
| `4` | Semifinales |
| `5` | Final + campeón → la sala pasa a `FINISHED` |

El host avanza el índice (+1). El server **clampa** lo que devuelve el endpoint de torneo a `revealStageIndex`, para que nadie pueda espiar fases futuras antes de que la sala las libere. Dentro de una fase ya revelada, cada cliente explora libremente (su partido, todos los partidos, tablas) — la sincronía es **a nivel fase**, no de sub-escena.

---

## 2. Cambios de schema (Drizzle)

Delta mínimo sobre [`src/lib/db/schema.ts`](../src/lib/db/schema.ts). Generar migración con `npm run db:generate` y aplicar con `npm run db:migrate`.

### 2.1 `rooms` — agregar estado de reproducción

```ts
// reveal sincronizado del torneo (estado de reproducción compartido)
revealStageIndex: integer('reveal_stage_index').default(-1).notNull(),
revealUpdatedAt: timestamp('reveal_updated_at', { withTimezone: true }),
```

> El vínculo sala→torneo ya se resuelve por `tournaments.roomId` (existe). No hace falta FK extra.

### 2.2 `room_participants` — presencia

```ts
// heartbeat para presencia: el poll actualiza este timestamp; si no hay poll en
// > N segundos, el participante se considera OFFLINE.
lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
```

> `connection_status` (`ONLINE|OFFLINE`) y `draft_status` (`WAITING|CHOOSING|COMPLETED|DISCONNECTED`) ya existen y se reutilizan.

### 2.3 Sin cambios

`drafted_teams.roomId` (ya nullable, ya existe), `tournaments.roomId`, `tournament_entries` (HUMAN/REAL) y todo el resto del modelo de torneo **no se tocan**.

---

## 3. Refactor del motor compartido (prerequisito)

El singleplayer asume **un solo** equipo humano. Hay que generalizar a **N** sin romper el SP. Dos archivos:

### 3.1 Creación del torneo — extraer núcleo compartido

`src/lib/tournaments/create.ts` (nuevo) — extraer de [`createSingleplayerTournament`](../src/lib/tournaments/singleplayer.ts):

```ts
type HumanEntryInput = {
  draftedTeamId: string
  displayName: string          // nickname del participante
  ratings: { attack; midfield; defense; goalkeeping; ovr }
}

async function createTournament(params: {
  type: 'SINGLEPLAYER' | 'MULTIPLAYER'
  roomId?: string
  humans: HumanEntryInput[]     // 1 en SP, N en MP
  separateHumans: boolean       // true en MP (máx 1 humano por grupo)
  seedBase: string
}): Promise<{ tournamentId: string }>
```

Responsabilidades:
1. Crear `tournaments` (con `roomId` si aplica).
2. Insertar `tournament_entries`: N humanos + (48−N) selecciones reales. **Las reales que se mantienen son las (48−N) de mayor media (`ovr`); los humanos reemplazan a las N selecciones de **peor** media.** Es decir: ordenar las 48 selecciones por `ovr` descendente, quedarse con el top `(48−N)`, y dejar afuera las `N` más flojas (sus cupos los ocupan los humanos). Aplica también al singleplayer (1 humano desplaza a la selección más débil), reemplazando el `realTeams.slice(0, 47)` arbitrario actual.
3. **Asignación a grupos:**
   - SP / `separateHumans=false`: shuffle total → 12 grupos de 4 (lógica actual).
   - MP / `separateHumans=true`: **colocar cada humano en un grupo distinto** (grupos elegidos al azar y únicos), luego repartir las reales en los cupos restantes (4 por grupo). Validar `humans.length ≤ 12`.
4. Llamar al simulador (§3.2).

`createSingleplayerTournament(sessionToken)` queda como wrapper delgado: resuelve el draft del usuario, calcula ratings (`computeDraftedTeamRatings`, ya existe) y llama a `createTournament({ type:'SINGLEPLAYER', humans:[one], separateHumans:false })`.

### 3.2 Simulación — soportar varios rosters humanos

`src/lib/tournaments/simulate.ts` → renombrar `simulateSingleplayerTournament` a `simulateTournament(tournamentId)` y generalizar el bloque que hoy carga **un** roster humano:

```ts
// HOY (singleplayer): toma solo el primer HUMAN_DRAFTED
const humanEntry = allEntries.find((e) => e.entryType === 'HUMAN_DRAFTED')

// MULTIPLAYER: cargar el roster de CADA entry humana
const humanEntries = allEntries.filter((e) => e.entryType === 'HUMAN_DRAFTED')
// para cada una, query a drafted_team_players → buildTeamRoster, y mapear por entry.id
```

El resto (grupos, bracket, persistencia atómica con `db.batch`) **no cambia**: ya itera sobre todas las entries de forma genérica. Verificar que `rosterForEntry` resuelva por `entry.id` para cualquier humano, no solo el primero.

> Mantener un alias `simulateSingleplayerTournament = simulateTournament` o actualizar los 2 call-sites ([`singleplayer.ts`](../src/lib/tournaments/singleplayer.ts), [`api/tournaments/simulate/route.ts`](../src/app/api/tournaments/simulate/route.ts)).

---

## 4. Identidad y nickname

- Reutilizar la cookie de sesión (`getOrCreateSessionToken`, ya existe).
- `users.nickname` ya existe pero hoy no se setea de forma explícita. Agregar un paso de **"¿Cómo te llamás?"** al entrar a una sala (crear/unirse). Persistir en `users.nickname` + snapshot en `room_participants.nickname_snapshot` + `drafted_teams.display_name`.
- El nickname debe ser **único dentro de la sala** (validación server-side al unirse; si choca, sufijo numérico o pedir otro).

---

## 5. API (Route Handlers) — contratos

Todos server-authoritative. Las acciones de host validan `room.hostUserId === user.id`. Base: `src/app/api/rooms/...`.

### 5.1 Salas y lobby

| Método + ruta | Quién | Body | Efecto / respuesta |
|---|---|---|---|
| `POST /api/rooms` | cualquiera | `{ nickname, difficultyMode, rerollsPerPlayer?, maxHumanPlayers? }` | Crea `rooms` (status `LOBBY`, code único de 6 chars) + participante host. Devuelve `{ code, roomId }`. |
| `POST /api/rooms/[code]/join` | cualquiera | `{ nickname }` | Valida sala en `LOBBY`, no llena, nickname único. Crea `room_participants`. Devuelve snapshot de sala. |
| `POST /api/rooms/[code]/leave` | participante | — | Marca salida; si era host, **migra host** al siguiente; si queda vacía → `CANCELLED`. |
| `POST /api/rooms/[code]/ready` | participante | `{ isReady }` | Toggle `is_ready`. |
| `POST /api/rooms/[code]/start-draft` | **host** | — | Requiere ≥2 participantes (configurable) y todos `is_ready`. `LOBBY → DRAFT`. |
| `GET  /api/rooms/[code]/state` | participante | — | **Endpoint de polling** (§6). Actualiza `last_seen_at`. |

### 5.2 Draft (independiente, scope sala)

| Método + ruta | Quién | Efecto |
|---|---|---|
| `POST /api/rooms/[code]/draft/save` | participante | Persiste snapshot de su draft con `roomId` + `display_name = nickname`. Reutiliza la persistencia actual del draft. |
| `POST /api/rooms/[code]/draft/finalize` | participante | `validateDraftCompletion` (ya existe) → marca su `drafted_team` `COMPLETED` y `draft_status = COMPLETED`. |
| `POST /api/rooms/[code]/start-tournament` | **host** | Cierra el draft. Toma todos los `drafted_teams COMPLETED` de la sala → `createTournament({ type:'MULTIPLAYER', roomId, humans:[…N], separateHumans:true })` → `simulateTournament`. `DRAFT → TOURNAMENT`, `revealStageIndex = -1`. |

> **Forzar cierre:** si el host inicia el torneo con drafts incompletos, esos participantes se descartan del torneo (no entran como humanos; su cupo lo toma una selección real). Regla del MVP — se avisa en la UI antes de confirmar.

### 5.3 Torneo compartido + reveal

| Método + ruta | Quién | Efecto |
|---|---|---|
| `GET  /api/rooms/[code]/tournament` | participante | Devuelve el overview del torneo **clampado a `revealStageIndex`** + `myEntryId`. (§7) |
| `POST /api/rooms/[code]/advance` | **host** | `revealStageIndex += 1` (+ `reveal_updated_at`). Si pasa la Final (`5`) → `TOURNAMENT → FINISHED`. Idempotente / validado contra el índice actual para evitar doble-avance. |

---

## 6. Polling: contrato del `GET /state`

Un único endpoint liviano que el cliente consulta en intervalo. Payload:

```jsonc
{
  "room": {
    "code": "ABC123",
    "status": "DRAFT",            // LOBBY | DRAFT | TOURNAMENT | FINISHED | CANCELLED
    "hostUserId": "…",
    "difficultyMode": "CLASSIC",
    "rerollsPerPlayer": 3,
    "maxHumanPlayers": 8,
    "revealStageIndex": -1
  },
  "me": { "userId": "…", "isHost": true, "isReady": true, "draftStatus": "CHOOSING" },
  "participants": [
    {
      "userId": "…", "nickname": "Santi", "isHost": true, "isReady": true,
      "connectionStatus": "ONLINE",
      "draftStatus": "CHOOSING",      // WAITING | CHOOSING | COMPLETED | DISCONNECTED
      "draftProgress": { "filled": 7, "total": 11 }  // para la barra de progreso
    }
  ]
}
```

- **Cadencia:** `LOBBY`/`DRAFT` → cada **2–3 s**. `TOURNAMENT` → cada **1–2 s** (solo cambia `revealStageIndex`, payload chico). `FINISHED`/`CANCELLED` → detener el poll.
- **Presencia:** cada `GET /state` actualiza `last_seen_at` del que llama. El server marca `OFFLINE` a quien no pollea hace > ~10 s (calculado al leer, sin job).
- **Costo free-tier:** sala de ≤8 → ≤4 req/s. Despreciable para Neon. (Si más adelante molesta, subir a SSE Edge para el reveal.)
- **`draftProgress`** se calcula contando `drafted_team_players` del draft en curso de cada participante.

---

## 7. Overview del torneo multiplayer (clampado + "mi recorrido")

`src/lib/tournaments/room-overview.ts` (nuevo). Basado en [`getSingleplayerTournamentOverview`](../src/lib/tournaments/overview.ts) pero:

1. **Scope por sala**, no por el draft del usuario: resuelve el torneo vía `tournaments.roomId`.
2. **Clamp por `revealStageIndex`**: omite (o marca como `PENDING`/oculto) los grupos/rondas que la sala todavía no reveló. Grupos visibles solo si `revealStageIndex ≥ 0`; cada ronda KO visible solo si su índice ≤ `revealStageIndex`.
3. **`myEntryId`**: la entry `HUMAN_DRAFTED` cuyo `drafted_team.user_id` = usuario que pide. Para resaltar "tu equipo".
4. **`humans[]`**: lista de todas las entries humanas con su **recorrido** (hasta qué fase llegó cada una, su próximo/último cruce, eliminado/vivo). Esto alimenta el "tablero de participantes".
5. **Cruces entre participantes**: marcar los partidos KO donde **ambas** entries son `HUMAN_DRAFTED` (`isHumanDerby: true`) para destacarlos en la UI.

```ts
type RoomTournamentOverview = TournamentOverview & {
  myEntryId: string | null
  revealStageIndex: number
  humans: Array<{
    entryId: string
    nickname: string
    isMe: boolean
    status: 'ALIVE' | 'ELIMINATED' | 'CHAMPION'
    reachedRound: string          // hasta dónde llegó (revelado)
    eliminatedByEntryId: string | null
    eliminatedByHuman: boolean
  }>
  knockoutMatches: Array<BracketMatchInfo & { isHumanDerby: boolean }>
}
```

---

## 8. Frontend (App Router)

### 8.1 Páginas

| Ruta | Contenido |
|---|---|
| `src/app/multiplayer/page.tsx` | Entrada: **Crear sala** / **Unirse con código**. CTA desde la home. |
| `src/app/sala/[code]/page.tsx` | Shell de la sala (Server Component lee estado inicial). |
| Invite link | `https://…/sala/[code]` → si el visitante no es participante, primero pide nickname y hace `join`. |

### 8.2 Componente raíz cliente: `room-client.tsx`

Client Component que **pollea `GET /state`** y renderiza la vista según `room.status`:

- **`LOBBY` → `<Lobby/>`**
  - Lista de participantes (nickname, host ✓, listo ✓, online/offline).
  - **Código de invitación + botón "Copiar link"** (Web Share API con fallback a copiar, igual que la card actual).
  - Toggle "Estoy listo".
  - Config de sala (dificultad, rerolls) visible; editable solo por host.
  - Botón **"Empezar draft"** (solo host, habilitado cuando todos `listo`).

- **`DRAFT` → `<RoomDraft/>`**
  - **Reutiliza [`draft-workbench.tsx`](../src/features/draft/components/draft-workbench.tsx)** en modo sala (guarda/finaliza contra los endpoints `/rooms/[code]/draft/*`).
  - Panel lateral de **progreso en vivo de los demás** (barras `filled/total` desde el poll) — sin spoilear los picks ajenos, solo el avance.
  - Al finalizar, el participante ve "Esperando a los demás / al host".
  - Host ve botón **"Cerrar draft y arrancar el Mundial"** (con aviso si hay drafts incompletos).

- **`TOURNAMENT` → `<RoomTournament/>`** (la pieza central de la experiencia)
  - Pollea `GET /tournament` (clampado) + usa `revealStageIndex` del `/state`.
  - **Reutiliza la máquina de escenas** de [`client-tournament.tsx`](../src/features/tournament/components/client-tournament.tsx), pero el progreso lo manda **`revealStageIndex` compartido**, no `localStorage`.
  - **Host:** botón **"Avanzar fase"** (`POST /advance`). Opcional: auto-avance con timer configurable.
  - **No-host:** sin botón; ven la fase revelarse cuando el host avanza (el poll trae el nuevo índice).
  - **Layout por fase:**
    - **Tu equipo primero** (resaltado): tu partido/resultado de la fase actual con goleadores.
    - **Tablero de participantes**: para la fase revelada, el resultado de **cada humano** (✓ avanza / ✗ eliminado, contra quién). Hace legible "el recorrido de cada equipo".
    - **Cruces entre participantes** (`isHumanDerby`) destacados con un badge ("Mano a mano: Santi vs Nacho").
    - **El resto del Mundial** colapsable (grupos/rondas de selecciones reales).
  - **`FINISHED`:** pantalla de campeón + **ranking final de participantes** (quién llegó más lejos) + card compartible por usuario (reutiliza `/tournament/[id]/card`).

### 8.3 Diferenciación visual de drafts

Cada participante tiene su nickname como `display_name`. En cancha/tablero, color/badge por participante para distinguir selecciones drafteadas (el "tu equipo" siempre con el acento principal).

---

## 9. Fases de implementación (incremental y shippable)

> Cada fase cierra con verificación end-to-end contra Neon real + `npx tsc --noEmit`, siguiendo la disciplina de `progreso.md`.

### Fase M0 — Cimientos
- [ ] Schema delta (§2) + migración generada y aplicada.
- [ ] Refactor motor compartido (§3): `createTournament` + `simulateTournament` con N humanos. **SP sigue funcionando igual** (regresión: correr una run singleplayer completa).
- [ ] Paso de nickname + persistencia (§4).
- **Verificación:** crear a mano un torneo MULTIPLAYER con 2 humanos + 46 reales y simularlo; auditar que cada humano usa su roster drafteado y que hay ≤1 humano por grupo.

### Fase M1 — Salas y lobby
- [ ] Endpoints `POST /rooms`, `/join`, `/leave`, `/ready`, `/start-draft`, `GET /state` (§5.1, §6).
- [ ] `/multiplayer` + `/sala/[code]` + `<Lobby/>` con polling, invite code + copiar link, presencia.
- [ ] Migración de host + sala vacía → `CANCELLED`.
- **Verificación:** dos navegadores (dos cookies) crean/uniéndose; el lobby refleja en ≤3 s joins, ready y leave.

### Fase M2 — Draft multiplayer
- [ ] Endpoints `/draft/save`, `/draft/finalize`, `/start-tournament` (§5.2).
- [ ] `<RoomDraft/>` reusando el workbench + panel de progreso en vivo.
- [ ] Gate del host para cerrar el draft (con aviso de incompletos).
- **Verificación:** dos participantes draftean en paralelo; cada uno ve avanzar la barra del otro; al cerrar, se crea el torneo compartido pre-simulado.

### Fase M3 — Torneo compartido con reveal sincronizado
- [ ] `room-overview.ts` clampado + `myEntryId` + `humans[]` + `isHumanDerby` (§7).
- [ ] Endpoints `GET /tournament` + `POST /advance` (§5.3).
- [ ] `<RoomTournament/>`: reveal por fase guiado por `revealStageIndex`, tu equipo primero, tablero de participantes, cruces destacados, campeón + ranking final.
- **Verificación:** dos clientes ven la **misma** fase a la vez; al avanzar el host, ambos pasan en ≤2 s; el clamp impide ver fases futuras; los cruces humano-vs-humano aparecen recién en KO.

### Fase M4 — Hardening
- [ ] Presencia/reconexión fina (re-entrar a una sala en curso y retomar la fase actual).
- [ ] Rate limiting de `start-tournament`/`advance` (caros / sensibles) y validación anti doble-avance.
- [ ] Validación Zod con topes de payload en todos los endpoints (mitiga V3).
- [ ] Edge cases: host se va durante el torneo (migración de control de avance), participante único, draft incompleto forzado.
- [ ] (Opcional) Auto-avance por timer; (opcional) subir reveal a SSE Edge.

---

## 10. Reutilización vs. código nuevo

| Se reutiliza tal cual | Se generaliza | Se crea nuevo |
|---|---|---|
| Motor de sim (`sim/*`), `buildTeamRoster`, persistencia atómica `db.batch`, `validateDraftCompletion`, `draft-workbench`, máquina de escenas de `client-tournament`, card OG, cookie de sesión | `createSingleplayerTournament` → `createTournament` (N humanos, `separateHumans`); `simulateSingleplayerTournament` → `simulateTournament` (N rosters humanos) | Endpoints `/api/rooms/*`, `room-overview.ts`, páginas `/multiplayer` y `/sala/[code]`, `room-client.tsx` + `<Lobby/>`/`<RoomDraft/>`/`<RoomTournament/>`, paso de nickname, polling client hook |

---

## 11. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| **Draft client-authoritative** (M1 en progreso.md): un cliente podría falsear picks. | Para el MVP party-game, se valida **completitud y elegibilidad** server-side en `finalize` (ya existe). Validación reactiva total (cada pick contra reglas en el server) queda como hardening si aparece abuso. |
| **Costo de polling** en free-tier. | Salas chicas (≤8), payloads mínimos, cadencia adaptativa por estado, poll detenido en `FINISHED`. Margen amplio en Neon. |
| **Host se desconecta** y nadie puede avanzar. | Migración de host (el siguiente participante online hereda el control). Opcional: auto-avance por timer como red de seguridad. |
| **Drafts incompletos** al cerrar. | Regla explícita: se descartan como humanos y su cupo lo toma una selección real; se avisa antes de confirmar. |
| **Consistencia reveal vs. simulación.** | El torneo se pre-simula **una vez** y es determinista; el reveal solo expone progresivamente datos ya persistidos. No hay recomputo por cliente. |
| **Spoilers de fases futuras.** | Clamp server-side por `revealStageIndex` en `GET /tournament`. |

---

## 12. Criterios de éxito del MVP multiplayer

- Un host crea una sala privada y comparte código + link; los invitados entran, cargan su nombre y se ven en el lobby en vivo.
- Cada participante draftea su propio equipo a su ritmo; el avance de los demás se ve en tiempo (casi) real.
- Al cerrar el draft, se genera **un único Mundial compartido** con todos los humanos (máx. 1 por grupo) + las **(48−N) selecciones reales de mayor media** (los humanos reemplazan a las N más débiles).
- La sala vive el Mundial **fase por fase, sincronizada**: todos ven la misma etapa a la vez cuando el host avanza.
- Se entiende con claridad **el recorrido de cada participante** y el **resultado de cada fase**, con los cruces entre humanos destacados.
- Sale **un único campeón**; ranking final de participantes; card compartible.
