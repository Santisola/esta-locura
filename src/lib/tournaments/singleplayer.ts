import 'server-only'

import { and, eq, inArray } from 'drizzle-orm'

import { getDb } from '@/lib/db/client'
import {
  draftedTeamPlayers,
  draftedTeams,
  formations,
  nationalTeams,
  players,
  tournamentEntries,
  tournaments,
  users,
} from '@/lib/db/schema'
import { simulateSingleplayerTournament } from '@/lib/tournaments/simulate'

const GROUP_CODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

type Lane = 'GK' | 'DEF' | 'MID' | 'ATT'

type DraftedPlayerRating = {
  slotCode: string
  attack: number
  midfield: number
  defense: number
  goalkeeping: number
  ovr: number
}

// Calcula las stats del equipo humano a partir de los jugadores realmente
// drafteados, agregando por linea segun la formacion elegida. Asi la habilidad
// del draft (que jugadores y en que posiciones) impacta directamente la
// simulacion, en vez de usar el rating de las selecciones de origen.
function computeDraftedTeamRatings(
  draftedPlayers: DraftedPlayerRating[],
  laneBySlot: Map<string, Lane>,
) {
  const byLane: Record<Lane, DraftedPlayerRating[]> = { GK: [], DEF: [], MID: [], ATT: [] }

  for (const player of draftedPlayers) {
    const lane = laneBySlot.get(player.slotCode)
    if (lane) {
      byLane[lane].push(player)
    }
  }

  // Rating de cada linea usando el atributo dominante de esa zona, con fallback
  // al promedio general del equipo si la linea quedara vacia.
  const overallOvr = average(draftedPlayers.map((p) => p.ovr))
  const laneRating = (lane: Lane, attribute: keyof DraftedPlayerRating) => {
    const group = byLane[lane]
    if (group.length === 0) {
      return overallOvr
    }
    return average(group.map((p) => Number(p[attribute])))
  }

  const attack = laneRating('ATT', 'attack')
  const midfield = laneRating('MID', 'midfield')
  const defense = laneRating('DEF', 'defense')
  const goalkeeping = laneRating('GK', 'goalkeeping')

  return {
    attack,
    midfield,
    defense,
    goalkeeping,
    // La media = promedio de las 4 líneas (coincide con el box score del draft).
    ovr: Math.round((attack + midfield + defense + goalkeeping) / 4),
  }
}

function average(numbers: number[]) {
  if (numbers.length === 0) {
    return 0
  }

  return Math.round(numbers.reduce((sum, value) => sum + value, 0) / numbers.length)
}

function createSeedFromString(value: string) {
  let hash = 0

  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) % 2147483647
  }

  return hash
}

function createRng(seed: number) {
  let state = seed

  return () => {
    state = (state * 48271) % 2147483647
    return state / 2147483647
  }
}

function shuffle<T>(array: T[], seedSource: string) {
  const rng = createRng(createSeedFromString(seedSource))
  const clone = [...array]

  for (let index = clone.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1))
    ;[clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]]
  }

  return clone
}


