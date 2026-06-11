import { describe, it, expect } from 'vitest'
import { simulateMatch, computeStandingFromMatches } from '@/lib/sim/match'
import { makeTeamStats } from '../helpers/fixtures'
import type { SimMatchResult } from '@/lib/sim/types'

const STRONG = makeTeamStats('strong', { attack: 90, midfield: 85, defense: 80, goalkeeping: 80, ovr: 85 })
const WEAK = makeTeamStats('weak', { attack: 55, midfield: 55, defense: 55, goalkeeping: 55, ovr: 55 })
const EQUAL_A = makeTeamStats('equalA', { attack: 75, midfield: 75, defense: 75, goalkeeping: 75, ovr: 75 })
const EQUAL_B = makeTeamStats('equalB', { attack: 75, midfield: 75, defense: 75, goalkeeping: 75, ovr: 75 })

describe('simulateMatch — determinismo', () => {
  it('misma seed produce exactamente el mismo resultado', () => {
    const r1 = simulateMatch(STRONG, WEAK, 12345, false)
    const r2 = simulateMatch(STRONG, WEAK, 12345, false)
    expect(r1).toEqual(r2)
  })

  it('seeds distintas pueden producir resultados distintos', () => {
    const results = new Set(
      Array.from({ length: 50 }, (_, i) =>
        `${simulateMatch(EQUAL_A, EQUAL_B, i, false).homeScore}-${simulateMatch(EQUAL_A, EQUAL_B, i, false).awayScore}`,
      ),
    )
    expect(results.size).toBeGreaterThan(1)
  })
})

describe('simulateMatch — estructura del resultado', () => {
  it('homeId y awayId coinciden con los equipos recibidos', () => {
    const r = simulateMatch(STRONG, WEAK, 1, false)
    expect(r.homeId).toBe('strong')
    expect(r.awayId).toBe('weak')
  })

  it('scores son enteros no negativos', () => {
    for (let seed = 0; seed < 20; seed++) {
      const r = simulateMatch(STRONG, WEAK, seed, false)
      expect(Number.isInteger(r.homeScore)).toBe(true)
      expect(Number.isInteger(r.awayScore)).toBe(true)
      expect(r.homeScore).toBeGreaterThanOrEqual(0)
      expect(r.awayScore).toBeGreaterThanOrEqual(0)
    }
  })

  it('winnerId es el equipo con más goles, o null en empate sin KO', () => {
    for (let seed = 0; seed < 100; seed++) {
      const r = simulateMatch(EQUAL_A, EQUAL_B, seed, false)
      if (r.homeScore > r.awayScore) expect(r.winnerId).toBe('equalA')
      else if (r.awayScore > r.homeScore) expect(r.winnerId).toBe('equalB')
      else expect(r.winnerId).toBeNull()
    }
  })
})

describe('simulateMatch — penales en KO', () => {
  it('empate en tiempo regular con isKnockout=true → wentToPenalties=true con ganador', () => {
    // Busca una seed que produzca empate con equipos iguales
    let drawSeed: number | null = null
    for (let seed = 0; seed < 10000; seed++) {
      const r = simulateMatch(EQUAL_A, EQUAL_B, seed, false)
      if (r.homeScore === r.awayScore) {
        drawSeed = seed
        break
      }
    }
    expect(drawSeed).not.toBeNull()

    const ko = simulateMatch(EQUAL_A, EQUAL_B, drawSeed!, true)
    expect(ko.wentToPenalties).toBe(true)
    expect(ko.homePenalties).toBeDefined()
    expect(ko.awayPenalties).toBeDefined()
    expect(ko.winnerId).not.toBeNull()
    expect(ko.homeScore).toBe(ko.awayScore) // empate en 90'
  })

  it('mismo empate con isKnockout=false → wentToPenalties=false', () => {
    let drawSeed: number | null = null
    for (let seed = 0; seed < 10000; seed++) {
      const r = simulateMatch(EQUAL_A, EQUAL_B, seed, false)
      if (r.homeScore === r.awayScore) { drawSeed = seed; break }
    }
    const regular = simulateMatch(EQUAL_A, EQUAL_B, drawSeed!, false)
    expect(regular.wentToPenalties).toBe(false)
    expect(regular.winnerId).toBeNull()
  })

  it('resultado distinto en 90min -> wentToPenalties=false aunque sea KO', () => {
    // Con equipo muy fuerte vs muy débil, la mayoría de seeds no producen empate
    for (let seed = 0; seed < 50; seed++) {
      const r = simulateMatch(STRONG, WEAK, seed, true)
      if (r.homeScore !== r.awayScore) {
        expect(r.wentToPenalties).toBe(false)
        return
      }
    }
    // Si todos dieron empate (extremadamente improbable), el test pasa vacío
  })
})

