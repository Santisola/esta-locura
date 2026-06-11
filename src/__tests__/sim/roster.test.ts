import { describe, it, expect } from 'vitest'
import { buildTeamRoster } from '@/lib/sim/roster'
import type { RosterPlayer } from '@/lib/sim/roster'

function player(name: string, primaryPosition: string): RosterPlayer {
  return { name, primaryPosition }
}

describe('buildTeamRoster', () => {
  it('delanteros van a goalScorers pero no a defenders (con plantel completo)', () => {
    const roster = buildTeamRoster([
      player('Messi', 'ST'),
      player('Neymar', 'LW'),
      player('Varane', 'CB'),  // llena defenders para evitar fallback
    ])
    expect(roster.goalScorers).toContain('Messi')
    expect(roster.goalScorers).toContain('Neymar')
    expect(roster.defenders).not.toContain('Messi')
    expect(roster.defenders).not.toContain('Neymar')
  })

  it('mediocampistas van a goalScorers Y a defenders', () => {
    const roster = buildTeamRoster([
      player('De Bruyne', 'CM'),
      player('Busquets', 'CDM'),
    ])
    expect(roster.goalScorers).toContain('De Bruyne')
    expect(roster.defenders).toContain('De Bruyne')
    expect(roster.goalScorers).toContain('Busquets')
    expect(roster.defenders).toContain('Busquets')
  })

  it('defensores van a defenders pero no a goalScorers (con plantel completo)', () => {
    const roster = buildTeamRoster([
      player('Varane', 'CB'),
      player('Alba', 'LB'),
      player('Messi', 'ST'),  // llena goalScorers para evitar fallback
    ])
    expect(roster.defenders).toContain('Varane')
    expect(roster.defenders).toContain('Alba')
    expect(roster.goalScorers).not.toContain('Varane')
    expect(roster.goalScorers).not.toContain('Alba')
  })

  it('arqueros no van ni a goalScorers ni a defenders cuando ambas listas tienen jugadores', () => {
    const roster = buildTeamRoster([
      player('Alisson', 'GK'),
      player('Varane', 'CB'),   // llena defenders
      player('Messi', 'ST'),    // llena goalScorers
    ])
    expect(roster.goalScorers).not.toContain('Alisson')
    expect(roster.defenders).not.toContain('Alisson')
    expect(roster.goalScorers).toContain('Messi')
    expect(roster.defenders).toContain('Varane')
  })

  it('plantel solo con delanteros: defenders cae al fallback (incluye a todos)', () => {
    const players = [player('Messi', 'ST'), player('Mbappé', 'LW')]
    const roster = buildTeamRoster(players)
    // goalScorers tiene elementos, no usa fallback
    expect(roster.goalScorers).toEqual(['Messi', 'Mbappé'])
    // defenders vacío → usa plantel completo como fallback
    expect(roster.defenders).toEqual(['Messi', 'Mbappé'])
  })

  it('plantel solo con defensores y GK: goalScorers cae al fallback (incluye a todos)', () => {
    const players = [player('Alisson', 'GK'), player('Varane', 'CB'), player('Alba', 'LB')]
    const roster = buildTeamRoster(players)
    // defenders tiene CB y LB, no usa fallback
    expect(roster.defenders).toContain('Varane')
    expect(roster.defenders).toContain('Alba')
    // goalScorers vacío → usa plantel completo como fallback
    expect(roster.goalScorers).toEqual(players.map((p) => p.name))
  })

  it('plantel vacío devuelve listas vacías', () => {
    const roster = buildTeamRoster([])
    expect(roster.goalScorers).toEqual([])
    expect(roster.defenders).toEqual([])
  })
})
