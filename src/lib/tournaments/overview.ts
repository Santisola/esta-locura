import 'server-only'

import { and, eq } from 'drizzle-orm'

import { getDb, isDatabaseConfigured } from '@/lib/db/client'
import { draftedTeams, matches, tournamentEntries, tournaments, users } from '@/lib/db/schema'

export type TournamentOverview = {
  tournamentId: string
  status: string
  currentRound: string | null
  groups: Array<{
    code: string
    entries: Array<{
      id: string
      name: string
      type: 'HUMAN_DRAFTED' | 'REAL_TEAM'
      ovr: number
    }>
  }>
  fixturesByGroup: Array<{
    code: string
    fixtures: Array<{
      id: string
      homeName: string
      awayName: string
      stageOrder: number
      status: string
    }>
  }>
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

  const entries = await db
    .select({
      tournamentId: tournamentEntries.tournamentId,
      entryId: tournamentEntries.id,
      displayName: tournamentEntries.displayName,
      entryType: tournamentEntries.entryType,
      groupCode: tournamentEntries.groupCode,
      computedOvr: tournamentEntries.computedOvr,
      tournamentStatus: tournaments.status,
      currentRound: tournaments.currentRound,
    })
    .from(tournamentEntries)
    .innerJoin(tournaments, eq(tournamentEntries.tournamentId, tournaments.id))
    .where(eq(tournamentEntries.draftedTeamId, draft.id))

  const entryAnchor = entries[0]

  if (!entryAnchor) {
    return null
  }

  const allEntries = await db.query.tournamentEntries.findMany({
    where: eq(tournamentEntries.tournamentId, entryAnchor.tournamentId),
    orderBy: (table, { asc }) => [asc(table.groupCode), asc(table.displayName)],
  })

  const allMatches = await db.query.matches.findMany({
    where: eq(matches.tournamentId, entryAnchor.tournamentId),
    orderBy: (table, { asc }) => [asc(table.groupCode), asc(table.stageOrder)],
  })

  const entryMap = Object.fromEntries(allEntries.map((entry) => [entry.id, entry]))
  const groupMap = new Map<string, TournamentOverview['groups'][number]>()

  for (const entry of allEntries) {
    const groupCode = entry.groupCode ?? 'SIN GRUPO'
    const existing = groupMap.get(groupCode) ?? { code: groupCode, entries: [] }

    existing.entries.push({
      id: entry.id,
      name: entry.displayName,
      type: entry.entryType,
      ovr: entry.computedOvr,
    })

    groupMap.set(groupCode, existing)
  }

  const fixtureMap = new Map<string, TournamentOverview['fixturesByGroup'][number]>()

  for (const match of allMatches.filter((fixture) => fixture.round === 'GROUP')) {
    const groupCode = match.groupCode ?? 'SIN GRUPO'
    const existing = fixtureMap.get(groupCode) ?? { code: groupCode, fixtures: [] }

    existing.fixtures.push({
      id: match.id,
      homeName: entryMap[match.homeEntryId]?.displayName ?? 'Local',
      awayName: entryMap[match.awayEntryId]?.displayName ?? 'Visitante',
      stageOrder: match.stageOrder,
      status: match.status,
    })

    fixtureMap.set(groupCode, existing)
  }

  return {
    tournamentId: entryAnchor.tournamentId,
    status: entryAnchor.tournamentStatus,
    currentRound: entryAnchor.currentRound,
    groups: [...groupMap.values()],
    fixturesByGroup: [...fixtureMap.values()],
  }
}
