# Plan de Implementacion - Esta Locura

## 1. Vision del producto

`Esta Locura` es un juego web donde cada usuario arma un once ideal a partir de selecciones del Mundial 2026, usando una mecanica de ruleta/dado por pais. Luego ese equipo compite en una simulacion completa del torneo. El producto debe soportar dos modos:

- `Singleplayer`: experiencia completa local/persistida contra selecciones reales.
- `Multiplayer`: salas privadas donde varios usuarios hacen el draft en simultaneo y juegan el mismo torneo compartido.

## 2. Objetivos tecnicos

- Lanzar un MVP con costo cero o muy bajo usando free tiers.
- Diseñar el juego con arquitectura modular para que el singleplayer y el multiplayer compartan reglas.
- Mantener un servidor autoritativo para decisiones criticas del draft y de la simulacion.
- Separar claramente persistencia, estado realtime y UI.

## 3. Stack tecnologico propuesto

### Frontend

- `Next.js` sobre `Vercel`
- `React` + `TypeScript`
- `Tailwind CSS` para UI rapida y consistente
- `Zustand` para estado cliente
- `Zod` para contratos y validaciones

### Backend y APIs

- `Next.js Route Handlers` / `Server Actions` para APIs HTTP
- `PartyKit` para sincronizacion realtime de salas, draft y torneo en vivo

### Persistencia

- `Neon Postgres` como base de datos principal
- `Drizzle ORM` para esquema, migraciones y consultas tipadas

### Servicios opcionales

- `@vercel/og` o `Satori` para generar la card final compartible
- `Upstash Redis` solo si en el futuro se necesita rate limiting o cache adicional

## 4. Arquitectura general

### Vercel

Responsable de:

- Renderizar la aplicacion web
- Resolver endpoints para partidas, historial, seeds y configuracion
- Ejecutar logica no realtime
- Generar assets compartibles como la card final

### Neon

Responsable de:

- Guardar selecciones y jugadores
- Guardar salas y participantes
- Guardar equipos drafteados
- Guardar torneos, partidos y resultados
- Servir como fuente persistente del historial del juego

### PartyKit

Responsable de:

- Mantener el estado vivo de cada sala
- Sincronizar lobby y presencia
- Orquestar el draft simultaneo
- Emitir actualizaciones del bracket y de los partidos
- Manejar reconexion y snapshots de sala

## 5. Principios de arquitectura

- `Partykit` es autoritativo para el estado realtime de una sala en curso.
- `Neon` es autoritativo para datos persistentes e historial.
- El cliente nunca decide resultados, picks validos ni uso de rerolls.
- La simulacion debe ser un modulo reutilizable, independiente de la UI.
- El flujo multiplayer debe reutilizar el motor del singleplayer.

## 6. Estructura funcional del juego

### Fase de configuracion

El usuario elige:

- formacion tactica
- modo de dificultad (`Clasico` o `Memoria`)
- arranque de partida singleplayer o entrada a sala multiplayer

### Fase de draft

- Se muestra el campo con 11 posiciones segun la formacion.
- El sistema selecciona aleatoriamente una de las 48 selecciones.
- El usuario elige un jugador elegible para alguna posicion aun vacia.
- Cada posicion se bloquea una vez ocupada.
- El usuario dispone de un numero limitado de rerolls.

### Fase de torneo

- Se genera un Mundial 2026 completo.
- Se juegan grupos de 4 equipos.
- Clasifican primeros, segundos y los mejores terceros.
- Se construye la llave eliminatoria.
- Se simulan partidos con eventos clave y penales si aplica.

## 7. Modelo de datos recomendado

### Tablas principales

#### `national_teams`

- `id`
- `name`
- `code`
- `confederation`
- `attack`
- `midfield`
- `defense`
- `goalkeeping`
- `ovr`

#### `players`

- `id`
- `national_team_id`
- `name`
- `primary_position`
- `secondary_positions` (array)
- `attack`
- `midfield`
- `defense`
- `goalkeeping`
- `ovr`

#### `rooms`

- `id`
- `code`
- `host_user_id`
- `status`
- `mode`
- `rerolls`
- `created_at`

#### `room_participants`

- `id`
- `room_id`
- `user_id`
- `nickname`
- `is_host`
- `is_ready`
- `draft_status`

#### `drafted_teams`