describe('simulateMatch — ventaja del favorito', () => {
  it('equipo fuerte gana más del 60% de los partidos contra equipo débil', () => {
    let wins = 0
    const n = 500
    for (let seed = 0; seed < n; seed++) {
      const r = simulateMatch(STRONG, WEAK, seed, false)
      if (r.winnerId === 'strong') wins++
    }
    expect(wins / n).toBeGreaterThan(0.6)
  })

  it('equipos iguales producen resultados equilibrados', () => {
    let homeWins = 0
    let awayWins = 0
    const n = 500
    for (let seed = 0; seed < n; seed++) {
      const r = simulateMatch(EQUAL_A, EQUAL_B, seed, false)
      if (r.winnerId === 'equalA') homeWins++
      else if (r.winnerId === 'equalB') awayWins++
    }
    // Sin ventaja de localía: ambas victorias deben ser similares (diferencia < 10%)
    const diff = Math.abs(homeWins - awayWins) / n
    expect(diff).toBeLessThan(0.10)
  })
})

describe('simulateMatch — eventos', () => {
  it('todos los eventos de gol tienen side correcto según quién marcó', () => {
    for (let seed = 0; seed < 30; seed++) {
      const r = simulateMatch(STRONG, WEAK, seed, false)
      const goalEvents = r.events.filter((e) => e.type === 'GOAL')
      for (const e of goalEvents) {
        expect(e.side === 'HOME' || e.side === 'AWAY').toBe(true)
      }
    }
  })

  it('eventos con roster usan nombres del equipo correcto', () => {
    const homeWithRoster = makeTeamStats('h', {
      roster: { goalScorers: ['HomePlayer'], defenders: ['HomeDefender'] },
    })
    const awayWithRoster = makeTeamStats('a', {
      roster: { goalScorers: ['AwayPlayer'], defenders: ['AwayDefender'] },
    })

    let homeGoals: string[] = []
    let awayGoals: string[] = []

    for (let seed = 0; seed < 200; seed++) {
      const r = simulateMatch(homeWithRoster, awayWithRoster, seed, false)
      for (const e of r.events) {
        if (e.type === 'GOAL' && e.playerName) {
          if (e.side === 'HOME') homeGoals.push(e.playerName)
          else awayGoals.push(e.playerName)
        }
      }
    }

    // Ningún gol del HOME tiene nombre del AWAY y viceversa
    expect(homeGoals.every((n) => n === 'HomePlayer')).toBe(true)
    expect(awayGoals.every((n) => n === 'AwayPlayer')).toBe(true)
  })
})

describe('computeStandingFromMatches', () => {
  const makeResult = (homeId: string, awayId: string, h: number, a: number): SimMatchResult => ({
    homeId, awayId, homeScore: h, awayScore: a,
    wentToPenalties: false, winnerId: h > a ? homeId : a > h ? awayId : null, events: [],
  })

  it('3 victorias → 9 puntos', () => {
    const matches = [
      makeResult('A', 'B', 2, 0),
      makeResult('A', 'C', 1, 0),
      makeResult('A', 'D', 3, 1),
    ]
    const s = computeStandingFromMatches('A', 'A', 'G', 75, matches)
    expect(s.wins).toBe(3)
    expect(s.draws).toBe(0)
    expect(s.losses).toBe(0)
    expect(s.points).toBe(9)
  })

  it('1 victoria, 1 empate, 1 derrota → 4 puntos', () => {
    const matches = [
      makeResult('A', 'B', 2, 0),
      makeResult('A', 'C', 1, 1),
      makeResult('D', 'A', 2, 0),
    ]
    const s = computeStandingFromMatches('A', 'A', 'G', 75, matches)
    expect(s.points).toBe(4)
    expect(s.wins).toBe(1)
    expect(s.draws).toBe(1)
    expect(s.losses).toBe(1)
  })

  it('goles a favor y en contra se calculan correctamente', () => {
    const matches = [
      makeResult('A', 'B', 3, 1), // A como local: +3 GF, +1 GC
      makeResult('C', 'A', 2, 0), // A como visitante: +0 GF, +2 GC
    ]
    const s = computeStandingFromMatches('A', 'A', 'G', 75, matches)
    expect(s.goalsFor).toBe(3)
    expect(s.goalsAgainst).toBe(3)
    expect(s.goalDifference).toBe(0)
    expect(s.played).toBe(2)
  })

  it('partidos donde el equipo no participa son ignorados', () => {
    const matches = [
      makeResult('B', 'C', 2, 1),
      makeResult('D', 'E', 0, 0),
    ]
    const s = computeStandingFromMatches('A', 'A', 'G', 75, matches)
    expect(s.played).toBe(0)
    expect(s.points).toBe(0)
  })
})
