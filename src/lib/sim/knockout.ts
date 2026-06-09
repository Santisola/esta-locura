import type { BracketMatch, BracketStage, GroupStanding, SimMatchResult, TeamStats, ThirdPlaceRanking, TournamentSimResult } from './types'
import { simulateMatch, computeStandingFromMatches } from './match'
import { getBracketDefs, resolveSlotToTeam } from './bracket'
import { simulateGroupStage, rankThirdPlaced, getQualifiedTeams } from './group'

export function simulateKnockoutBracket(
  standings: GroupStanding[][],
  qualifiedThird: ThirdPlaceRanking[],
  entryNames: Map<string, string>,
  seedBase: string,
): {
  bracketStages: BracketStage[]
  allResults: Map<string, SimMatchResult>
  championId: string | null
} {
  const standingsByGroup = new Map<string, { winner: GroupStanding; runnerUp: GroupStanding }>()
  for (const group of standings) {
    const groupCode = group[0]?.groupCode
    if (groupCode) {
      standingsByGroup.set(groupCode, { winner: group[0], runnerUp: group[1] })
    }
  }

  const allTeams = new Map<string, TeamStats>()
  for (const group of standings) {
    for (const entry of group) {
      allTeams.set(entry.entryId, {
        id: entry.entryId,
        name: entry.name,
        attack: 0,
        midfield: 0,
        defense: 0,
        goalkeeping: 0,
        ovr: entry.ovr,
      })
    }
  }
  for (const entry of qualifiedThird) {
    if (!allTeams.has(entry.entryId)) {
      allTeams.set(entry.entryId, {
        id: entry.entryId,
        name: entry.name,
        attack: 0,
        midfield: 0,
        defense: 0,
        goalkeeping: 0,
        ovr: entry.ovr,
      })
    }
  }

  const allDefs = getBracketDefs()
  const r32Defs = allDefs.filter((d) => d.round === 'ROUND_OF_32')
  const laterDefs = allDefs.filter((d) => d.round !== 'ROUND_OF_32')

  const stageMap = new Map<string, BracketMatch[]>()
  const roundOrder = ['ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL']

  for (const round of roundOrder) {
    stageMap.set(round, [])
  }

  const matchResults = new Map<string, SimMatchResult>()
  const matchMap = new Map<string, BracketMatch>()

  for (const def of r32Defs) {
    const homeTeam = resolveSlotToTeam(def.home, standingsByGroup, qualifiedThird)
    const awayTeam = resolveSlotToTeam(def.away, standingsByGroup, qualifiedThird)

    if (!homeTeam || !awayTeam) continue

    const homeStats = allTeams.get(homeTeam.entryId)
    const awayStats = allTeams.get(awayTeam.entryId)
    if (!homeStats || !awayStats) continue

    const seed = Math.abs(
      `${seedBase}:${def.matchId}:${homeTeam.entryId}:${awayTeam.entryId}`.split('').reduce(
        (h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0,
      ),
    )

    const result = simulateMatch(homeStats, awayStats, seed, true)
    matchResults.set(def.matchId, result)

    const bm: BracketMatch = {
      id: def.matchId,
      round: 'ROUND_OF_32',
      home: def.home,
      away: def.away,
      homeEntryId: homeTeam.entryId,
      awayEntryId: awayTeam.entryId,
      result,
      order: def.order,
      nextMatchId: def.nextMatchId,
    }
    matchMap.set(def.matchId, bm)
    stageMap.get('ROUND_OF_32')?.push(bm)
  }

  for (const def of laterDefs) {
    const prevHomeResult = def.home.matchId ? matchResults.get(def.home.matchId) : undefined
    const prevAwayResult = def.away.matchId ? matchResults.get(def.away.matchId) : undefined

    const homeWinnerId = prevHomeResult?.winnerId
    const awayWinnerId = prevAwayResult?.winnerId

    if (!homeWinnerId || !awayWinnerId) continue

    const homeStats = allTeams.get(homeWinnerId)
    const awayStats = allTeams.get(awayWinnerId)

    if (!homeStats || !awayStats) continue

    const seed = Math.abs(
      `${seedBase}:${def.matchId}:${homeWinnerId}:${awayWinnerId}`.split('').reduce(
        (h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0,
      ),
    )

    const isFinal = def.round === 'FINAL'
    const result = simulateMatch(homeStats, awayStats, seed, true)
    matchResults.set(def.matchId, result)

    const bm: BracketMatch = {
      id: def.matchId,
      round: def.round as BracketMatch['round'],
      home: def.home,
      away: def.away,
      homeEntryId: homeWinnerId,
      awayEntryId: awayWinnerId,
      result,
      order: def.order,
      nextMatchId: def.nextMatchId,
    }
    matchMap.set(def.matchId, bm)
    stageMap.get(def.round)?.push(bm)
  }

  const finalResult = matchResults.get('final')
  const championId = finalResult?.winnerId ?? null

  const bracketStages: BracketStage[] = roundOrder
    .filter((round) => (stageMap.get(round)?.length ?? 0) > 0)
    .map((round) => ({
      round,
      matches: stageMap.get(round) ?? [],
    })) as BracketStage[]

  return { bracketStages, allResults: matchResults, championId }
}