- `id`
- `room_id` o `null` si es singleplayer
- `user_id`
- `formation`
- `mode`
- `rerolls_left`
- `status`

#### `drafted_team_players`

- `id`
- `drafted_team_id`
- `player_id`
- `slot_code`
- `source_national_team_id`

#### `tournaments`

- `id`
- `room_id` o `null`
- `type`
- `status`
- `current_round`

#### `tournament_entries`

- `id`
- `tournament_id`
- `entry_type` (`HUMAN_DRAFTED` | `REAL_TEAM`)
- `display_name`
- `drafted_team_id` nullable
- `national_team_id` nullable

#### `matches`

- `id`
- `tournament_id`
- `round`
- `stage_order`
- `home_entry_id`
- `away_entry_id`
- `home_score`
- `away_score`
- `winner_entry_id`
- `went_to_penalties`

#### `match_events`

- `id`
- `match_id`
- `minute`
- `event_type`
- `side`
- `player_name`
- `payload`

## 8. Diferenciacion entre equipo humano y seleccion real

La separacion debe resolverse en `tournament_entries`:

- `HUMAN_DRAFTED`: referencia a `drafted_team_id`
- `REAL_TEAM`: referencia a `national_team_id`

Con este enfoque, el simulador siempre consume una abstraccion comun: `equipo participante del torneo`, sin importar si fue armado por una persona o si es una seleccion real que completa cupos vacios.

## 9. Motor de simulacion

### Inputs

- ratings por jugador
- formacion elegida
- once inicial completo
- stats base de selecciones reales

### Salidas

- resultado final
- eventos del partido
- ganador
- definicion por penales si corresponde

### Logica recomendada

- Calcular rating de lineas: `GK`, `DEF`, `MID`, `ATT`
- Comparar ataque rival contra defensa y arquero
- Introducir `RNG` acotado para mantener sorpresas sin romper coherencia
- Simular entre 6 y 10 secuencias ofensivas por partido
- Resolver penales ponderando `goalkeeping`, `ovr` y factor aleatorio

## 10. Lobbies y sincronizacion multiplayer

### Reglas base

- Cada sala tiene host, codigo unico y configuracion comun.
- Cada jugador conserva su propio draft.
- Todos ven el avance global del resto.
- El torneo compartido arranca cuando el draft termina o cuando el host fuerza cierre segun reglas del MVP.

### Responsabilidades por capa

- Cliente: UI, animaciones, interaccion y render de snapshots
- PartyKit: estado vivo de la sala, validacion de acciones y broadcast
- Neon: persistencia final de equipos, torneo y resultados

## 11. Eventos realtime recomendados

### Lobby

- `room:create`
- `room:join`
- `room:leave`
- `room:state`
- `room:player-joined`
- `room:player-left`
- `room:ready-toggled`
- `room:start`

### Draft

- `draft:started`
- `draft:roll`
- `draft:country-result`
- `draft:reroll`
- `draft:pick-player`
- `draft:pick-confirmed`
- `draft:progress`
- `draft:completed`

### Torneo

- `tournament:generated`
- `tournament:round-started`
- `match:started`
- `match:event`
- `match:finished`
- `tournament:updated`
- `tournament:finished`

## 12. Estructura de carpetas sugerida

```text
src/
  app/
  components/
  features/
    draft/
    tournament/
    rooms/
    setup/
  lib/
    db/
    sim/
    auth/
    seeds/
    validations/
partykit/
drizzle/
public/
docs/
```

## 13. Riesgos principales

- conseguir dataset consistente de 48 selecciones y convocados
- definir ratings creibles si no existe una fuente oficial reutilizable
- sincronizacion de reconexion en mitad del draft
- mantener consistencia entre estado realtime y persistencia final
- no sobrepasar limites de free tier en entornos compartidos

## 14. Criterios de exito del MVP

- el usuario puede jugar una run singleplayer completa sin errores
- el sistema genera correctamente el Mundial 2026 con su formato real
- las salas privadas sincronizan el draft entre varios usuarios
- los cupos vacios se rellenan con selecciones reales automaticamente
- todos los clientes ven el mismo bracket y los mismos resultados

## 15. Recomendacion de ejecucion

Construir primero un singleplayer pulido y estable. Una vez validado el loop de draft + torneo + persistencia, montar el multiplayer usando el mismo simulador y las mismas reglas de negocio.
