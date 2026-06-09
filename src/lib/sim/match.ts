import type { SimMatchEvent, SimMatchResult, TeamStats } from './types'
import { createRng, simulatePoisson } from './rng'

const PLAYER_NAMES_BY_POSITION: Record<string, string[]> = {
  GK: ['Martínez', 'Dibu', 'Alisson', 'Neuer', 'Courtois', 'Ter Stegen', 'Oblak', 'Donnarumma', 'Ederson', 'Lloris'],
  DEF: ['Fossati', 'Romero', 'Días', 'Van Dijk', 'Rüdiger', 'Stones', 'Marquinhos', 'Koulibaly', 'Hummels', 'Pavard'],
  MID: ['Fernández', 'De Paul', 'Mac Allister', 'Lo Celso', 'B费', 'Modric', 'Kroos', 'Bellingham', 'Pedri', 'Valverde'],
  ATT: ['Messi', 'C.Ronaldo', 'Mbappé', 'Haaland', 'Neymar', 'Kane', 'Lewandowski', 'Vinicius', 'Salah', 'Griezmann'],
}

const EVENT_MINUTES_BIAS = [8, 22, 31, 39, 44, 51, 58, 67, 73, 78, 82, 87, 90]

function pickPlayerName(rng: () => number, isGoal: boolean): string {
  const pool = isGoal ? PLAYER_NAMES_BY_POSITION.ATT : PLAYER_NAMES_BY_POSITION.DEF
  return pool[Math.floor(rng() * pool.length)]
}

function generateGoalEvents(
  homeScore: number,
  awayScore: number,
  rng: () => number,
): SimMatchEvent[] {
  const events: SimMatchEvent[] = []
  const minutes = [...EVENT_MINUTES_BIAS].sort(() => rng() - 0.5)

  let homeGoalsLeft = homeScore
  let awayGoalsLeft = awayScore

  for (const minute of minutes) {
    if (homeGoalsLeft === 0 && awayGoalsLeft === 0) break

    const total = homeGoalsLeft + awayGoalsLeft
    const homeProb = homeGoalsLeft / total
    const decider = rng()

    if (decider < homeProb && homeGoalsLeft > 0) {
      events.push({
        minute,
        type: 'GOAL',
        side: 'HOME',
        playerName: pickPlayerName(rng, true),
      })
      homeGoalsLeft--
    } else if (awayGoalsLeft > 0) {
      events.push({
        minute,
        type: 'GOAL',
        side: 'AWAY',
        playerName: pickPlayerName(rng, true),
      })
      awayGoalsLeft--
    }
  }

  events.sort((a, b) => a.minute - b.minute)
  return events
}

function generateCardEvents(homeOvr: number, awayOvr: number, rng: () => number): SimMatchEvent[] {
  const events: SimMatchEvent[] = []

  const homeCardChance = Math.max(0, 0.3 - awayOvr / 400)
  const awayCardChance = Math.max(0, 0.3 - homeOvr / 400)

  if (rng() < homeCardChance) {
    const minute = 20 + Math.floor(rng() * 65)
    events.push({
      minute,
      type: rng() < 0.15 ? 'RED_CARD' : 'YELLOW_CARD',
      side: 'HOME',
      playerName: pickPlayerName(rng, false),
    })
  }

  if (rng() < awayCardChance) {
    const minute = 20 + Math.floor(rng() * 65)
    events.push({
      minute,
      type: rng() < 0.15 ? 'RED_CARD' : 'YELLOW_CARD',
      side: 'AWAY',
      playerName: pickPlayerName(rng, false),
    })
  }

  return events
}

function simulatePenaltyShootout(rng: () => number): [number, number] {
  let home = 0
  let away = 0
  const rounds = 5
  const suddenDeathRounds = 10

  for (let round = 0; round < rounds; round++) {
    if (rng() < 0.75) home++
    if (rng() < 0.75) away++
  }

  if (home !== away) return [home, away]

  for (let round = 0; round < suddenDeathRounds; round++) {
    const h = rng() < 0.75 ? 1 : 0
    const a = rng() < 0.75 ? 1 : 0
    home += h
    away += a
    if (h !== a) return [home, away]
  }

  return [home, away]
}

