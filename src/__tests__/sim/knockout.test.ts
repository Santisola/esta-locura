import { describe, it, expect } from 'vitest'
import { simulateKnockoutBracket } from '@/lib/sim/knockout'
import { simulateGroupStage, rankThirdPlaced } from '@/lib/sim/group'
import { makeGroups } from '../helpers/fixtures'

function buildKnockoutInputs(seed = 'test') {
  const groups = makeGroups(12, 4)
  const { standings } = simulateGroupStage(groups, seed)
  const { qualified } = rankThirdPlaced(standings)

  const entryNames = new Map<string, string>()
  const teamStatsById = new Map<string, import('@/lib/sim/types').TeamStats>()

  for (const group of groups) {
    for (const entry of group.entries) {
      entryNames.set(entry.id, entry.name)
      teamStatsById.set(entry.id, entry)
    }
  }

  return { standings, qualified, entryNames, teamStatsById }
}

describe('simulateKnockoutBracket', () => {
  it('produce exactamente las 5 rondas esperadas', () => {
    const { standings, qualified, entryNames, teamStatsById } = buildKnockoutInputs()
    const { bracketStages } = simulateKnockoutBracket(standings, qualified, entryNames, teamStatsById, 'test')

    const rounds = bracketStages.map((s) => s.round)
    expect(rounds).toContain('ROUND_OF_32')
    expect(rounds).toContain('ROUND_OF_16')
    expect(rounds).toContain('QUARTER_FINAL')
    expect(rounds).toContain('SEMI_FINAL')
    expect(rounds).toContain('FINAL')
  })

  it('R32 tiene 16 partidos, R16 tiene 8, QF 4, SF 2, Final 1', () => {
    const { standings, qualified, entryNames, teamStatsById } = buildKnockoutInputs()
    const { bracketStages } = simulateKnockoutBracket(standings, qualified, entryNames, teamStatsById, 'test')

    const byRound = Object.fromEntries(bracketStages.map((s) => [s.round, s.matches.length]))
    expect(byRound['ROUND_OF_32']).toBe(16)
    expect(byRound['ROUND_OF_16']).toBe(8)
    expect(byRound['QUARTER_FINAL']).toBe(4)
    expect(byRound['SEMI_FINAL']).toBe(2)
    expect(byRound['FINAL']).toBe(1)
  })

  it('hay exactamente un campeón', () => {
    const { standings, qualified, entryNames, teamStatsById } = buildKnockoutInputs()
    const { championId } = simulateKnockoutBracket(standings, qualified, entryNames, teamStatsById, 'test')

    expect(championId).toBeTruthy()
    expect(typeof championId).toBe('string')
  })

  it('el campeón es uno de los 48 equipos participantes', () => {
    const inputs = buildKnockoutInputs()
    const { championId } = simulateKnockoutBracket(
      inputs.standings, inputs.qualified, inputs.entryNames, inputs.teamStatsById, 'test',
    )
    expect(inputs.entryNames.has(championId!)).toBe(true)
  })

  it('todos los partidos de la Final tienen resultado', () => {
    const { standings, qualified, entryNames, teamStatsById } = buildKnockoutInputs()
    const { bracketStages } = simulateKnockoutBracket(standings, qualified, entryNames, teamStatsById, 'test')

    const final = bracketStages.find((s) => s.round === 'FINAL')!
    for (const m of final.matches) {
      expect(m.result).toBeDefined()
      expect(m.result!.winnerId).toBeTruthy()
    }
  })

  it('es determinista: misma seed = mismo campeón', () => {
    const seed = 'determinism-test'
    const i1 = buildKnockoutInputs(seed)
    const i2 = buildKnockoutInputs(seed)
    const r1 = simulateKnockoutBracket(i1.standings, i1.qualified, i1.entryNames, i1.teamStatsById, seed)
    const r2 = simulateKnockoutBracket(i2.standings, i2.qualified, i2.entryNames, i2.teamStatsById, seed)
    expect(r1.championId).toBe(r2.championId)
  })
})
