import type {
  BracketStage,
  GroupStanding,
  SimMatchResult,
  TeamStats,
  ThirdPlaceRanking,
  TournamentSimResult,
} from './types'
import { simulateGroupStage, rankThirdPlaced, getQualifiedTeams } from './group'
import { simulateKnockoutBracket } from './knockout'

export type GroupInput = {
  code: string
  entries: TeamStats[]
}

export function simulateFullTournament(
  groups: GroupInput[],
  seedBase: string,
): TournamentSimResult {
  const { groupResults, standings } = simulateGroupStage(groups, seedBase)

  const { ranking, qualified } = rankThirdPlaced(standings)

  // Mapa con las stats completas (lineas) de cada equipo, para que la fase
  // eliminatoria simule con los ratings reales y no solo con el OVR.
  const teamStatsById = new Map<string, TeamStats>()
  for (const group of groups) {
    for (const entry of group.entries) {
      teamStatsById.set(entry.id, entry)
    }
  }

  const entryNames = new Map<string, string>()
  const entryGroupCodes = new Map<string, string>()

  for (const group of standings) {
    for (const entry of group) {
      entryNames.set(entry.entryId, entry.name)
      entryGroupCodes.set(entry.entryId, entry.groupCode)
    }
  }
  for (const entry of ranking) {
    entryNames.set(entry.entryId, entry.name)
    entryGroupCodes.set(entry.entryId, entry.groupCode)
  }

  const { bracketStages, championId } = simulateKnockoutBracket(
    standings,
    qualified,
    entryNames,
    teamStatsById,
    seedBase,
  )

  return {
    groupStandings: standings,
    groupMatchResults: groupResults.map((g) => g.matches),
    thirdPlaceRanking: ranking,
    qualifiedThirdCount: qualified.length,
    bracket: bracketStages,
    championId,
  }
}
