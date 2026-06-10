# Progreso — Esta Locura

> Bitácora viva del estado del proyecto. Se actualiza a medida que se completan tareas.
> Última actualización: 2026-06-09

---

## Estado general por fase

| Fase | Descripción | Estado |
|------|-------------|--------|
| 0 — Discovery | Reglas, schema, contratos | ✅ Completa |
| 1 — Setup + persistencia | Next.js, Drizzle, Neon, seeds | ✅ Casi completa |
| 2 — Draft singleplayer | Config + draft jugable | 🟡 Funcional (client-authoritative) |
| 3 — Simulador Mundial | Grupos + llave | 🟡 En corrección (C1/C2) |
| 4 — Persistencia/historial/card | Cierre + share | ✅ Completa |
| 5 — Realtime/salas | PartyKit + lobby | 🔴 No iniciada |
| 6 — Draft multiplayer | Draft sincrónico | 🔴 No iniciada |
| 7 — Torneo multiplayer | Torneo compartido | 🔴 No iniciada |
| 8 — Hardening | Errores, tests, telemetría | 🔴 No iniciada |

---

## Hallazgos de auditoría (2026-06-09)

### Críticos
- [x] **C1 — La simulación ignora qué jugadores drafteaste.** ✅ **RESUELTO** (2026-06-09). El equipo humano ahora se calcula desde los jugadores realmente drafteados, agregando por línea según la formación.
- [x] **C2 — El motor de simulación solo usa OVR.** ✅ **RESUELTO** (2026-06-09). El motor usa las líneas (ataque+medio vs defensa+arquero); las stats reales se propagan hasta la fase eliminatoria; penales ponderan goalkeeping.
- [x] **C3 — El torneo singleplayer es global, no por usuario.** ✅ **RESUELTO** (2026-06-09). Creación y simulación ahora se scopean al usuario vía `tournament_entries.drafted_team_id → drafted_teams.user_id`.
- [x] **C4 — Sin transacciones.** ✅ **RESUELTO** (2026-06-09). La persistencia de `simulate` corre en un único `db.batch()` atómico (neon-http lo ejecuta como transacción; verificado rollback all-or-nothing). Sin migrar el driver.

### Medios
- [ ] **M1 — Draft 100% client-authoritative.** Sin validación server-side de reglas (bloqueante para Fase 6).
- [ ] **M2 — `draftState` serializado dentro de `displayName`.** Abuso de columna; el schema ya tiene columnas dedicadas.
- [ ] **M3 — Lógica duplicada y divergente** (2 RNG, 2 algoritmos de pairings, `simulationSeed` sin uso).
- [ ] **M4 — `enrichmentStatus === 'matched'` bloquea 166 jugadores con datos válidos.**
- [x] **M5 — Dos fuentes de verdad para el pool de draft** ✅ **RESUELTO** (2026-06-09). El pool ahora es DB-only (fuente única). Se agregaron columnas `club`/`birth_date` a `players` + seed, para no perder el display de club/edad.
- [x] **M6 — Fase 4 incompleta** ✅ **RESUELTO** (2026-06-09). Historial de campañas, stats de la run (goleador del torneo, goles a favor/contra, camino del equipo) y card compartible (imagen OG + Web Share/copiar link).

### Vulnerabilidades / higiene
- [ ] **V1 — Endpoints sin rate limiting** (`simulate` es caro).
- [ ] **V3 — DoS por payload de draft** (arrays sin tope en Zod).
- [ ] Archivo `nul` basura en la raíz.
- [ ] CSV de 14 MB (`fc25-players.csv`) y reportes generados sin gitignorear.
- [ ] 0 tests.

---

## Rediseño integral (branch `redesign/integral`)

Rediseño visual completo al estilo editorial-deportivo "7-0" (crema, tipografía contundente, sombras duras, look videojuego) inspirado en referencias del usuario, tomando el flujo: cancha al centro, box score al costado, simulación como sección aparte ("La campaña").

