import 'server-only'

import { eq, inArray } from 'drizzle-orm'

import { getDb } from '@/lib/db/client'
import {
  draftedTeamPlayers,
  draftedTeams,
  formations,
  nationalTeams,
  players,
  tournamentEntries,
  tournaments,
} from '@/lib/db/schema'
import { simulateTournament } from '@/lib/tournaments/simulate'

type Lane = 'GK' | 'DEF' | 'MID' | 'ATT'

type DraftedPlayerRating = {
  slotCode: string
  attack: number
  midfield: number
  defense: number
  goalkeeping: number
  ovr: number
}

export type HumanEntryInput = {
  draftedTeamId: string
  displayName: string
  ratings: {
    attack: number
    midfield: number
    defense: number
    goalkeeping: number
    ovr: number
  }
}

export type CreateTournamentParams = {
  type: 'SINGLEPLAYER' | 'MULTIPLAYER'
  roomId?: string
  humans: HumanEntryInput[]
  separateHumans: boolean
  seedBase: string
}

// Los 12 códigos de grupo del Mundial 2026.
const GROUP_CODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

// Calcula las stats del equipo humano a partir de los jugadores realmente
// drafteados, agregando por linea segun la formacion elegida.
export function computeDraftedTeamRatings(
  draftedPlayers: DraftedPlayerRating[],
  laneBySlot: Map<string, Lane>,
) {
  const byLane: Record<Lane, DraftedPlayerRating[]> = { GK: [], DEF: [], MID: [], ATT: [] }

  for (const player of draftedPlayers) {
    const lane = laneBySlot.get(player.slotCode)
    if (lane) byLane[lane].push(player)
  }

  const overallOvr = average(draftedPlayers.map((p) => p.ovr))
  const laneRating = (lane: Lane, attribute: keyof DraftedPlayerRating) => {
    const group = byLane[lane]
    return group.length === 0 ? overallOvr : average(group.map((p) => Number(p[attribute])))
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
    ovr: Math.round((attack + midfield + defense + goalkeeping) / 4),
  }
}

function average(numbers: number[]) {
  if (numbers.length === 0) return 0
  return Math.round(numbers.reduce((sum, v) => sum + v, 0) / numbers.length)
}

function createSeedFromString(value: string) {
  let hash = 0
  for (const ch of value) hash = (hash * 31 + ch.charCodeAt(0)) % 2147483647
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
  for (let i = clone.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[clone[i], clone[j]] = [clone[j], clone[i]]
  }
  return clone
}

// Carga los ratings de un draft dado (jugadores + formación).
export async function loadDraftedTeamRatings(draftedTeamId: string) {
  const db = getDb()

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
    .where(eq(draftedTeamPlayers.draftedTeamId, draftedTeamId))

  if (draftedPlayers.length === 0) {
    throw new Error('El equipo draft no tiene jugadores persistidos para calcular sus ratings.')
  }

  const draftedTeam = await db.query.draftedTeams.findFirst({
    where: eq(draftedTeams.id, draftedTeamId),
  })

  if (!draftedTeam) throw new Error('No existe el equipo draft.')

  const formation = await db.query.formations.findFirst({
    where: eq(formations.id, draftedTeam.formationId),
  })

  if (!formation) throw new Error('No existe la formacion asociada al equipo draft.')

  const laneBySlot = new Map<string, Lane>(
    formation.slots.map((slot) => [slot.code, slot.lane]),
  )

  return computeDraftedTeamRatings(draftedPlayers, laneBySlot)
}

