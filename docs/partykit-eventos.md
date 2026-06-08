# Contrato Inicial de Eventos Realtime

## Objetivo

Definir un contrato base para `PartyKit` antes de implementar la logica de salas, draft y torneo.

## Convenciones

- cada mensaje lleva `type`
- el payload lleva `roomId` cuando aplica
- las acciones mutables deben incluir `actionId` para deduplicacion
- el servidor responde con snapshot o evento incremental segun el caso

## Eventos del lobby

### Cliente -> servidor

- `room.create`
- `room.join`
- `room.leave`
- `room.toggleReady`
- `room.start`
- `room.requestState`

### Servidor -> cliente

- `room.state`
- `room.playerJoined`
- `room.playerLeft`
- `room.playerUpdated`
- `room.error`

## Eventos del draft

### Cliente -> servidor

- `draft.configureTeam`
- `draft.roll`
- `draft.reroll`
- `draft.pickPlayer`
- `draft.requestState`

### Servidor -> cliente

- `draft.state`
- `draft.countryResult`
- `draft.pickConfirmed`
- `draft.progressUpdated`
- `draft.completed`
- `draft.error`

## Eventos del torneo

### Cliente -> servidor

- `tournament.requestState`
- `tournament.startNextRound`

### Servidor -> cliente

- `tournament.generated`
- `tournament.state`
- `tournament.roundStarted`
- `match.started`
- `match.event`
- `match.finished`
- `tournament.finished`

## Snapshot minimo de sala

```json
{
  "roomId": "room_123",
  "status": "LOBBY",
  "hostUserId": "user_1",
  "difficultyMode": "CLASSIC",
  "rerollsPerPlayer": 3,
  "participants": []
}
```

## Snapshot minimo de draft por usuario

```json
{
  "draftedTeamId": "team_123",
  "formationCode": "4-3-3",
  "rerollsLeft": 2,
  "completedSlots": 5,
  "totalSlots": 11,
  "currentCountry": {
    "teamId": "argentina",
    "name": "Argentina"
  }
}
```

## Snapshot minimo de torneo

```json
{
  "tournamentId": "tourn_123",
  "status": "GROUP_STAGE",
  "currentRound": "GROUP",
  "entries": [],
  "groups": [],
  "matches": []
}
```