- **Base de tema** (`tailwind.config.ts`, `layout.tsx`): paleta crema (`paper/bone/ink/vermillion/gold/grass`), sombras `hard/hardsm`, fuente display `Anton` (`font-slab`). Aditivo, no rompe el tema dark previo.
- **Home** (`src/app/page.tsx`): logo "7–0 ESTA LOCURA", hero bold, stats y CTAs con botones de sombra dura.
- **Draft** (`draft-workbench.tsx`, `app/draft/page.tsx`): layout de 3 columnas — config (formación/dificultad) a la izquierda, **cancha al centro con jugadores posicionados** (etiquetas POR/DFC/MC/DC…), **box score** a la derecha (OVR/Ataque/Defensa + ratings por puesto). Picker de país con jugadores reales. Botón TIRAR/SIMULAR. Modo "De memoria" oculta ratings hasta completar.
- **Campaña** (`client-tournament.tsx`, `app/tournament/page.tsx`): feed editorial de los partidos del usuario (etapa, rival, goleadores/recibidos, marcador con color, ✓/✗, penales), toggle **Partido a partido / Automático**, card resumen negra (récord W-L, GF/GC/victorias, goleador) con Repetir/Compartir/Ver mi card, y "El resto del Mundial" colapsable. (Se agregaron `events` a `BracketMatchInfo` en el overview para mostrar goleadores en eliminatorias.)
- **Historial** (`app/historial/page.tsx`): restyle crema.
- **Verificado en preview** (datos reales): home, draft (con picker de Marruecos real + asignación), campaña completa (feed con goleadores reales + card resumen "4-2") renderizan correctamente; `tsc` sin errores.
- **Pendiente del rediseño**: aún no se tocó el body global (cada página setea su propio fondo, así que conviven sin romperse). Posibles mejoras: selector de "Estilo" (Defensivo/Equilibrado/Ofensivo), banderas/códigos de país, swap de jugadores en la cancha.

### Tuning del motor: demasiadas sorpresas (2026-06-10)
- **Problema**: las medias casi no influían en el resultado → equipos débiles salían campeones, favoritos claros caían seguido. Medido: con el exponente viejo (1.25), un gap de 20 de media daba al favorito solo **58%** de victoria; gap 16 → 53% (casi moneda al aire).
- **Causa**: las medias están comprimidas (~70-90), así que el cociente ataque/defensa entre dos equipos queda cerca de 1; el exponente `1.25` no expandía esa diferencia.
- **Fix**: `ATTACK_EXPONENT` de `1.25` → **`2.5`** en `match.ts`. Ahora el favorito gana según la brecha: parejos (gap 6) 49%, gap 10 → 58%, gap 16 → 69%, gap 20 → **77%** (sorpresa rara). Equipos iguales siguen 37/37 (simétrico).
- **Verificado** (6 torneos reales): campeones pasaron a ser equipos del tercio alto (Inglaterra/Brasil 85, Uruguay 82, etc.); los débiles ya no ganan. `tsc` sin errores.
- **Nota**: los torneos ya simulados conservan su resultado; el cambio aplica a torneos nuevos.

### Fix consistencia del box score (2026-06-10)
- **Problema**: la Media (OVR) del box score no cuadraba con Ataque/Defensa. Causa: la Media era el promedio del `ovr` de los 11 jugadores, mientras Ataque/Defensa eran promedios de atributos de subconjuntos (delanteros/defensores), y no se mostraban Medio ni Arquero.
- **Fix**: el box score ahora muestra las **4 líneas** (Ataque/Medio/Defensa/Arquero) y la **Media = promedio de esas 4 líneas** (`draft-workbench.tsx`). Además se alineó el servidor (`computeDraftedTeamRatings` en `singleplayer.ts`): `ovr = round((attack+midfield+defense+goalkeeping)/4)`, así la OVR del torneo coincide con la del draft.
- **Verificado** (DB): atk 84 / med 77 / def 81 / gk 82 → media 81 = round(mean) = OVR almacenada. Consistente. `tsc` sin errores.

