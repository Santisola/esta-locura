// Nombres reales del plantel de un equipo, segmentados para elegir protagonistas
// coherentes de cada evento (goles desde ataque/medio, tarjetas desde defensa/medio).
export type TeamRoster = {
  goalScorers: string[]
  defenders: string[]
}

export type TeamStats = {
  id: string
  name: string
  attack: number
  midfield: number
  defense: number
  goalkeeping: number
  ovr: number
  roster?: TeamRoster
}

export type SimMatchEvent = {
  minute: number
  type: 'GOAL' | 'YELLOW_CARD' | 'RED_CARD' | 'INJURY' | 'PENALTY_GOAL' | 'PENALTY_MISS'
  side: 'HOME' | 'AWAY'
  playerName?: string
}

export type SimMatchResult = {
  homeId: string
  awayId: string
  homeScore: number
  awayScore: number
  homePenalties?: number
  awayPenalties?: number
  wentToPenalties: boolean
  winnerId: string | null
  events: SimMatchEvent[]
}

export type GroupStanding = {
  entryId: string
  name: string
  groupCode: string
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
  rank: number
  ovr: number
}

export type ThirdPlaceRanking = GroupStanding & {
  groupCode: string
}

export type BracketSlot = {
  type: 'group_winner' | 'group_runner_up' | 'third_ranked' | 'match_winner'
  group?: string
  rank?: number
  matchId?: string
}

export type BracketMatch = {
  id: string
  round: 'ROUND_OF_32' | 'ROUND_OF_16' | 'QUARTER_FINAL' | 'SEMI_FINAL' | 'FINAL'
  home: BracketSlot
  away: BracketSlot
  homeEntryId?: string
  awayEntryId?: string
  result?: SimMatchResult
  order: number
  nextMatchId: string
}

export type BracketStage = {
  round: string
  matches: BracketMatch[]
}

export type TournamentSimResult = {
  groupStandings: GroupStanding[][]
  groupMatchResults: SimMatchResult[][] 
  thirdPlaceRanking: ThirdPlaceRanking[]
  qualifiedThirdCount: number
  bracket: BracketStage[]
  championId: string | null
}
