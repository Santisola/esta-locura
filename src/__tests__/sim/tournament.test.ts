import { describe, it, expect } from 'vitest'
import { simulateFullTournament } from '@/lib/sim/tournament'
import { makeGroups } from '../helpers/fixtures'

describe('simulateFullTournament — smoke test', () => {
  const groups = makeGroups(12, 4)

  it('devuelve 12 grupos en groupStandings', () => {
    const result = simulateFullTournament(groups, 'smoke-seed')
    expect(result.groupStandings).toHaveLength(12)
  })

  it('cada grupo tiene 4 standings', () => {
    const result = simulateFullTournament(groups, 'smoke-seed')
    for (const g of result.groupStandings) {
      expect(g).toHaveLength(4)
    }
  })

  it('hay 12 grupos de resultados de grupo', () => {
    const result = simulateFullTournament(groups, 'smoke-seed')
    expect(result.groupMatchResults).toHaveLength(12)
  })

  it('cada grupo de grupo tiene 6 partidos', () => {
    const result = simulateFullTournament(groups, 'smoke-seed')
    for (const g of result.groupMatchResults) {
      expect(g).toHaveLength(6)
    }
  })

  it('hay exactamente 8 terceros clasificados calificados', () => {
    const result = simulateFullTournament(groups, 'smoke-seed')
    expect(result.qualifiedThirdCount).toBe(8)
    expect(result.thirdPlaceRanking).toHaveLength(12) // ranking completo
  })

  it('el bracket tiene las 5 rondas KO', () => {
    const result = simulateFullTournament(groups, 'smoke-seed')
    const rounds = new Set(result.bracket.map((s) => s.round))
    expect(rounds.has('ROUND_OF_32')).toBe(true)
    expect(rounds.has('ROUND_OF_16')).toBe(true)
    expect(rounds.has('QUARTER_FINAL')).toBe(true)
    expect(rounds.has('SEMI_FINAL')).toBe(true)
    expect(rounds.has('FINAL')).toBe(true)
  })

  it('hay exactamente un campeón y pertenece a los 48 equipos', () => {
    const result = simulateFullTournament(groups, 'smoke-seed')
    expect(result.championId).toBeTruthy()

    const allIds = new Set(groups.flatMap((g) => g.entries.map((e) => e.id)))
    expect(allIds.has(result.championId!)).toBe(true)
  })

  it('es determinista: misma seed = mismo campeón', () => {
    const r1 = simulateFullTournament(groups, 'same-seed-42')
    const r2 = simulateFullTournament(groups, 'same-seed-42')
    expect(r1.championId).toBe(r2.championId)
  })

  it('seeds distintas pueden producir campeones distintos', () => {
    const champions = new Set(
      Array.from({ length: 10 }, (_, i) =>
        simulateFullTournament(groups, `varied-seed-${i}`).championId,
      ),
    )
    // Con 10 seeds y 48 equipos, casi siempre habrá más de 1 campeón distinto
    expect(champions.size).toBeGreaterThan(1)
  })
})
