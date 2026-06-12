import type { SimMatchEvent, SimMatchResult, TeamStats } from './types'
import { createRng, simulatePoisson } from './rng'

const EVENT_MINUTES_BIAS = [8, 22, 31, 39, 44, 51, 58, 67, 73, 78, 82, 87, 90]

// Elige un protagonista del plantel real del equipo. Si por algun motivo no hay
// roster cargado, devuelve undefined (el evento se muestra sin nombre) en vez de
// inventar un jugador de otra seleccion.
function pickFrom(pool: string[] | undefined, rng: () => number): string | undefined {
  if (!pool || pool.length === 0) return undefined
  return pool[Math.floor(rng() * pool.length)]
}

function generateGoalEvents(
  home: TeamStats,
  away: TeamStats,
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
        playerName: pickFrom(home.roster?.goalScorers, rng),
      })
      homeGoalsLeft--
    } else if (awayGoalsLeft > 0) {
      events.push({
        minute,
        type: 'GOAL',
        side: 'AWAY',
        playerName: pickFrom(away.roster?.goalScorers, rng),
      })
      awayGoalsLeft--
    }
  }

  events.sort((a, b) => a.minute - b.minute)
  return events
}

function generateCardEvents(home: TeamStats, away: TeamStats, rng: () => number): SimMatchEvent[] {
  const events: SimMatchEvent[] = []

  const homeCardChance = Math.max(0, 0.3 - away.ovr / 400)
  const awayCardChance = Math.max(0, 0.3 - home.ovr / 400)

  if (rng() < homeCardChance) {
    const minute = 20 + Math.floor(rng() * 65)
    events.push({
      minute,
      type: rng() < 0.15 ? 'RED_CARD' : 'YELLOW_CARD',
      side: 'HOME',
      playerName: pickFrom(home.roster?.defenders, rng),
    })
  }

  if (rng() < awayCardChance) {
    const minute = 20 + Math.floor(rng() * 65)
    events.push({
      minute,
      type: rng() < 0.15 ? 'RED_CARD' : 'YELLOW_CARD',
      side: 'AWAY',
      playerName: pickFrom(away.roster?.defenders, rng),
    })
  }

  return events
}

// Probabilidad de convertir un penal: base alta, atenuada por el arquero rival.
function penaltyConversion(opponentGoalkeeping: number): number {
  return Math.max(0.62, Math.min(0.82, 0.85 - opponentGoalkeeping / 500))
}

function simulatePenaltyShootout(home: TeamStats, away: TeamStats, rng: () => number): [number, number] {
  let homeScore = 0
  let awayScore = 0
  const rounds = 5
  const suddenDeathRounds = 10

  const homeRate = penaltyConversion(away.goalkeeping)
  const awayRate = penaltyConversion(home.goalkeeping)

  for (let round = 0; round < rounds; round++) {
    if (rng() < homeRate) homeScore++
    if (rng() < awayRate) awayScore++
  }

  if (homeScore !== awayScore) return [homeScore, awayScore]

  for (let round = 0; round < suddenDeathRounds; round++) {
    const h = rng() < homeRate ? 1 : 0
    const a = rng() < awayRate ? 1 : 0
    homeScore += h
    awayScore += a
    if (h !== a) return [homeScore, awayScore]
  }

  return [homeScore, awayScore]
}

const BASE_GOALS = 1.35
// Sensibilidad del resultado a la diferencia de nivel entre equipos. Las medias
// están comprimidas (~70-90), así que el cociente entre dos equipos queda cerca
// de 1; este exponente expande esa diferencia. Con 3 el favorito gana lo
// esperado según la brecha de media (parejos: sorpresa habitual; brecha grande:
// sorpresa rara). Un valor bajo (ej. 1.25) hacía que las medias casi no pesaran.
const ATTACK_EXPONENT = 3.25

// Fuerza ofensiva de un equipo: el ataque manda, el mediocampo alimenta.
function attackingStrength(team: TeamStats): number {
  return team.attack * 0.62 + team.midfield * 0.38
}

// Fuerza defensiva de un equipo: la linea de fondo manda, el arquero sostiene.
function defensiveStrength(team: TeamStats): number {
  return team.defense * 0.62 + team.goalkeeping * 0.38
}

// Goles esperados (lambda de Poisson) del atacante contra la defensa rival.
// Compara las lineas reales en vez del OVR plano, de modo que la formacion
// y los jugadores elegidos en el draft impactan el resultado.
function expectedGoalsByLines(attacker: TeamStats, defender: TeamStats): number {
  const attack = attackingStrength(attacker)
  const defense = defensiveStrength(defender)
  const ratio = attack / Math.max(defense, 1)
  const lambda = BASE_GOALS * Math.pow(ratio, ATTACK_EXPONENT)
  return Math.max(0.18, Math.min(lambda, 4.5))
}

function calculateLineScore(home: TeamStats, away: TeamStats, rng: () => number): [number, number] {
  // RNG acotado para mantener sorpresas sin romper la coherencia de las lineas.
  const homeExpectancy = expectedGoalsByLines(home, away) + (rng() * 0.3 - 0.15)
  const awayExpectancy = expectedGoalsByLines(away, home) + (rng() * 0.3 - 0.15)

  const homeGoals = simulatePoisson(Math.max(0.15, homeExpectancy), rng)
  const awayGoals = simulatePoisson(Math.max(0.15, awayExpectancy), rng)

  return [homeGoals, awayGoals]
}

export function simulateMatch(
  home: TeamStats,
  away: TeamStats,
  seed: number,
  isKnockout: boolean,
): SimMatchResult {
  const rng = createRng(seed)
  const [homeScore, awayScore] = calculateLineScore(home, away, rng)

  const goalEvents = generateGoalEvents(home, away, homeScore, awayScore, rng)

  const cardRng = createRng(seed + 1000)
  const cardEvents = generateCardEvents(home, away, cardRng)

  const events = [...goalEvents, ...cardEvents].sort((a, b) => a.minute - b.minute)

  if (isKnockout && homeScore === awayScore) {
    const penaltyRng = createRng(seed + 2000)
    const [homePenalties, awayPenalties] = simulatePenaltyShootout(home, away, penaltyRng)

    const penaltyEvents: SimMatchEvent[] = []
    penaltyRng()
    for (let round = 0; round < Math.max(homePenalties, awayPenalties); round++) {
      const minute = 90 + round
      if (round < homePenalties) {
        penaltyEvents.push({
          minute,
          type: 'PENALTY_GOAL',
          side: 'HOME',
          playerName: pickFrom(home.roster?.goalScorers, penaltyRng),
        })
      }
      if (round < awayPenalties) {
        penaltyEvents.push({
          minute,
          type: 'PENALTY_GOAL',
          side: 'AWAY',
          playerName: pickFrom(away.roster?.goalScorers, penaltyRng),
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