### Iteración 2 del rediseño (2026-06-10)
- **Paleta Albiceleste**: re-tematizado de crema a **celeste / azul / violeta** (referencia Selección Argentina). En `tailwind.config.ts` se repurpusieron los tokens (paper=celeste claro, bone=blanco, ink=índigo profundo, vermillion=violeta, gold=celeste) y se agregaron `celeste/azul/violeta` para gradientes. CTAs principales con gradiente celeste→violeta. Sombras duras al nuevo índigo.
- **Sin "7-0"**: se eliminó el logo "7–0" de home y draft; nuevo wordmark "ESTA LOCURA" con badge gradiente "EL" y "LOCURA" en gradiente. Verificado: sin refs a `7-0`/`Sete` en el código.
- **8 formaciones**: agregadas 4-2-3-1, 4-2-4, 3-5-2, 5-3-2, 4-5-1 (antes 3). Actualizados `src/lib/seeds/formations.ts` y `scripts/seed-formations.mjs`; **seedeadas a DB** (`db:seed-formations`).
- **Fix posiciones de la cancha**: las posiciones estaban espejadas (LD/LI y ED/EI al revés) porque se ordenaban por índice del array. Reescrito `pitchPositions` en `draft-workbench.tsx` para ubicar por **nivel** (tier por tipo de posición → eje vertical) y **flanco** (izq/der → eje horizontal). Verificado: LI/EI a la izquierda, LD/ED a la derecha; y las formaciones con más líneas (4-2-3-1) muestran su escalonado real.
- **Verificación**: `tsc` sin errores; formaciones nuevas presentes en el draft (confirmado por DOM); lógica de posiciones validada numéricamente. (El screenshot del preview headless quedó colgado por un problema del renderer, no del código — la página responde 200 y renderiza por eval.)
- **Para prod**: correr `npm run db:seed-formations` para tener las 8 formaciones.

## Registro de avances

### 2026-06-09 — Inicio C1 + C2
- Auditoría completa del proyecto realizada.
- Creado este archivo de progreso.
- Arrancando corrección de C1 (stats del equipo humano desde jugadores) y C2 (simulación basada en líneas).

### 2026-06-09 — C1 + C2 resueltos
**C2 — Motor basado en líneas:**
- `src/lib/sim/match.ts`: reemplazado `calculateOvrScore`/`calculateExpectedGoals` (código muerto) por un modelo de goles esperados (Poisson) que compara `ataque*0.62 + medio*0.38` vs `defensa*0.62 + arquero*0.38`. RNG acotado mantiene sorpresas.
- Penales (`simulatePenaltyShootout`) ahora ponderan el `goalkeeping` rival en vez de un 0.75 fijo.
- `src/lib/sim/tournament.ts`: construye un `Map<entryId, TeamStats>` con las líneas reales y lo pasa a la fase KO.
- `src/lib/sim/knockout.ts`: usa ese mapa en vez de reconstruir equipos con líneas en 0 (con fallback al OVR si faltara algún equipo).

**C1 — Stats del equipo humano desde jugadores:**
- `src/lib/tournaments/singleplayer.ts`: la query pasa a joinear `players` (por `playerId`) en vez de `national_teams`. Nueva función `computeDraftedTeamRatings` que agrega por línea según la formación (GK→goalkeeping, DEF→defense, MID→midfield, ATT→attack), con fallback al promedio general. Valida que existan jugadores persistidos y la formación.

**Verificación:**
- `npx tsc --noEmit` → sin errores.
- Simulación numérica (2000 partidos/escenario): fuerte vs débil 65% / 14% (favoritismo con upsets), parejos ~equilibrado, ~2.5–3.0 goles por partido (realista), determinismo por seed confirmado.

**Notas / pendientes derivados:**
- ~~Existe un leve sesgo home/away (~34% vs 41%)~~ **CORREGIDO (2026-06-10)**: era un error de medición (pocas muestras + semillas mal distribuidas). Con 200.000 partidos entre equipos idénticos el motor es simétrico (local 37.12% / visita 37.10%, goles 1.350 vs 1.351). No hay ventaja de localía: el modelo es neutral por diseño (correcto para un Mundial).
- C1 depende de que `drafted_team_players` esté poblado, lo que requiere que el pool de draft use IDs de DB (UUID) y no del JSON (`slug:slug`). Ver M5 — conviene unificar la fuente del pool.

