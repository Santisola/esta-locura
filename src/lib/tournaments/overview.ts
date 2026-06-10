import 'server-only'

import { and, asc, eq, inArray } from 'drizzle-orm'

import { getDb, isDatabaseConfigured } from '@/lib/db/client'
import {
  draftedTeams,
  groupStandings,
  matchEvents,
  matches,
  tournamentEntries,
  tournaments,
  users,
} from '@/lib/db/schema'

export type GroupStandingInfo = {
  rank: number
  entryId: string
  name: string
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
  ovr: number
}

export type MatchInfo = {
  id: string
  round: string
  stageOrder: number
  groupCode: string | null
  homeEntryId: string
  awayEntryId: string
  homeName: string
  awayName: string
  homeScore: number
  awayScore: number
  homePenalties: number | null
  awayPenalties: number | null
  wentToPenalties: boolean
  status: string
  winnerEntryId: string | null
  events: Array<{
    minute: number
    type: string
    side: string
    playerName: string | null
  }>
}

export type BracketMatchInfo = {
  id: string
  round: string
  homeEntryId: string
  awayEntryId: string
  homeName: string
  awayName: string
  homeScore: number
  awayScore: number
  homePenalties: number | null
  awayPenalties: number | null
  wentToPenalties: boolean
  winnerId: string | null
  order: number
  events: Array<{ minute: number; type: string; side: string; playerName: string | null }>
}

export type TournamentOverview = {
  tournamentId: string
  status: string
  currentRound: string | null
  championEntryId: string | null
  championName: string | null
  humanEntryId: string | null
  groups: Array<{
    code: string
    entries: Array<{
      id: string
      name: string
      type: 'HUMAN_DRAFTED' | 'REAL_TEAM'
      ovr: number
    }>
    standings: GroupStandingInfo[]
    fixtures: MatchInfo[]
  }>
  knockoutMatches: BracketMatchInfo[]
  isSimulated: boolean
  topScorer: { name: string; goals: number } | null
}