function calculateExpectedGoals(
  attack: number,
  defense: number,
  goalkeeping: number,
  opponentOvr: number,
): number {
  const rawStrength = (attack * 0.5 + (100 - defense) * 0.25 + (100 - goalkeeping) * 0.25) / 100
  const scaling = 2.6 * (rawStrength / Math.max(rawStrength, 0.5))
  return Math.max(0.3, Math.min(scaling, 5))
}

function calculateOvrScore(homeOvr: number, awayOvr: number, rng: () => number): [number, number] {
  const totalOvr = homeOvr + awayOvr
  const homeExpectancy = ((homeOvr / Math.max(totalOvr, 1)) * 2.8) + (rng() * 0.4 - 0.2)
  const awayExpectancy = ((awayOvr / Math.max(totalOvr, 1)) * 2.8) + (rng() * 0.4 - 0.2)

  const homeGoals = simulatePoisson(Math.max(0.2, homeExpectancy), rng)
  const awayGoals = simulatePoisson(Math.max(0.2, awayExpectancy), rng)

  return [homeGoals, awayGoals]
}

export function simulateMatch(
  home: TeamStats,
  away: TeamStats,
  seed: number,
  isKnockout: boolean,
): SimMatchResult {
  const rng = createRng(seed)
  const [homeScore, awayScore] = calculateOvrScore(home.ovr, away.ovr, rng)

  const goalEvents = generateGoalEvents(homeScore, awayScore, rng)

  const cardRng = createRng(seed + 1000)
  const cardEvents = generateCardEvents(home.ovr, away.ovr, cardRng)

  const events = [...goalEvents, ...cardEvents].sort((a, b) => a.minute - b.minute)

  if (isKnockout && homeScore === awayScore) {
    const penaltyRng = createRng(seed + 2000)
    const [homePenalties, awayPenalties] = simulatePenaltyShootout(penaltyRng)

    const penaltyEvents: SimMatchEvent[] = []
    penaltyRng()
    for (let round = 0; round < Math.max(homePenalties, awayPenalties); round++) {
      const minute = 90 + round
      if (round < homePenalties) {
        penaltyEvents.push({
          minute,
          type: 'PENALTY_GOAL',
          side: 'HOME',
          playerName: pickPlayerName(penaltyRng, false),
        })
      }
      if (round < awayPenalties) {
        penaltyEvents.push({
          minute,
          type: 'PENALTY_GOAL',
          side: 'AWAY',
          playerName: pickPlayerName(penaltyRng, false),
        })
      }
    }

    const homeWon = homePenalties > awayPenalties
    const winnerId = homeWon ? home.id : away.id
    const penaltyResult = homeWon ? homePenalties : awayPenalties
    const loserResult = homeWon ? awayPenalties : homePenalties

    return {
      homeId: home.id,
      awayId: away.id,
      homeScore,
      awayScore,
      homePenalties: homeWon ? penaltyResult : loserResult,
      awayPenalties: homeWon ? loserResult : penaltyResult,
      wentToPenalties: true,
      winnerId,
      events: [...events, ...penaltyEvents],
    }
  }

  const winnerId =
    homeScore > awayScore ? home.id : awayScore > homeScore ? away.id : null

  return {
    homeId: home.id,
    awayId: away.id,
    homeScore,
    awayScore,
    wentToPenalties: false,
    winnerId,
    events,
  }
}

export function computeStandingFromMatches(
  entryId: string,
  name: string,
  groupCode: string,
  ovr: number,
  matches: SimMatchResult[],
): {
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
} {
  let played = 0
  let wins = 0
  let draws = 0
  let losses = 0
  let goalsFor = 0
  let goalsAgainst = 0

  for (const match of matches) {
    const isHome = match.homeId === entryId
    const isAway = match.awayId === entryId
    if (!isHome && !isAway) continue

    played++
    const scored = isHome ? match.homeScore : match.awayScore
    const conceded = isHome ? match.awayScore : match.homeScore
    goalsFor += scored
    goalsAgainst += conceded

    if (scored > conceded) wins++
    else if (scored === conceded) draws++
    else losses++
  }

  return {
    played,
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    points: wins * 3 + draws,
  }
}
