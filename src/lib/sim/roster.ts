import type { TeamRoster } from './types'

// Posiciones consideradas ofensivas (protagonizan goles) y defensivas (tarjetas).
const ATTACKING_POSITIONS = new Set(['ST', 'CF', 'LF', 'RF', 'LW', 'RW', 'CAM'])
const MIDFIELD_POSITIONS = new Set(['CM', 'CDM', 'LM', 'RM'])
const DEFENSIVE_POSITIONS = new Set(['CB', 'LB', 'RB', 'LWB', 'RWB', 'SW'])

export type RosterPlayer = {
  name: string
  primaryPosition: string
}

// Construye el roster real de un equipo segmentado por rol. Los goles salen de
// delanteros y mediocampistas; las tarjetas de defensores y mediocampistas. Si
// alguna lista quedara vacia, cae al plantel completo para nunca inventar nombres
// de otra seleccion.
export function buildTeamRoster(players: RosterPlayer[]): TeamRoster {
  const goalScorers: string[] = []
  const defenders: string[] = []

  for (const player of players) {
    const position = player.primaryPosition

    if (ATTACKING_POSITIONS.has(position)) {
      goalScorers.push(player.name)
    } else if (MIDFIELD_POSITIONS.has(position)) {
      goalScorers.push(player.name)
      defenders.push(player.name)
    } else if (DEFENSIVE_POSITIONS.has(position)) {
      defenders.push(player.name)
    } else if (position !== 'GK') {
      goalScorers.push(player.name)
    }
  }

  const all = players.map((player) => player.name)

  return {
    goalScorers: goalScorers.length > 0 ? goalScorers : all,
    defenders: defenders.length > 0 ? defenders : all,
  }
}
