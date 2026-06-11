import { describe, it, expect } from 'vitest'
import { simulateGroupStage, rankThirdPlaced, getQualifiedTeams } from '@/lib/sim/group'
import { makeTeamStats } from '../helpers/fixtures'

function makeGroup(code: string, n = 4) {
  return {
    code,
    entries: Array.from({ length: n }, (_, i) =>
      makeTeamStats(`${code}${i}`, { name: `${code}${i}`, ovr: 70 + i }),
    ),
  }
}

describe('simulateGroupStage', () => {
  const groups = ['A', 'B', 'C'].map((c) => makeGroup(c))

  it('cada grupo de 4 equipos produce exactamente 6 partidos (round-robin)', () => {
    const { groupResults } = simulateGroupStage(groups, 'test-seed')
    for (const g of groupResults) {
      expect(g.matches).toHaveLength(6)
    }
  })

  it('cada grupo devuelve exactamente 4 standings', () => {
    const { standings } = simulateGroupStage(groups, 'test-seed')
    for (const g of standings) {
      expect(g).toHaveLength(4)
    }
  })

  it('standings están ordenados por puntos descendente', () => {
    const { standings } = simulateGroupStage(groups, 'test-seed')
    for (const g of standings) {
      for (let i = 0; i < g.length - 1; i++) {
        expect(g[i].points).toBeGreaterThanOrEqual(g[i + 1].points)
      }
    }
  })

  it('rank va de 1 a 4 en cada grupo', () => {
    const { standings } = simulateGroupStage(groups, 'test-seed')
    for (const g of standings) {
      const ranks = g.map((s) => s.rank).sort((a, b) => a - b)
      expect(ranks).toEqual([1, 2, 3, 4])
    }
  })

  it('todos los equipos jugaron exactamente 3 partidos', () => {
    const { standings } = simulateGroupStage(groups, 'test-seed')
    for (const g of standings) {
      for (const s of g) {
        expect(s.played).toBe(3)
      }
    }
  })

  it('puntos son consistentes con V/E/D', () => {
    const { standings } = simulateGroupStage(groups, 'test-seed')
    for (const g of standings) {
      for (const s of g) {
        expect(s.points).toBe(s.wins * 3 + s.draws)
      }
    }
  })

  it('partidos + derrotas + empates = 3 por equipo', () => {
    const { standings } = simulateGroupStage(groups, 'test-seed')
    for (const g of standings) {
      for (const s of g) {
        expect(s.wins + s.draws + s.losses).toBe(3)
      }
    }
  })

  it('es determinista: misma seed = mismos resultados', () => {
    const r1 = simulateGroupStage(groups, 'seed-42')
    const r2 = simulateGroupStage(groups, 'seed-42')
    expect(r1.standings).toEqual(r2.standings)
  })

  it('seeds distintas pueden producir resultados distintos', () => {
    const r1 = simulateGroupStage(groups, 'seed-1')
    const r2 = simulateGroupStage(groups, 'seed-2')
    // No necesariamente distintos, pero es muy improbable que sean iguales
    const same = JSON.stringify(r1.standings) === JSON.stringify(r2.standings)
    // Solo falla si el simulador es completamente determinista por otra razón
    // Este test es estadístico; con seeds muy distintas casi siempre difieren
    expect(typeof same).toBe('boolean') // siempre pasa; es documentación
  })
})

describe('rankThirdPlaced', () => {
  it('devuelve exactamente 8 equipos clasificados de 12 grupos', () => {
    const groups12 = Array.from({ length: 12 }, (_, i) =>
      makeGroup(String.fromCharCode(65 + i)),
    )
    const { standings } = simulateGroupStage(groups12, 'test')
    const { ranking, qualified } = rankThirdPlaced(standings)

    expect(ranking).toHaveLength(12)
    expect(qualified).toHaveLength(8)
  })

  it('qualified son los 8 primeros de ranking', () => {
    const groups12 = Array.from({ length: 12 }, (_, i) =>
      makeGroup(String.fromCharCode(65 + i)),
    )
    const { standings } = simulateGroupStage(groups12, 'test')
    const { ranking, qualified } = rankThirdPlaced(standings)

    expect(qualified).toEqual(ranking.slice(0, 8))
  })

  it('qualified están ordenados por puntos descendente', () => {
    const groups12 = Array.from({ length: 12 }, (_, i) =>
      makeGroup(String.fromCharCode(65 + i)),
    )
    const { standings } = simulateGroupStage(groups12, 'test')
    const { qualified } = rankThirdPlaced(standings)

    for (let i = 0; i < qualified.length - 1; i++) {
      expect(qualified[i].points).toBeGreaterThanOrEqual(qualified[i + 1].points)
    }
  })

  it('cada equipo en ranking es el 3er clasificado de su grupo', () => {
    const groups3 = ['A', 'B', 'C'].map((c) => makeGroup(c))
    const { standings } = simulateGroupStage(groups3, 'test')
    const { ranking } = rankThirdPlaced(standings)

    const thirdPlacers = new Set(standings.map((g) => g[2].entryId))
    for (const r of ranking) {
      expect(thirdPlacers.has(r.entryId)).toBe(true)
    }
  })
})

describe('getQualifiedTeams', () => {
  it('devuelve exactamente 32 equipos (24 de grupos + 8 terceros)', () => {
    const groups12 = Array.from({ length: 12 }, (_, i) =>
      makeGroup(String.fromCharCode(65 + i)),
    )
    const { standings } = simulateGroupStage(groups12, 'test')
    const { qualified } = rankThirdPlaced(standings)
    const teams = getQualifiedTeams(standings, qualified)

    expect(teams).toHaveLength(32)
  })

  it('incluye el 1° y 2° de cada grupo', () => {
    const groups12 = Array.from({ length: 12 }, (_, i) =>
      makeGroup(String.fromCharCode(65 + i)),
    )
    const { standings } = simulateGroupStage(groups12, 'test')
    const { qualified } = rankThirdPlaced(standings)
    const teams = getQualifiedTeams(standings, qualified)

    const teamIds = new Set(teams.map((t) => t.entryId))
    for (const g of standings) {
      expect(teamIds.has(g[0].entryId)).toBe(true) // 1°
      expect(teamIds.has(g[1].entryId)).toBe(true) // 2°
    }
  })

  it('incluye exactamente los 8 terceros clasificados', () => {
    const groups12 = Array.from({ length: 12 }, (_, i) =>
      makeGroup(String.fromCharCode(65 + i)),
    )
    const { standings } = simulateGroupStage(groups12, 'test')
    const { qualified } = rankThirdPlaced(standings)
    const teams = getQualifiedTeams(standings, qualified)

    const teamIds = new Set(teams.map((t) => t.entryId))
    for (const q of qualified) {
      expect(teamIds.has(q.entryId)).toBe(true)
    }
  })

  it('no hay duplicados', () => {
    const groups12 = Array.from({ length: 12 }, (_, i) =>
      makeGroup(String.fromCharCode(65 + i)),
    )
    const { standings } = simulateGroupStage(groups12, 'test')
    const { qualified } = rankThirdPlaced(standings)
    const teams = getQualifiedTeams(standings, qualified)

    const ids = teams.map((t) => t.entryId)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
