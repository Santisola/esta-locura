# Schema Resumen - Esta Locura

## Objetivo

Este documento resume el schema inicial pensado para `Neon Postgres` usando `Drizzle ORM`.

## Entidades principales

- `users`: usuarios guest por `sessionToken`
- `national_teams`: 48 selecciones del Mundial 2026
- `players`: convocados de cada seleccion
- `formations`: catalogo de formaciones y slots
- `rooms`: salas privadas multiplayer
- `room_participants`: jugadores dentro de una sala
- `drafted_teams`: equipos armados por usuarios
- `drafted_team_players`: picks del draft por slot
- `tournaments`: instancia de un Mundial jugado
- `tournament_entries`: participantes del torneo, humanos o selecciones reales
- `group_standings`: tabla persistida de grupos
- `matches`: partidos del torneo
- `match_events`: eventos clave de cada partido

## Relaciones clave

- una `national_team` tiene muchos `players`
- una `room` tiene muchos `room_participants`
- un `drafted_team` pertenece a un `user` y opcionalmente a una `room`
- un `drafted_team` tiene muchos `drafted_team_players`
- un `tournament` pertenece opcionalmente a una `room`
- un `tournament` tiene muchos `tournament_entries`
- un `tournament_entry` puede apuntar a un `drafted_team` o a una `national_team`
- un `tournament` tiene muchos `matches`
- un `match` tiene muchos `match_events`

## Decisiones importantes

### Usuario guest primero

No hay auth compleja en la fase inicial. `users.sessionToken` permite reconexion y persistencia basica sin depender de login social.

### Equipo humano vs equipo real

La distincion se modela en `tournament_entries.entry_type`:

- `HUMAN_DRAFTED`
- `REAL_TEAM`

Esto deja al simulador trabajar contra una interfaz unica.

### Formaciones como datos

`formations.slots` vive en `jsonb` para no sobre-normalizar temprano. El motor puede leer un array de slots como:

```json
[
  { "code": "GK", "lane": "GK", "order": 1 },
  { "code": "LB", "lane": "DEF", "order": 2 },
  { "code": "CB1", "lane": "DEF", "order": 3 }
]
```

### Standings persistidos

`group_standings` evita recalcular tablas complejas cada vez que se renderiza el torneo y facilita debugging.

## Proximos archivos tecnicos a crear en implementacion real

- `src/lib/db/client.ts`
- `src/lib/db/queries/*.ts`
- `src/lib/seeds/national-teams.ts`
- `src/lib/seeds/players.ts`
- `src/lib/sim/*.ts`
