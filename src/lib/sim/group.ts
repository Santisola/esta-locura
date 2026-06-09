import type { GroupStanding, SimMatchResult, TeamStats, ThirdPlaceRanking } from './types'
import { computeStandingFromMatches, simulateMatch } from './match'

type GroupInput = {
  code: string
  entries: TeamStats[]
}

type GroupFixtures = {
  code: string
  matches: SimMatchResult[]
}

function createGroupPairings(entryIds: string[]): Array<{ home: string; away: string }> {
  const pairings: Array<{ home: string; away: string }> = []

  for (let i = 0; i < entryIds.length; i++) {
    for (let j = i + 1; j < entryIds.length; j++) {
      const useHomeAway = (i + j) % 2 === 0
      pairings.push({
        home: useHomeAway ? entryIds[i] : entryIds[j],
        away: useHomeAway ? entryIds[j] : entryIds[i],
      })
    }
  }

  return pairings
}

export function simulateGroupStage(
  groups: GroupInput[],
  seedBase: string,
): { groupResults: GroupFixtures[]; standings: GroupStanding[][] } {
  const groupResults: GroupFixtures[] = []
  const allStandings: GroupStanding[][] = []

  for (const group of groups) {
    const entryMap = new Map(group.entries.map((e) => [e.id, e]))
    const entryIds = group.entries.map((e) => e.id)
    const pairings = createGroupPairings(entryIds)

    const matchResults: SimMatchResult[] = []

    for (const pairing of pairings) {
      const home = entryMap.get(pairing.home)
      const away = entryMap.get(pairing.away)
      if (!home || !away) continue

      const seed = Math.abs(
        `${seedBase}:${group.code}:${home.id}:${away.id}`.split('').reduce(
          (h, c) => (h * 31 + c.charCodeAt(0)) | 0,
          0,
        ),
      )

      const result = simulateMatch(home, away, seed, false)
      matchResults.push(result)
    }

    const entryNames = new Map(group.entries.map((e) => [e.id, e.name]))
    const entryOvrs = new Map(group.entries.map((e) => [e.id, e.ovr]))

    const groupStandings: GroupStanding[] = group.entries
      .map((entry) => {
        const stats = computeStandingFromMatches(
          entry.id,
          entry.name,
          group.code,
          entry.ovr,
          matchResults,
        )
        return { ...stats, entryId: entry.id, name: entry.name, groupCode: group.code, rank: 0, ovr: entry.ovr }
      })
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference
        if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
        return b.ovr - a.ovr
      })
      .map((standing, index) => ({ ...standing, rank: index + 1 }))

    groupResults.push({ code: group.code, matches: matchResults })
    allStandings.push(groupStandings)
  }

  return { groupResults, standings: allStandings }
}

export function rankThirdPlaced(standings: GroupStanding[][]): {
  ranking: ThirdPlaceRanking[]
  qualified: ThirdPlaceRanking[]
} {
  const allThird: ThirdPlaceRanking[] = standings
    .map((group) => group[2])
    .filter((entry): entry is ThirdPlaceRanking => entry !== undefined)

  const sorted = allThird.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
    return b.ovr - a.ovr
  })

  return {
    ranking: sorted,
    qualified: sorted.slice(0, 8),
  }
}

export function getQualifiedTeams(
  standings: GroupStanding[][],
  qualifiedThird: ThirdPlaceRanking[],
): GroupStanding[] {
  const qualified: GroupStanding[] = []

  for (const group of standings) {
    qualified.push(group[0])
    qualified.push(group[1])
  }

  qualified.push(...qualifiedThird)

  return qualified
}