export async function createSingleplayerTournament(sessionToken: string) {
  const db = getDb()
  const user = await db.query.users.findFirst({
    where: eq(users.sessionToken, sessionToken),
  })

  if (!user) {
    throw new Error('No existe una sesion valida para crear el torneo.')
  }

  const draftedTeam = await db.query.draftedTeams.findFirst({
    where: and(eq(draftedTeams.userId, user.id), eq(draftedTeams.status, 'COMPLETED')),
    orderBy: (table, { desc }) => [desc(table.updatedAt)],
  })

  if (!draftedTeam) {
    throw new Error('No existe un equipo draft completado para iniciar el torneo.')
  }

  // Limpia SOLO los torneos singleplayer previos de ESTE usuario (vinculados a
  // sus equipos drafteados), no los de otros. El vinculo usuario->torneo se
  // resuelve via tournament_entries.drafted_team_id -> drafted_teams.user_id.
  const userDraftedTeams = await db
    .select({ id: draftedTeams.id })
    .from(draftedTeams)
    .where(eq(draftedTeams.userId, user.id))

  const userDraftedTeamIds = userDraftedTeams.map((team) => team.id)

  if (userDraftedTeamIds.length > 0) {
    const priorEntries = await db
      .select({ tournamentId: tournamentEntries.tournamentId })
      .from(tournamentEntries)
      .where(inArray(tournamentEntries.draftedTeamId, userDraftedTeamIds))

    const priorTournamentIds = [...new Set(priorEntries.map((entry) => entry.tournamentId))]

    if (priorTournamentIds.length > 0) {
      await db
        .delete(tournaments)
        .where(
          and(eq(tournaments.type, 'SINGLEPLAYER'), inArray(tournaments.id, priorTournamentIds)),
        )
    }
  }

  const draftedPlayers = await db
    .select({
      slotCode: draftedTeamPlayers.slotCode,
      attack: players.attack,
      midfield: players.midfield,
      defense: players.defense,
      goalkeeping: players.goalkeeping,
      ovr: players.ovr,
    })
    .from(draftedTeamPlayers)
    .innerJoin(players, eq(draftedTeamPlayers.playerId, players.id))
    .where(eq(draftedTeamPlayers.draftedTeamId, draftedTeam.id))

  if (draftedPlayers.length === 0) {
    throw new Error('El equipo draft no tiene jugadores persistidos para calcular sus ratings.')
  }

  const formation = await db.query.formations.findFirst({
    where: eq(formations.id, draftedTeam.formationId),
  })

  if (!formation) {
    throw new Error('No existe la formacion asociada al equipo draft.')
  }

  const laneBySlot = new Map<string, Lane>(
    formation.slots.map((slot) => [slot.code, slot.lane]),
  )

  const draftedRatings = computeDraftedTeamRatings(draftedPlayers, laneBySlot)

  const [createdTournament] = await db
    .insert(tournaments)
    .values({
      type: 'SINGLEPLAYER',
      status: 'GROUP_STAGE',
      currentRound: 'GROUP',
      startedAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: tournaments.id })

  const realTeams = await db.query.nationalTeams.findMany()

  if (realTeams.length < 47) {
    throw new Error('No hay suficientes selecciones reales cargadas para armar un Mundial de 48 equipos.')
  }

  const shuffledOpponents = shuffle(
    realTeams.slice(0, 47),
    draftedTeam.id
  )

  const [draftedEntry] = await db
    .insert(tournamentEntries)
    .values({
      tournamentId: createdTournament.id,
      entryType: 'HUMAN_DRAFTED',
      displayName: 'Tu Seleccion Draft',
      draftedTeamId: draftedTeam.id,
      computedAttack: draftedRatings.attack,
      computedMidfield: draftedRatings.midfield,
      computedDefense: draftedRatings.defense,
      computedGoalkeeping: draftedRatings.goalkeeping,
      computedOvr: draftedRatings.ovr,
      metadata: { origin: 'draft' },
    })
    .returning({ id: tournamentEntries.id })

  const opponentEntries = await db
    .insert(tournamentEntries)
    .values(
      shuffledOpponents.map((team) => ({
        tournamentId: createdTournament.id,
        entryType: 'REAL_TEAM' as const,
        displayName: team.name,
        nationalTeamId: team.id,
        computedAttack: team.attack,
        computedMidfield: team.midfield,
        computedDefense: team.defense,
        computedGoalkeeping: team.goalkeeping,
        computedOvr: team.ovr,
        metadata: { origin: 'national-team', slug: team.slug },
      }))
    )
    .returning({ id: tournamentEntries.id })

  const allEntries = shuffle([draftedEntry.id, ...opponentEntries.map((entry) => entry.id)], `groups:${draftedTeam.id}`)
  const groupedEntries = GROUP_CODES.map((code, index) => ({
    code,
    entryIds: allEntries.slice(index * 4, index * 4 + 4),
  }))

  // Asignacion de grupo: los 12 updates en paralelo (una sola tanda).
  await Promise.all(
    groupedEntries.map((group) =>
      db
        .update(tournamentEntries)
        .set({ groupCode: group.code })
        .where(inArray(tournamentEntries.id, group.entryIds)),
    ),
  )

  // Simula todo el Mundial en el mismo paso de creacion. La simulacion crea los
  // partidos (de grupo y eliminatorios) ya con resultado y las posiciones; por eso
  // aca no se insertan fixtures ni standings vacios. Asi la unica espera del usuario
  // ocurre al cerrar el draft y la reproduccion posterior es instantanea.
  await simulateSingleplayerTournament(createdTournament.id)

  return {
    tournamentId: createdTournament.id,
    reused: false,
    groups: groupedEntries.map((group) => ({
      code: group.code,
      size: group.entryIds.length,
    })),
  }
}
