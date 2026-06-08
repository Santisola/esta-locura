import 'server-only'

import { eq } from 'drizzle-orm'

import type { DraftCountryGroup, DraftPlayer } from '@/features/draft/types'
import { getDb, isDatabaseConfigured } from '@/lib/db/client'
import { nationalTeams, players } from '@/lib/db/schema'

export async function listReadyDraftCountries(): Promise<DraftCountryGroup[]> {
  if (!isDatabaseConfigured()) {
    return []
  }

  const db = getDb()
  const rows = await db
    .select({
      teamId: nationalTeams.id,
      teamSlug: nationalTeams.slug,
      teamName: nationalTeams.name,
      playerId: players.id,
      playerSlug: players.slug,
      playerName: players.name,
      primaryPosition: players.primaryPosition,
      secondaryPositions: players.secondaryPositions,
      shirtNumber: players.shirtNumber,
      attack: players.attack,
      midfield: players.midfield,
      defense: players.defense,
      goalkeeping: players.goalkeeping,
      ovr: players.ovr,
      isCaptain: players.isCaptain,
    })
    .from(players)
    .innerJoin(nationalTeams, eq(players.nationalTeamId, nationalTeams.id))

  const map = new Map<string, DraftCountryGroup>()

  for (const row of rows) {
    const existing = map.get(row.teamSlug) ?? {
      country: row.teamName,
      countrySlug: row.teamSlug,
      totalPlayers: 0,
      readyPlayers: 0,
      blockedPlayers: 0,
      players: [],
    }

    const player: DraftPlayer = {
      id: row.playerId,
      country: row.teamName,
      countrySlug: row.teamSlug,
      name: row.playerName,
      slug: row.playerSlug,
      listedPositionGroup: row.primaryPosition,
      primaryPosition: row.primaryPosition,
      secondaryPositions: row.secondaryPositions,
      birthDate: null,
      club: null,
      attack: row.attack,
      midfield: row.midfield,
      defense: row.defense,
      goalkeeping: row.goalkeeping,
      ovr: row.ovr,
      isDataReady: true,
      lockReason: null,
      enrichmentStatus: 'matched',
      shirtNumber: row.shirtNumber ?? null,
      isCaptain: row.isCaptain,
    }

    existing.players.push(player)
    existing.totalPlayers += 1
    existing.readyPlayers += 1

    map.set(row.teamSlug, existing)
  }

  return [...map.values()].sort((left, right) => left.country.localeCompare(right.country))
}