### 2026-06-09 — C3 resuelto
**Scope de torneos por usuario** (antes eran globales):
- `src/lib/tournaments/singleplayer.ts`: al crear un torneo, la limpieza de torneos previos ahora borra SOLO los del propio usuario. Se resuelven sus `drafted_teams` → `tournament_entries` → `tournament_id` y se borran solo esos (filtrados a `SINGLEPLAYER`). Antes borraba el primer `GROUP_STAGE` global, eliminando torneos de otros usuarios.
- `src/app/api/tournaments/simulate/route.ts`: la simulación ahora encuentra el torneo vía el equipo draft `COMPLETED` del usuario → entry → tournament (filtrado a `GROUP_STAGE`). Antes tomaba el primer `GROUP_STAGE` global, así que un usuario podía simular el torneo de otro.
- `src/lib/tournaments/overview.ts`: ya estaba correctamente scopeado (sin cambios).

**Verificación:**
- `npx tsc --noEmit` → sin errores.
- Grep confirma que los 3 lookups de `tournaments` restantes están scopeados por usuario.

**Nota:** Sigue sin haber transacciones (C4), por lo que la creación (varios inserts) y la simulación (decenas de writes) no son atómicas. C3 reduce el blast radius (cada quien toca lo suyo) pero un fallo a mitad aún deja estado inconsistente del propio usuario.

### 2026-06-09 — Verificación end-to-end + falso positivo de error
- Reportado: al "Ir al Mundial" aparecía `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`.
- **Causa real:** el dev server que tenía el usuario corriendo estaba en estado *stale* (compilación vieja) y devolvía un **404 HTML** en `POST /api/tournaments/singleplayer`. El `res.json()` del cliente fallaba al parsear ese HTML. NO era un bug del código.
- **Resolución:** se reinició el dev server limpio. Verificado el flujo completo por HTTP contra la DB real (Neon):
  - `POST /api/draft/singleplayer` → 200
  - `POST /api/tournaments/singleplayer` (Ir al Mundial) → 200 JSON, torneo con 12 grupos de 4.
  - `POST /api/tournaments/simulate` → 200 JSON, campeón + bracket completo (R32→Final).
  - Entry humano con stats por línea reales (ataque 84 / medio 80 / def 77 / gk 79 / ovr 80), confirmando C1.
- DB confirmada seedeada: 48 selecciones, 1176 jugadores (IDs UUID), 3 formaciones.
- **Mejora futura (DX):** el cliente debería manejar respuestas no-JSON (ej. chequear `res.ok`/`content-type` antes de `res.json()`) para no mostrar errores de parseo confusos cuando el server devuelve HTML. Anotado como mejora menor.

### 2026-06-09 — Simulación al crear el torneo + batching de writes (performance)
**Decisión del usuario:** simular todo el Mundial en el mismo paso de creación (al "Ir al Mundial"), para que la única espera ocurra una vez y la reproducción posterior sea instantánea.

**Implementado:**
- `src/lib/tournaments/simulate.ts` (nuevo): `simulateSingleplayerTournament(tournamentId)` — extrae toda la lógica de simulación+persistencia (antes inline en el endpoint).
- `src/lib/tournaments/singleplayer.ts`: `createSingleplayerTournament` ahora llama a la simulación al final → el torneo queda `FINISHED` apenas se cierra el draft.
- `src/app/api/tournaments/simulate/route.ts`: reducido a un fallback delgado (para torneos viejos en `GROUP_STAGE`); usa la función extraída.
- `src/features/tournament/components/client-tournament.tsx`: el preview ya no se decide por `isSimulated` (ahora siempre true) sino por el progreso de reproducción guardado (`revealed===0` → preview). "Iniciar el Mundial" es instantáneo (sin red) para torneos nuevos; mantiene el fetch como fallback para torneos viejos. Sin registro previo → arranca en el preview (antes "mostrar todo").

**Performance (clave):** la primera medición del finalize combinado tardó **17.4 s** (≈300 writes secuenciales a Neon vía HTTP) — habría dado timeout en Vercel. Se batchearon los writes:
- Posiciones de grupo: `delete` + `insert` en bloque (2 idas en vez de 48).
- Updates de partidos de grupo: en tandas paralelas acotadas (`inBatches`, 25).
- Eventos de grupo: `delete` masivo + `insert` en bloque.
- Bracket KO: ids pre-generados (`randomUUID`) + bulk insert de partidos y de eventos.
- Resultado: **17.4 s → 3.9 s**.

