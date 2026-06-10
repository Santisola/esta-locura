import 'server-only'

import { and, desc, eq, inArray, or } from 'drizzle-orm'

import { getDb, isDatabaseConfigured } from '@/lib/db/client'
import { draftedTeams, matches, tournamentEntries, tournaments, users } from '@/lib/db/schema'

const ROUND_RANK: Record<string, number> = {
  GROUP: 0,
  ROUND_OF_32: 1,
  ROUND_OF_16: 2,
  QUARTER_FINAL: 3,
  SEMI_FINAL: 4,
  FINAL: 5,
}

const ROUND_LABEL: Record<string, string> = {
  GROUP: 'Fase de grupos',
  ROUND_OF_32: 'Dieciseisavos',
  ROUND_OF_16: 'Octavos',
  QUARTER_FINAL: 'Cuartos',
  SEMI_FINAL: 'Semifinal',
  FINAL: 'Final',
}

export type HistoryItem = {
  tournamentId: string
  playedAt: string | null
  championName: string | null
  isChampion: boolean
  outcomeLabel: string
}

// Historial de torneos finalizados del usuario (singleplayer). Resuelve sus
// equipos draft -> entries humanas -> torneos FINISHED, y calcula hasta dónde
// llegó su equipo en cada uno.
export async function getUserTournamentHistory(sessionToken: string): Promise<HistoryItem[]> {
  if (!isDatabaseConfigured()) {
    return []
  }

  const db = getDb()
  const user = await db.query.users.findFirst({ where: eq(users.sessionToken, sessionToken) })
  if (!user) return []

  const userTeams = await db
    .select({ id: draftedTeams.id })
    .from(draftedTeams)
    .where(eq(draftedTeams.userId, user.id))
  const userTeamIds = userTeams.map((t) => t.id)
  if (userTeamIds.length === 0) return []

  const humanEntries = await db
    .select({ id: tournamentEntries.id, tournamentId: tournamentEntries.tournamentId })
    .from(tournamentEntries)
    .where(
      and(
        eq(tournamentEntries.entryType, 'HUMAN_DRAFTED'),
        inArray(tournamentEntries.draftedTeamId, userTeamIds),
      ),
    )
  if (humanEntries.length === 0) return []

  const humanEntryIds = humanEntries.map((e) => e.id)
  const tournamentToHuman = new Map(humanEntries.map((e) => [e.tournamentId, e.id]))
  const tournamentIds = [...tournamentToHuman.keys()]

  const finishedTournaments = await db
    .select({
      id: tournaments.id,
      championEntryId: tournaments.championEntryId,
      endedAt: tournaments.endedAt,
      createdAt: tournaments.createdAt,
    })
    .from(tournaments)
    .where(and(inArray(tournaments.id, tournamentIds), eq(tournaments.status, 'FINISHED')))
    .orderBy(desc(tournaments.createdAt))
  if (finishedTournaments.length === 0) return []

  const finishedIds = finishedTournaments.map((t) => t.id)

  // Nombre del campeón de cada torneo.
  const championIds = finishedTournaments
    .map((t) => t.championEntryId)
    .filter((id): id is string => Boolean(id))
  const championEntries = championIds.length
    ? await db
        .select({ id: tournamentEntries.id, displayName: tournamentEntries.displayName })
        .from(tournamentEntries)
        .where(inArray(tournamentEntries.id, championIds))
    : []
  const championName = new Map(championEntries.map((e) => [e.id, e.displayName]))

  // Partidos del equipo humano en esos torneos, para calcular hasta dónde llegó.
  const humanMatches = await db
    .select({
      tournamentId: matches.tournamentId,
      round: matches.round,
      homeEntryId: matches.homeEntryId,
      awayEntryId: matches.awayEntryId,
      winnerEntryId: matches.winnerEntryId,
    })
    .from(matches)
    .where(
      and(
        inArray(matches.tournamentId, finishedIds),
        or(
          inArray(matches.homeEntryId, humanEntryIds),
          inArray(matches.awayEntryId, humanEntryIds),
        ),
      ),
    )

  const matchesByTournament = new Map<string, typeof humanMatches>()
  for (const match of humanMatches) {
    const list = matchesByTournament.get(match.tournamentId) ?? []
    list.push(match)
    matchesByTournament.set(match.tournamentId, list)
  }

  return finishedTournaments.map((tournament) => {
    const humanId = tournamentToHuman.get(tournament.id) ?? null
    const isChampion = Boolean(humanId && tournament.championEntryId === humanId)

    let outcomeLabel = 'Fase de grupos'
    if (isChampion) {
      outcomeLabel = 'Campeón del mundo'
    } else {
      const koMatches = (matchesByTournament.get(tournament.id) ?? []).filter(
        (m) => m.round !== 'GROUP',
      )
      if (koMatches.length > 0) {
        const furthest = koMatches.reduce((best, m) =>
          (ROUND_RANK[m.round] ?? 0) > (ROUND_RANK[best.round] ?? 0) ? m : best,
        )
        outcomeLabel = `Eliminado en ${ROUND_LABEL[furthest.round] ?? furthest.round}`
      }
    }

    return {
      tournamentId: tournament.id,
      playedAt: (tournament.endedAt ?? tournament.createdAt)?.toISOString?.() ?? null,
      championName: tournament.championEntryId
        ? championName.get(tournament.championEntryId) ?? null
        : null,
      isChampion,
      outcomeLabel,
    }
  })
}
