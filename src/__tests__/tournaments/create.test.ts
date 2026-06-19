import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/client', () => ({
  getDb: vi.fn(),
}))

vi.mock('@/lib/tournaments/simulate', () => ({
  simulateTournament: vi.fn().mockResolvedValue(undefined),
}))

import { getDb } from '@/lib/db/client'
import { computeDraftedTeamRatings, createTournament } from '@/lib/tournaments/create'

// ─── Tests puros de computeDraftedTeamRatings ────────────────────────────────

type Lane = 'GK' | 'DEF' | 'MID' | 'ATT'

function makePlayer(slotCode: string, ratings: { attack: number; midfield: number; defense: number; goalkeeping: number; ovr: number }) {
  return { slotCode, ...ratings }
}

describe('computeDraftedTeamRatings — puro', () => {
  const laneBySlot = new Map<string, Lane>([
    ['GK', 'GK'],
    ['LB', 'DEF'], ['CB1', 'DEF'], ['CB2', 'DEF'], ['RB', 'DEF'],
    ['CM1', 'MID'], ['CM2', 'MID'], ['CM3', 'MID'],
    ['LW', 'ATT'], ['ST1', 'ATT'], ['RW', 'ATT'],
  ])

  it('calcula el ataque como promedio de jugadores ATT', () => {
    const players = [
      makePlayer('LW', { attack: 80, midfield: 70, defense: 50, goalkeeping: 40, ovr: 70 }),
      makePlayer('ST1', { attack: 90, midfield: 70, defense: 50, goalkeeping: 40, ovr: 75 }),
      makePlayer('RW', { attack: 70, midfield: 70, defense: 50, goalkeeping: 40, ovr: 65 }),
      makePlayer('CM1', { attack: 65, midfield: 80, defense: 60, goalkeeping: 40, ovr: 68 }),
      makePlayer('CM2', { attack: 65, midfield: 80, defense: 60, goalkeeping: 40, ovr: 68 }),
      makePlayer('CM3', { attack: 65, midfield: 80, defense: 60, goalkeeping: 40, ovr: 68 }),
      makePlayer('LB', { attack: 55, midfield: 65, defense: 75, goalkeeping: 40, ovr: 65 }),
      makePlayer('CB1', { attack: 50, midfield: 60, defense: 80, goalkeeping: 40, ovr: 65 }),
      makePlayer('CB2', { attack: 50, midfield: 60, defense: 80, goalkeeping: 40, ovr: 65 }),
      makePlayer('RB', { attack: 55, midfield: 65, defense: 75, goalkeeping: 40, ovr: 65 }),
      makePlayer('GK', { attack: 40, midfield: 40, defense: 50, goalkeeping: 85, ovr: 70 }),
    ]

    const ratings = computeDraftedTeamRatings(players, laneBySlot)

    // ATT attack: (80+90+70)/3 = 80
    expect(ratings.attack).toBe(80)
    // MID midfield: (80+80+80)/3 = 80
    expect(ratings.midfield).toBe(80)
    // DEF defense: (75+80+80+75)/4 = 77.5 → redondeado a 78
    expect(ratings.defense).toBe(78)
    // GK goalkeeping: 85
    expect(ratings.goalkeeping).toBe(85)
    // OVR: round((80+80+78+85)/4) = round(323/4) = round(80.75) = 81
    expect(ratings.ovr).toBe(81)
  })

  it('lane sin jugadores usa el ovr general como fallback', () => {
    // Solo un jugador en ATT, sin GK
    const laneOnlyAtt = new Map<string, Lane>([['ST1', 'ATT']])
    const players = [
      makePlayer('ST1', { attack: 80, midfield: 60, defense: 50, goalkeeping: 40, ovr: 70 }),
    ]

    const ratings = computeDraftedTeamRatings(players, laneOnlyAtt)

    // GK no tiene jugadores → usa overallOvr (promedio de todos los ovr = 70)
    expect(ratings.goalkeeping).toBe(70) // fallback al overallOvr
    // ATT sí tiene jugador → usa su attack
    expect(ratings.attack).toBe(80)
  })

  it('ovr es el promedio redondeado de las 4 líneas', () => {
    const laneSimple = new Map<string, Lane>([
      ['GK', 'GK'], ['CB1', 'DEF'], ['CM1', 'MID'], ['ST1', 'ATT'],
    ])
    const players = [
      makePlayer('GK', { attack: 40, midfield: 40, defense: 40, goalkeeping: 80, ovr: 70 }),
      makePlayer('CB1', { attack: 40, midfield: 40, defense: 80, goalkeeping: 40, ovr: 70 }),
      makePlayer('CM1', { attack: 40, midfield: 80, defense: 40, goalkeeping: 40, ovr: 70 }),
      makePlayer('ST1', { attack: 80, midfield: 40, defense: 40, goalkeeping: 40, ovr: 70 }),
    ]

    const ratings = computeDraftedTeamRatings(players, laneSimple)
    expect(ratings.ovr).toBe(Math.round((ratings.attack + ratings.midfield + ratings.defense + ratings.goalkeeping) / 4))
  })
})