**Verificación (DB real):** finalize deja `FINISHED` + campeón; 103 partidos (72 grupo + 31 KO), ~387 eventos; auditoría de goleadores 364/0 errores; `/tournament` renderiza el flujo nuevo; `tsc` sin errores.

**Pendiente derivado (perf):** la creación del torneo todavía hace ~36 writes secuenciales (entries/standings/fixtures por grupo); batchearlos bajaría más los ~3.9 s. Anotado como mejora. → **RESUELTO abajo.**

### 2026-06-09 — Batching de la creación del torneo (performance)
- `src/lib/tournaments/singleplayer.ts`: el loop por grupo hacía ~36 writes secuenciales (12 updates de `groupCode` + 12 inserts de standings + 12 inserts de fixtures). Ahora: los 12 updates de `groupCode` van en paralelo (una tanda con `Promise.all`), y standings + fixtures se insertan con **un bulk insert cada uno** (flatMap de todos los grupos).
- **Resultado:** finalize **3.9 s → ~2.7 s** (warm). Total acumulado desde el inicio: **17.4 s → 2.7 s**.
- Verificado: status `FINISHED`, 103 partidos, `tsc` sin errores.
- Próxima optimización posible (no hecha, retorno menor): los 72 updates de partidos de grupo en `simulate.ts` podrían eliminarse insertando los partidos con resultado directamente en la simulación (como el bracket KO), en vez de crearlos vacíos y actualizarlos. → **RESUELTO abajo.**

### 2026-06-09 — Partidos de grupo insert-only (performance + simplificación)
- `src/lib/tournaments/simulate.ts`: los partidos de grupo ahora se **INSERTAN ya con resultado** (igual que el bracket KO), usando el orden local/visitante del propio simulador. Desaparecieron los 72 updates **y** toda la lógica de flip de `side` (menos superficie de bugs). La persistencia es idempotente: borra `matches` (cascadea eventos) y `group_standings` del torneo antes de re-insertar todo en bloque.
- `src/lib/tournaments/singleplayer.ts`: la creación ya **no** inserta fixtures ni standings vacíos (los crea la simulación). Eliminada la función `createRoundRobinPairings` (sin uso) e imports `matches`/`groupStandings`. Quedan solo: insert de entries + update de `groupCode` en paralelo + llamada a simular.
- **Resultado:** finalize **2.7 s → 2.1 s** (warm). Total acumulado: **17.4 s → 2.1 s**.
- Verificado (DB real): status `FINISHED`; conteo exacto por ronda sin duplicados (GROUP:72, R32:16, R16:8, QF:4, SF:2, FINAL:1); auditoría de goleadores 352/0 errores; `tsc` sin errores. La persistencia idempotente (delete-before-insert) además protege a torneos viejos vía el endpoint fallback.

### 2026-06-09 — Fase 4 cerrada: historial, stats de la run y card compartible
**Historial:**
- `src/lib/tournaments/history.ts` (nuevo): `getUserTournamentHistory(sessionToken)` — lista torneos FINISHED del usuario con campeón y hasta dónde llegó su equipo (campeón / eliminado en ronda X / fase de grupos).
- `src/app/historial/page.tsx` (nuevo): página con la lista de campañas + contador de títulos. Links desde la home y desde el result card.

**Stats de la run:**
- `src/lib/tournaments/overview.ts`: el overview ahora calcula `topScorer` (goleador del torneo, solo goles de juego) a partir de los eventos ya cargados, sin query extra.
- El camino del equipo (desenlace + goles a favor/contra) se computa en el cliente (`computeHumanRun`).

**Card compartible:**
- `src/lib/tournaments/card-data.ts` (nuevo): `getTournamentCardData(tournamentId)` — datos del card por id (público; el id es UUID).
- `src/app/tournament/[tournamentId]/card/route.tsx` (nuevo): imagen OG (1200×630) vía `next/og` con el desenlace, el equipo, el campeón y las stats. Verificado: devuelve `image/png` 200 (70 KB).
- `src/features/tournament/components/client-tournament.tsx`: la escena final pasó de un `ChampionSection` simple a un `ResultCard` con stats + botones **Compartir** (Web Share API con fallback a copiar link), **Ver imagen** (abre la card OG) e **Historial**.

