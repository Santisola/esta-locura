export type DraftDifficultyMode = 'CLASSIC' | 'MEMORY'

export type DraftSessionState = {
  formationCode: string
  difficulty: DraftDifficultyMode
  rerollsLeft: number
  currentCountrySlug: string | null
  usedCountrySlugs: string[]
  picks: Record<string, string>
  usedPlayerIds: string[]
  startedAt: string
  completedAt: string | null
}

export type DraftFormationSlot = {
  code: string
  lane: 'GK' | 'DEF' | 'MID' | 'ATT'
  order: number
}

export type DraftFormation = {
  code: string
  name: string
  slots: DraftFormationSlot[]
}

export type DraftPlayer = {
  id: string
  country: string
  countrySlug: string
  name: string
  slug: string
  listedPositionGroup: string
  primaryPosition: string
  secondaryPositions: string[]
  birthDate: string | null
  club: string | null
  shirtNumber?: number | null
  attack: number
  midfield: number
  defense: number
  goalkeeping: number
  ovr: number
  isCaptain?: boolean
  isDataReady: boolean
  lockReason: string | null
  enrichmentStatus: 'matched' | 'unmatched'
}

export type DraftCountryGroup = {
  country: string
  countrySlug: string
  totalPlayers: number
  readyPlayers: number
  blockedPlayers: number
  players: DraftPlayer[]
}

export type DraftBootstrap = {
  summary: {
    totalPlayers: number
    readyPlayers: number
    blockedPlayers: number
    totalCountries: number
  }
  formations: DraftFormation[]
  countries: DraftCountryGroup[]
}

export type DraftPersistenceMode = 'remote' | 'local-fallback'
