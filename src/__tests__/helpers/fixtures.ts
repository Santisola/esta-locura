import type { TeamStats } from '@/lib/sim/types'
import type { GroupInput } from '@/lib/sim/tournament'
import type { DraftSessionState } from '@/features/draft/types'

export function makeTeamStats(id: string, overrides: Partial<TeamStats> = {}): TeamStats {
  return {
    id,
    name: `Team ${id}`,
    attack: 75,
    midfield: 75,
    defense: 75,
    goalkeeping: 75,
    ovr: 75,
    ...overrides,
  }
}

// Crea N grupos de M equipos con stats deterministas.
export function makeGroups(groupCount = 12, teamsPerGroup = 4): GroupInput[] {
  return Array.from({ length: groupCount }, (_, gi) => ({
    code: String.fromCharCode(65 + gi), // A, B, C, …
    entries: Array.from({ length: teamsPerGroup }, (_, ti) => {
      const base = 70 + gi + ti
      return makeTeamStats(`t${gi}_${ti}`, {
        name: `${String.fromCharCode(65 + gi)}${ti + 1}`,
        attack: base,
        midfield: base,
        defense: base,
        goalkeeping: base,
        ovr: base,
      })
    }),
  }))
}

export function makeDraftSessionState(overrides: Partial<DraftSessionState> = {}): DraftSessionState {
  return {
    formationCode: '4-3-3',
    difficulty: 'CLASSIC',
    rerollsLeft: 3,
    currentCountrySlug: null,
    usedCountrySlugs: [],
    picks: {},
    usedPlayerIds: [],
    startedAt: new Date().toISOString(),
    completedAt: null,
    ...overrides,
  }
}