export async function getSingleplayerTournamentOverview(sessionToken: string): Promise<TournamentOverview | null> {
  if (!isDatabaseConfigured()) {
    return null
  }

  const db = getDb()
  const user = await db.query.users.findFirst({
    where: eq(users.sessionToken, sessionToken),
  })

  if (!user) {
    return null
  }

  const draft = await db.query.draftedTeams.findFirst({
    where: and(eq(draftedTeams.userId, user.id), eq(draftedTeams.status, 'COMPLETED')),
    orderBy: (table, { desc }) => [desc(table.updatedAt)],
  })

  if (!draft) {
    return null
  }

  const entryAnchor = await db.query.tournamentEntries.findFirst({
    where: eq(tournamentEntries.draftedTeamId, draft.id),
    columns: { tournamentId: true },
  })

  if (!entryAnchor) {
    return null
  }

  const tournament = await db.query.tournaments.findFirst({
    where: eq(tournaments.id, entryAnchor.tournamentId),
  })

  if (!tournament) {
    return null
  }

  const allEntries = await db.query.tournamentEntries.findMany({
    where: eq(tournamentEntries.tournamentId, entryAnchor.tournamentId),
    orderBy: (table, { asc }) => [asc(table.groupCode), asc(table.displayName)],
  })

  const entryMap = Object.fromEntries(allEntries.map((e) => [e.id, e]))

  const allMatches = await db.query.matches.findMany({
    where: eq(matches.tournamentId, entryAnchor.tournamentId),
    orderBy: (table, { asc }) => [asc(table.stageOrder)],
  })

  const allMatchIds = allMatches.map((m) => m.id)
  let eventsByMatch = new Map<string, Array<{ minute: number; eventType: string; side: string; playerName: string | null }>>()

  if (allMatchIds.length > 0) {
    const dbEvents = await db
      .select({
        matchId: matchEvents.matchId,
        minute: matchEvents.minute,
        eventType: matchEvents.eventType,
        side: matchEvents.side,
        playerName: matchEvents.playerName,
      })
      .from(matchEvents)
      .where(inArray(matchEvents.matchId, allMatchIds))
      .orderBy(asc(matchEvents.minute))

    for (const event of dbEvents) {
      const existing = eventsByMatch.get(event.matchId) ?? []
      existing.push(event)
      eventsByMatch.set(event.matchId, existing)
    }
  }

  // Goleador del torneo: se cuenta a partir de los eventos ya cargados (goles de
  // grupo y eliminatorias), sin query adicional.
  const goalsByPlayer = new Map<string, number>()
  for (const events of eventsByMatch.values()) {
    for (const event of events) {
      if (event.eventType === 'GOAL' && event.playerName) {
        goalsByPlayer.set(event.playerName, (goalsByPlayer.get(event.playerName) ?? 0) + 1)
      }
    }
  }
  let topScorer: { name: string; goals: number } | null = null
  for (const [name, goals] of goalsByPlayer) {
    if (!topScorer || goals > topScorer.goals) topScorer = { name, goals }
  }

  const dbStandings = await db.query.groupStandings.findMany({
    where: eq(groupStandings.tournamentId, entryAnchor.tournamentId),
    orderBy: (table, { asc }) => [asc(table.groupCode), asc(table.rank)],
  })

  const groupCodes = [...new Set(allEntries.map((e) => e.groupCode).filter(Boolean))] as string[]
  groupCodes.sort()

  const groups = groupCodes.map((code) => {
    const groupEntries = allEntries.filter((e) => e.groupCode === code)
    const groupMatches = allMatches.filter((m) => m.groupCode === code)
    const groupDbStandings = dbStandings.filter((s) => s.groupCode === code)

    const computedStandings: GroupStandingInfo[] = groupEntries.map((entry) => {
      const dbStanding = groupDbStandings.find((s) => s.entryId === entry.id)
      return {
        rank: dbStanding?.rank ?? 0,
        entryId: entry.id,
        name: entry.displayName,
        played: dbStanding?.played ?? 0,
        wins: dbStanding?.wins ?? 0,
        draws: dbStanding?.draws ?? 0,
        losses: dbStanding?.losses ?? 0,
        goalsFor: dbStanding?.goalsFor ?? 0,
        goalsAgainst: dbStanding?.goalsAgainst ?? 0,
        goalDifference: dbStanding?.goalDifference ?? 0,
        points: dbStanding?.points ?? 0,
        ovr: entry.computedOvr,
      }
    })

    computedStandings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
      return b.ovr - a.ovr
    })

    computedStandings.forEach((s, i) => { s.rank = i + 1 })

    return {
      code,
      entries: groupEntries.map((e) => ({
        id: e.id,
        name: e.displayName,
        type: e.entryType as 'HUMAN_DRAFTED' | 'REAL_TEAM',
        ovr: e.computedOvr,
      })),
      standings: computedStandings,
      fixtures: groupMatches.map((m) => ({
        id: m.id,
        round: m.round,
        stageOrder: m.stageOrder,
        groupCode: m.groupCode,
        homeEntryId: m.homeEntryId,
        awayEntryId: m.awayEntryId,
        homeName: entryMap[m.homeEntryId]?.displayName ?? 'Local',
        awayName: entryMap[m.awayEntryId]?.displayName ?? 'Visitante',
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        homePenalties: m.homePenalties,
        awayPenalties: m.awayPenalties,
        wentToPenalties: m.wentToPenalties,
        status: m.status,
        winnerEntryId: m.winnerEntryId,
        events: (eventsByMatch.get(m.id) ?? []).map((ev) => ({
          minute: ev.minute,
          type: ev.eventType,
          side: ev.side,
          playerName: ev.playerName,
        })),
      })),
    }
  })

  const knockoutRounds = ['ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL'] as const
  const knockoutMatches: BracketMatchInfo[] = []

  for (const round of knockoutRounds) {
    const roundMatches = allMatches
      .filter((m) => m.round === round)
      .sort((a, b) => a.stageOrder - b.stageOrder)

    for (const m of roundMatches) {
      knockoutMatches.push({
        id: m.id,
        round: m.round,
        homeEntryId: m.homeEntryId,
        awayEntryId: m.awayEntryId,
        homeName: entryMap[m.homeEntryId]?.displayName ?? '?',
        awayName: entryMap[m.awayEntryId]?.displayName ?? '?',
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        homePenalties: m.homePenalties,
        awayPenalties: m.awayPenalties,
        wentToPenalties: m.wentToPenalties,
        winnerId: m.winnerEntryId,
        order: m.stageOrder,
        events: (eventsByMatch.get(m.id) ?? []).map((ev) => ({
          minute: ev.minute,
          type: ev.eventType,
          side: ev.side,
          playerName: ev.playerName,
        })),
      })
    }
  }

  const isSimulated = allMatches.some((m) => m.status === 'FINISHED')

  const championEntryId = tournament.championEntryId
  const championName = championEntryId ? entryMap[championEntryId]?.displayName ?? null : null
  const humanEntry = allEntries.find((e) => e.entryType === 'HUMAN_DRAFTED')

  return {
    tournamentId: tournament.id,
    status: tournament.status,
    currentRound: tournament.currentRound,
    championEntryId,
    championName,
    humanEntryId: humanEntry?.id ?? null,
    groups,
    knockoutMatches,
    isSimulated,
    topScorer,
  }
}