// Crea un torneo (SINGLEPLAYER o MULTIPLAYER) con N equipos humanos y
// (48−N) selecciones reales. Los humanos reemplazan a las N selecciones de
// PEOR media (ovr) — se mantienen siempre las más fuertes.
//
// Si separateHumans=true (modo multiplayer), reparte los humanos lo más
// separados posible entre los 12 grupos (round-robin). Con ≤12 humanos queda
// uno por grupo; con más, algunos grupos comparten el mínimo necesario (con 20
// humanos, máx. 2 por grupo).
export async function createTournament(params: CreateTournamentParams) {
  const { type, roomId, humans, separateHumans, seedBase } = params
  const db = getDb()

  if (humans.length > 20) {
    throw new Error('El número máximo de jugadores humanos en un torneo es 20.')
  }
  if (humans.length === 0) {
    throw new Error('Se necesita al menos un equipo humano.')
  }

  const allRealTeams = await db.query.nationalTeams.findMany()

  if (allRealTeams.length < 48) {
    throw new Error('No hay suficientes selecciones reales cargadas para armar un Mundial de 48 equipos.')
  }

  // Ordenar por ovr descendente: los mejores se quedan, los peores (N) salen.
  const sortedByOvrDesc = [...allRealTeams].sort((a, b) => b.ovr - a.ovr)
  const realTeamsInTournament = sortedByOvrDesc.slice(0, 48 - humans.length)

  const [createdTournament] = await db
    .insert(tournaments)
    .values({
      roomId: roomId ?? null,
      type,
      status: 'GROUP_STAGE',
      currentRound: 'GROUP',
      startedAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: tournaments.id })

  // Insertar entries humanas.
  const humanEntryRows = await db
    .insert(tournamentEntries)
    .values(
      humans.map((h) => ({
        tournamentId: createdTournament.id,
        entryType: 'HUMAN_DRAFTED' as const,
        displayName: h.displayName,
        draftedTeamId: h.draftedTeamId,
        computedAttack: h.ratings.attack,
        computedMidfield: h.ratings.midfield,
        computedDefense: h.ratings.defense,
        computedGoalkeeping: h.ratings.goalkeeping,
        computedOvr: h.ratings.ovr,
        metadata: { origin: 'draft' },
      })),
    )
    .returning({ id: tournamentEntries.id })

  // Insertar entries de selecciones reales.
  const shuffledReal = shuffle(realTeamsInTournament, `real:${seedBase}`)
  const realEntryRows = await db
    .insert(tournamentEntries)
    .values(
      shuffledReal.map((team) => ({
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
      })),
    )
    .returning({ id: tournamentEntries.id })

  // Asignación de grupos.
  const humanIds = humanEntryRows.map((e) => e.id)
  const realIds = realEntryRows.map((e) => e.id)

  let groupAssignments: Array<{ code: string; entryIds: string[] }>

  if (separateHumans && humans.length > 1) {
    // Repartir los humanos en round-robin sobre los 12 grupos (mezclados), de
    // modo que queden lo más separados posible: con ≤12 cae uno por grupo, con
    // más se comparte el mínimo (máx. 2 por grupo con 20). Cada grupo se completa
    // con reales hasta 4.
    const shuffledGroupCodes = shuffle([...GROUP_CODES], `groups:${seedBase}`)
    const shuffledHumanIds = shuffle([...humanIds], `humanqueue:${seedBase}`)
    const realQueue = shuffle([...realIds], `realqueue:${seedBase}`)

    const humansByGroup: string[][] = GROUP_CODES.map(() => [])
    shuffledHumanIds.forEach((id, i) => {
      humansByGroup[i % GROUP_CODES.length].push(id)
    })

    let realIdx = 0
    groupAssignments = shuffledGroupCodes.map((code, idx) => {
      const groupHumans = humansByGroup[idx]
      const realsNeeded = 4 - groupHumans.length
      const sliceIds = realQueue.slice(realIdx, realIdx + realsNeeded)
      realIdx += realsNeeded
      return {
        code,
        entryIds: [...groupHumans, ...sliceIds],
      }
    })
  } else {
    // SP o 1 humano: shuffle total → 12 grupos de 4.
    const allIds = shuffle([...humanIds, ...realIds], `groups:${seedBase}`)
    groupAssignments = GROUP_CODES.map((code, i) => ({
      code,
      entryIds: allIds.slice(i * 4, i * 4 + 4),
    }))
  }

  // Asignar groupCode en paralelo.
  await Promise.all(
    groupAssignments.map((group) =>
      db
        .update(tournamentEntries)
        .set({ groupCode: group.code })
        .where(inArray(tournamentEntries.id, group.entryIds)),
    ),
  )

  // Simular el torneo completo.
  await simulateTournament(createdTournament.id)

  return {
    tournamentId: createdTournament.id,
    groups: groupAssignments.map((g) => ({ code: g.code, size: g.entryIds.length })),
  }
}
