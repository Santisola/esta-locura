import 'server-only'

import { randomUUID } from 'node:crypto'

import { eq } from 'drizzle-orm'

import { getDb } from '@/lib/db/client'
import {
  draftedTeamPlayers,
  groupStandings,
  matchEvents,
  matches,
  players,
  tournamentEntries,
  tournaments,
} from '@/lib/db/schema'
import { buildTeamRoster } from '@/lib/sim/roster'
import { simulateFullTournament } from '@/lib/sim/tournament'
import type { SimMatchResult, TeamRoster, TeamStats } from '@/lib/sim/types'

function seedForMatch(parts: string): number {
  return Math.abs(parts.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0))
}

// Simula por completo un torneo ya creado (entries y grupos en DB) y persiste
// posiciones, resultados, eventos y bracket. Deja el torneo en FINISHED.
// Soporta N entradas HUMAN_DRAFTED (singleplayer con N=1, multiplayer con N>1).
// Reutilizable desde createTournament y desde /api/tournaments/simulate.
//
// Es idempotente: borra standings y partidos previos antes de reconstruirlos.
// Toda la persistencia ocurre en un único db.batch() atómico.
export async function simulateTournament(tournamentId: string) {
  const db = getDb()

  const allEntries = await db.query.tournamentEntries.findMany({
    where: eq(tournamentEntries.tournamentId, tournamentId),
  })

  // Planteles reales: cada seleccion juega con SUS jugadores. Solo el equipo
  // humano usa el draft.
  const realPlayers = await db
    .select({
      name: players.name,
      primaryPosition: players.primaryPosition,
      nationalTeamId: players.nationalTeamId,
    })
    .from(players)

  const playersByNationalTeam = new Map<string, Array<{ name: string; primaryPosition: string }>>()
  for (const player of realPlayers) {
    const list = playersByNationalTeam.get(player.nationalTeamId) ?? []
    list.push({ name: player.name, primaryPosition: player.primaryPosition })
    playersByNationalTeam.set(player.nationalTeamId, list)
  }

  const rosterByNationalTeam = new Map<string, TeamRoster>()
  for (const [teamId, roster] of playersByNationalTeam) {
    rosterByNationalTeam.set(teamId, buildTeamRoster(roster))
  }

  // Roster de CADA entry humana (N>=1). Se carga en paralelo.
  const humanEntries = allEntries.filter((entry) => entry.entryType === 'HUMAN_DRAFTED')
  const humanRosterByEntryId = new Map<string, TeamRoster>()

  await Promise.all(
    humanEntries
      .filter((entry) => entry.draftedTeamId != null)
      .map(async (entry) => {
        const humanPlayers = await db
          .select({ name: players.name, primaryPosition: players.primaryPosition })
          .from(draftedTeamPlayers)
          .innerJoin(players, eq(draftedTeamPlayers.playerId, players.id))
          .where(eq(draftedTeamPlayers.draftedTeamId, entry.draftedTeamId!))
        humanRosterByEntryId.set(entry.id, buildTeamRoster(humanPlayers))
      }),
  )

  const rosterForEntry = (entry: (typeof allEntries)[number]): TeamRoster | undefined => {
    if (entry.entryType === 'HUMAN_DRAFTED') return humanRosterByEntryId.get(entry.id)
    if (entry.nationalTeamId) return rosterByNationalTeam.get(entry.nationalTeamId)
    return undefined
  }

  const groupCodes = [...new Set(allEntries.map((e) => e.groupCode).filter(Boolean))] as string[]
  groupCodes.sort()

  const groups: Array<{ code: string; entries: TeamStats[] }> = groupCodes.map((code) => ({
    code,
    entries: allEntries
      .filter((e) => e.groupCode === code)
      .map((entry) => ({
        id: entry.id,
        name: entry.displayName,
        attack: entry.computedAttack,
        midfield: entry.computedMidfield,
        defense: entry.computedDefense,
        goalkeeping: entry.computedGoalkeeping,
        ovr: entry.computedOvr,
        roster: rosterForEntry(entry),
      })),
  }))

  const result = simulateFullTournament(groups, tournamentId)

  // ---- Filas de partidos y eventos (grupo + bracket), todo INSERT ----
  const matchRows: (typeof matches.$inferInsert)[] = []
  const eventRows: (typeof matchEvents.$inferInsert)[] = []

  const pushMatch = (
    round: typeof matches.$inferInsert.round,
    stageOrder: number,
    groupCode: string | null,
    r: SimMatchResult,
  ) => {
    const matchId = randomUUID()
    matchRows.push({
      id: matchId,
      tournamentId,
      round,
      stageOrder,
      groupCode,
      homeEntryId: r.homeId,
      awayEntryId: r.awayId,
      homeScore: r.homeScore,
      awayScore: r.awayScore,
      homePenalties: r.homePenalties ?? null,
      awayPenalties: r.awayPenalties ?? null,
      wentToPenalties: r.wentToPenalties,
      winnerEntryId: r.winnerId,
      status: 'FINISHED',
      simulationSeed: seedForMatch(`${tournamentId}:${round}:${r.homeId}:${r.awayId}`),
      startedAt: new Date(),
      endedAt: new Date(),
    })
    for (const ev of r.events) {
      eventRows.push({
        matchId,
        minute: ev.minute,
        side: ev.side as 'HOME' | 'AWAY' | 'NEUTRAL',
        eventType: ev.type as typeof matchEvents.$inferInsert.eventType,
        playerName: ev.playerName ?? null,
        payload: {},
      })
    }
  }

  // Partidos de grupo: el orden de result.groupMatchResults coincide con `groups`.
  result.groupMatchResults.forEach((groupMatchList, groupIndex) => {
    const groupCode = groups[groupIndex]?.code ?? null
    groupMatchList.forEach((r, matchIndex) => pushMatch('GROUP', matchIndex + 1, groupCode, r))
  })

  // Bracket eliminatorio.
  for (const stage of result.bracket) {
    for (const bracketMatch of stage.matches) {
      if (!bracketMatch.result) continue
      pushMatch(
        stage.round as typeof matches.$inferInsert.round,
        bracketMatch.order + 1,
        null,
        bracketMatch.result,
      )
    }
  }

  // ---- Persistencia idempotente: borrar lo previo y re-insertar en bloque ----
  const standingRows = result.groupStandings.flat().map((standing) => ({
    tournamentId,
    entryId: standing.entryId,
    groupCode: standing.groupCode,
    played: standing.played,
    wins: standing.wins,
    draws: standing.draws,
    losses: standing.losses,
    goalsFor: standing.goalsFor,
    goalsAgainst: standing.goalsAgainst,
    goalDifference: standing.goalDifference,
    points: standing.points,
    rank: standing.rank,
  }))

  // C4: toda la persistencia del resultado en un solo batch ATÓMICO. En el driver
  // neon-http, `db.batch()` corre como una transacción (todo o nada): si algo
  // falla, no queda un torneo a medio escribir. El orden importa (borrar antes de
  // insertar; insertar partidos antes que sus eventos por la FK).
  type BatchOp = Parameters<typeof db.batch>[0][number]
  const ops: BatchOp[] = [
    db.delete(matches).where(eq(matches.tournamentId, tournamentId)), // cascadea match_events
    db.delete(groupStandings).where(eq(groupStandings.tournamentId, tournamentId)),
  ]

  if (standingRows.length > 0) ops.push(db.insert(groupStandings).values(standingRows))
  if (matchRows.length > 0) ops.push(db.insert(matches).values(matchRows))
  if (eventRows.length > 0) ops.push(db.insert(matchEvents).values(eventRows))

  ops.push(
    db
      .update(tournaments)
      .set({
        status: 'FINISHED',
        currentRound: 'FINAL',
        championEntryId: result.championId,
        endedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tournaments.id, tournamentId)),
  )

  await db.batch(ops as [BatchOp, ...BatchOp[]])

  return {
    championId: result.championId,
    humanEntryIds: humanEntries.map((e) => e.id),
  }
}

// Alias de compatibilidad para call-sites del singleplayer.
export const simulateSingleplayerTournament = simulateTournament
