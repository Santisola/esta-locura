import 'server-only'

import { and, eq, or } from 'drizzle-orm'

import { getDb, isDatabaseConfigured } from '@/lib/db/client'
import { matchEvents, matches, tournamentEntries, tournaments } from '@/lib/db/schema'

const ROUND_RANK: Record<string, number> = {
  ROUND_OF_32: 1,
  ROUND_OF_16: 2,
  QUARTER_FINAL: 3,
  SEMI_FINAL: 4,
  FINAL: 5,
}

const ROUND_LABEL: Record<string, string> = {
  ROUND_OF_32: 'Dieciseisavos',
  ROUND_OF_16: 'Octavos',
  QUARTER_FINAL: 'Cuartos',
  SEMI_FINAL: 'Semifinal',
  FINAL: 'Final',
}

export type TournamentCardData = {
  humanName: string
  championName: string | null
  isChampion: boolean
  outcomeLabel: string
  topScorer: { name: string; goals: number } | null
  goalsFor: number
  goalsAgainst: number
}

// Datos del card final de un torneo, por id (público: el id es un UUID inadivinable).
// Usado por la imagen OG compartible y reusable en el cliente.
export async function getTournamentCardData(tournamentId: string): Promise<TournamentCardData | null> {
  if (!isDatabaseConfigured()) return null

  const db = getDb()
  const tournament = await db.query.tournaments.findFirst({
    where: and(eq(tournaments.id, tournamentId), eq(tournaments.status, 'FINISHED')),
  })
  if (!tournament) return null

  const entries = await db.query.tournamentEntries.findMany({
    where: eq(tournamentEntries.tournamentId, tournamentId),
  })
  const human = entries.find((e) => e.entryType === 'HUMAN_DRAFTED')
  if (!human) return null

  const championName = tournament.championEntryId
    ? entries.find((e) => e.id === tournament.championEntryId)?.displayName ?? null
    : null
  const isChampion = tournament.championEntryId === human.id

  const humanMatches = await db
    .select({
      round: matches.round,
      homeEntryId: matches.homeEntryId,
      awayEntryId: matches.awayEntryId,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
    })
    .from(matches)
    .where(
      and(
        eq(matches.tournamentId, tournamentId),
        or(eq(matches.homeEntryId, human.id), eq(matches.awayEntryId, human.id)),
      ),
    )

  let goalsFor = 0
  let goalsAgainst = 0
  for (const match of humanMatches) {
    const home = match.homeEntryId === human.id
    goalsFor += home ? match.homeScore : match.awayScore
    goalsAgainst += home ? match.awayScore : match.homeScore
  }

  let outcomeLabel = 'Fase de grupos'
  if (isChampion) {
    outcomeLabel = 'Campeón del mundo'
  } else {
    const ko = humanMatches.filter((m) => m.round !== 'GROUP')
    if (ko.length > 0) {
      const furthest = ko.reduce((best, m) =>
        (ROUND_RANK[m.round] ?? 0) > (ROUND_RANK[best.round] ?? 0) ? m : best,
      )
      outcomeLabel = `Eliminado en ${ROUND_LABEL[furthest.round] ?? furthest.round}`
    }
  }

  // Goleador del torneo (solo goles de juego).
  const goalRows = await db
    .select({ playerName: matchEvents.playerName })
    .from(matchEvents)
    .innerJoin(matches, eq(matchEvents.matchId, matches.id))
    .where(and(eq(matches.tournamentId, tournamentId), eq(matchEvents.eventType, 'GOAL')))

  const goalsByPlayer = new Map<string, number>()
  for (const row of goalRows) {
    if (row.playerName) goalsByPlayer.set(row.playerName, (goalsByPlayer.get(row.playerName) ?? 0) + 1)
  }
  let topScorer: { name: string; goals: number } | null = null
  for (const [name, goals] of goalsByPlayer) {
    if (!topScorer || goals > topScorer.goals) topScorer = { name, goals }
  }

  return {
    humanName: human.displayName,
    championName,
    isChampion,
    outcomeLabel,
    topScorer,
    goalsFor,
    goalsAgainst,
  }
}