**Verificación:** flujo completo OK; `/historial` renderiza desenlace + fecha; card OG devuelve PNG válido (probado caso "eliminado"); `topScorer` llega al payload del cliente; `tsc` sin errores.
**Nota:** Fase 4 del plan ("guardar torneos finalizados") ya estaba cubierta por la persistencia existente. Falta-nada pendiente menor: per-tournament detail page (el historial es lista; no hay deep-link al detalle de un torneo viejo — el `/tournament` muestra el último).

### 2026-06-09 — C4: persistencia atómica de la simulación (db.batch)
**Contexto:** `simulate` hacía varias escrituras secuenciales sin transacción → un fallo a mitad dejaba el torneo a medio escribir. El driver `neon-http` NO soporta `db.transaction()`.
**Solución (sin migrar driver):** se descubrió que `db.batch()` en neon-http se ejecuta como **transacción atómica** (verificado: un batch con statement fallido revierte todo → 0 filas). Se reagrupó toda la persistencia del resultado en `src/lib/tournaments/simulate.ts` en un único `db.batch([...])` (delete matches + delete standings + insert standings + insert matches + insert events + update tournament FINISHED), respetando el orden (borrar antes de insertar; partidos antes que eventos por la FK).
**Verificación:** flujo completo OK (FINISHED, conteos exactos, 320 goleadores 0 errores); `tsc` sin errores.
**Nota:** la *creación* del torneo (inserts con IDs returning) no es un único batch por sus dependencias secuenciales, pero está cubierta por la recuperación idempotente (re-ejecutar la creación limpia los torneos previos del usuario). Transacciones interactivas completas requerirían migrar a la conexión WebSocket (`neon-serverless` Pool) — no necesario por ahora.

### 2026-06-09 — M5: pool de draft con fuente única (DB-only)
**Contexto:** `draft-bootstrap.ts` mezclaba el JSON generado (`players.mvp.json`, IDs `slug:slug`) con la DB (UUIDs), produciendo IDs inconsistentes y un merge impredecible. C1 dependía de que el pool usara UUIDs de DB.
**Solución:**
- `src/lib/db/schema.ts`: nuevas columnas `club` y `birth_date` (nullable) en `players`. Migración `drizzle/0001_silly_leader.sql` aplicada.
- `scripts/seed-rosters.mjs`: ahora siembra `club`/`birthDate` desde el JSON. Reseed ejecutado (893 con club, 1083 con fecha de nac.).
- `src/lib/db/queries/draft-pool.ts`: `listReadyDraftCountries` devuelve `club`/`birthDate`.
- `src/lib/game/draft-bootstrap.ts`: reescrito **DB-only** (eliminada toda lectura/merge del JSON). El JSON queda solo como insumo del seed.
**Verificación:** el payload de `/draft` trae clubs (Real Madrid, Fulham…), fechas de nac. y UUIDs de DB; **sin IDs `slug:slug`**; `tsc` sin errores. Ningún módulo de runtime lee ya el JSON.
**Para prod:** correr `npm run db:migrate` y `npm run db:seed-rosters` para tener las columnas pobladas.
**Pendiente menor:** `isPlayerReadyForMvp`/`getPlayerLockReason` en `rules.ts` quedaron sin uso (el lock por enrichment ya no aplica con DB-only); se pueden borrar en una limpieza.

### 2026-06-09 — C5 (CRÍTICO): selecciones reales usaban jugadores ajenos
**Bug:** los goleadores/tarjetas salían de un **pool global hardcodeado de jugadores famosos** en `match.ts` (Irak marcaba con Neymar/Kane/Salah). El motor nunca usó los planteles reales. Rompía el concepto del juego.

**Fix — cada equipo usa su roster real (solo el humano usa el draft):**
- `src/lib/sim/types.ts`: `TeamStats` ahora lleva `roster?: TeamRoster` (`goalScorers`, `defenders`).
- `src/lib/sim/roster.ts` (nuevo): `buildTeamRoster()` segmenta el plantel por rol (goles ← ataque/medio, tarjetas ← defensa/medio), con fallback al plantel completo.
- `src/lib/sim/match.ts`: eliminado el pool global; goles, tarjetas y penales eligen del roster real del equipo que protagoniza el evento. Sin roster → sin nombre (nunca inventa).
- `src/app/api/tournaments/simulate/route.ts`: carga los jugadores reales por selección (`players` agrupados por `national_team_id`) y el plantel drafteado del humano; adjunta el roster a cada entry. El roster viaja por `teamStatsById` hasta la fase KO.