// ─── Tests con mock DB de createTournament ────────────────────────────────────

function makeNationalTeam(i: number) {
  return {
    id: `team-${i}`,
    name: `Country ${i}`,
    slug: `country-${i}`,
    code: `C${i}`,
    confederation: 'UEFA',
    attack: 70 + i,
    midfield: 70 + i,
    defense: 70 + i,
    goalkeeping: 70 + i,
    ovr: 70 + i,
  }
}

function buildMockDbForCreate() {
  // Genera 48 selecciones reales
  const realTeams = Array.from({ length: 48 }, (_, i) => makeNationalTeam(i))

  let tournamentInsertCallCount = 0

  const mockDb = {
    query: {
      nationalTeams: { findMany: vi.fn().mockResolvedValue(realTeams) },
    },
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation((data: unknown) => {
        tournamentInsertCallCount++
        const isArray = Array.isArray(data)
        const ids = isArray
          ? (data as Record<string, unknown>[]).map((_, i) => ({ id: `entry-${tournamentInsertCallCount}-${i}` }))
          : [{ id: `tournament-${tournamentInsertCallCount}` }]
        return {
          returning: vi.fn().mockResolvedValue(ids),
        }
      }),
    })),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  }

  return mockDb
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createTournament — con mock DB', () => {
  it('crea un torneo con 1 humano y 47 selecciones reales', async () => {
    const mockDb = buildMockDbForCreate()
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>)

    await createTournament({
      type: 'SINGLEPLAYER',
      humans: [{
        draftedTeamId: 'draft-1',
        displayName: 'Mi Selección',
        ratings: { attack: 80, midfield: 78, defense: 76, goalkeeping: 75, ovr: 77 },
      }],
      separateHumans: false,
      seedBase: 'test-seed',
    })

    // insert llamado al menos 3 veces: tournaments + human entries + real entries
    expect(mockDb.insert).toHaveBeenCalledTimes(3)
  })

  it('lanza error si hay más de 20 humanos', async () => {
    const mockDb = buildMockDbForCreate()
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>)

    const humans = Array.from({ length: 21 }, (_, i) => ({
      draftedTeamId: `draft-${i}`,
      displayName: `Player ${i}`,
      ratings: { attack: 75, midfield: 75, defense: 75, goalkeeping: 75, ovr: 75 },
    }))

    await expect(createTournament({ type: 'MULTIPLAYER', humans, separateHumans: true, seedBase: 'x' }))
      .rejects.toThrow('máximo')
  })

  it('lanza error si no hay humanos', async () => {
    const mockDb = buildMockDbForCreate()
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>)

    await expect(createTournament({ type: 'SINGLEPLAYER', humans: [], separateHumans: false, seedBase: 'x' }))
      .rejects.toThrow('al menos un equipo')
  })

  it('llama a simulateTournament al finalizar', async () => {
    const mockDb = buildMockDbForCreate()
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>)

    const { simulateTournament } = await import('@/lib/tournaments/simulate')

    await createTournament({
      type: 'SINGLEPLAYER',
      humans: [{
        draftedTeamId: 'draft-1',
        displayName: 'Mi Selección',
        ratings: { attack: 80, midfield: 78, defense: 76, goalkeeping: 75, ovr: 77 },
      }],
      separateHumans: false,
      seedBase: 'test-seed',
    })

    expect(simulateTournament).toHaveBeenCalledOnce()
  })
})