**Bug secundario detectado y corregido (atribución de goleador):** los partidos de grupo en DB tienen orden local/visitante distinto al del simulador; el `side` de los eventos se guardaba en el orden del simulador, cruzando goleadores entre los dos equipos. Se agregó el flip de `side` cuando el orden difiere (en el mapeo de eventos de grupo del endpoint `simulate`).

**Verificación (DB real, flujo completo):**
- Auditoría de **346 goles, 0 errores**: cada goleador pertenece al equipo acreditado (selecciones reales contra su plantel de DB; equipo humano contra su draft).
- `npx tsc --noEmit` → sin errores.
- Nota: el primer intento mostró 2 errores por un dev server con código viejo; tras reiniciar limpio, 0.

### 2026-06-09 — Reproducción del Mundial partido a partido (UX/jugabilidad)
**Requerimiento del usuario:** el torneo debía vivirse partido a partido (no simular todo de golpe). Inicia el Mundial → ve su grupo → "Continuar" revela su 1er partido con resultado instantáneo → 2do → 3ro → resumen de su grupo + resto de grupos → luego cada ronda KO (su cruce + resumen de la ronda) → campeón. Prioridad gráfica: sus resultados primero, el resto en segundo plano. Además: en eliminatorias mostrar el **nombre completo** del país (antes se recortaba a la inicial).

**Decisiones (confirmadas con el usuario):**
- Motor: **pre-simular y revelar** (el server calcula todo una vez —determinista— y el cliente lo reproduce escena por escena). Instantáneo por clic, sin writes extra, sin tocar infra.
- Al volver a un Mundial ya simulado sin progreso guardado: **mostrar todo el resumen**.
- Partidos destacados (los del usuario): muestran **goleadores** en los partidos de grupo (los KO no guardan eventos hoy → solo marcador).

**Implementado en `src/features/tournament/components/client-tournament.tsx` (reescrito):**
- Máquina de escenas: `group-match` ×3 → `group-summary` → por cada ronda KO presente: `ko-match` (si el usuario juega) + `ko-summary` → `champion`.
- Estado previo (torneo no simulado): preview del grupo del usuario + botón "Iniciar el Mundial".
- Reproducción con botón "Continuar" (revela una escena a la vez, auto-scroll) + atajo "Ver todo el resumen".
- Progreso de reproducción persistido en `localStorage` por `tournamentId`.
- **Nombres completos** sin `truncate`; resúmenes de KO en grilla de 2 columnas (antes 4, que recortaba a iniciales).
- Componentes nuevos: `FeaturedMatch` (partidos del usuario, con veredicto Victoria/Empate/Derrota o Avanzás/Eliminado + goleadores), `SummaryMatch`, `StandingsTable` (con modo `dense` para los grupos del resto).

**Verificación:**
- `npx tsc --noEmit` → sin errores.
- Smoke test HTTP contra la DB real: preview renderiza "Iniciar el Mundial"/"Tu grupo"; tras simular renderiza la reproducción ("Continuar") y los nombres completos de países.

**Nota:** Las escenas se revelan del lado del cliente (post-hidratación), por lo que el HTML SSR inicial no las contiene — comportamiento esperado de una UI manejada por `localStorage`.

### 2026-06-09 — Mejora DX: parseo seguro de respuestas
- Agregado helper `readJsonSafe<T>(res)` en `draft-workbench.tsx` y `client-tournament.tsx`: lee `res.text()` y parsea con try/catch, devolviendo `null` si el body no es JSON.
- `finalize()` (Ir al Mundial) y `SimulateButton` ahora chequean `!res.ok || !data` y muestran un mensaje claro con el status (ej. "No se pudo abrir el Mundial (error 404)") en vez del cripto `Unexpected token '<'`.
- `npx tsc --noEmit` → sin errores.
</content>
