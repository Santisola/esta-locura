import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeDraftSessionState } from '../helpers/fixtures'

vi.mock('@/lib/db/client', () => ({
  getDb: vi.fn(),
}))

import { getDb } from '@/lib/db/client'
import { validateDraftCompletion, markDraftAsCompleted } from '@/lib/draft/finalize'

function buildMockDb() {
  return {
    query: {
      formations: { findFirst: vi.fn() },
      players: { findFirst: vi.fn() },
      users: { findFirst: vi.fn() },
      draftedTeams: { findFirst: vi.fn() },
      draftedTeamPlayers: { findMany: vi.fn() },
    },
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  }
}

const FORMATION_433 = {
  id: 'f1',
  code: '4-3-3',
  name: '4-3-3',
  slots: [
    { code: 'GK', lane: 'GK', order: 0 },
    { code: 'LB', lane: 'DEF', order: 1 },
    { code: 'CB1', lane: 'DEF', order: 2 },
    { code: 'CB2', lane: 'DEF', order: 3 },
    { code: 'RB', lane: 'DEF', order: 4 },
    { code: 'CM1', lane: 'MID', order: 5 },
    { code: 'CM2', lane: 'MID', order: 6 },
    { code: 'CM3', lane: 'MID', order: 7 },
    { code: 'LW', lane: 'ATT', order: 8 },
    { code: 'ST1', lane: 'ATT', order: 9 },
    { code: 'RW', lane: 'ATT', order: 10 },
  ],
}

const PLAYERS_BY_SLOT: Record<string, { id: string; name: string; primaryPosition: string; secondaryPositions: string[] }> = {
  GK: { id: 'p-gk', name: 'Alisson', primaryPosition: 'GK', secondaryPositions: [] },
  LB: { id: 'p-lb', name: 'Alba', primaryPosition: 'LB', secondaryPositions: [] },
  CB1: { id: 'p-cb1', name: 'Varane', primaryPosition: 'CB', secondaryPositions: [] },
  CB2: { id: 'p-cb2', name: 'Ramos', primaryPosition: 'CB', secondaryPositions: [] },
  RB: { id: 'p-rb', name: 'Alexander-Arnold', primaryPosition: 'RB', secondaryPositions: [] },
  CM1: { id: 'p-cm1', name: 'De Bruyne', primaryPosition: 'CM', secondaryPositions: [] },
  CM2: { id: 'p-cm2', name: 'Modric', primaryPosition: 'CM', secondaryPositions: [] },
  CM3: { id: 'p-cm3', name: 'Kroos', primaryPosition: 'CM', secondaryPositions: [] },
  LW: { id: 'p-lw', name: 'Sane', primaryPosition: 'LW', secondaryPositions: [] },
  ST1: { id: 'p-st', name: 'Benzema', primaryPosition: 'ST', secondaryPositions: [] },
  RW: { id: 'p-rw', name: 'Salah', primaryPosition: 'RW', secondaryPositions: [] },
}

function makeCompletePicks() {
  return Object.fromEntries(
    Object.entries(PLAYERS_BY_SLOT).map(([slot, player]) => [slot, player.id]),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('validateDraftCompletion', () => {
  it('draft completo y válido → resuelve con la formación', async () => {
    const mockDb = buildMockDb()
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>)
    mockDb.query.formations.findFirst.mockResolvedValue(FORMATION_433)
    // findFirst se llama una vez por cada slot en el orden de FORMATION_433.slots
    const slotOrder = FORMATION_433.slots.map((s) => s.code)
    for (const slotCode of slotOrder) {
      mockDb.query.players.findFirst.mockResolvedValueOnce(PLAYERS_BY_SLOT[slotCode])
    }

    const state = makeDraftSessionState({ formationCode: '4-3-3', picks: makeCompletePicks() })
    const formation = await validateDraftCompletion(state)

    expect(formation).not.toBeNull()
    expect(formation.code).toBe('4-3-3')
  })

  it('formación inexistente → lanza error', async () => {
    const mockDb = buildMockDb()
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>)
    mockDb.query.formations.findFirst.mockResolvedValue(null)

    const state = makeDraftSessionState({ formationCode: 'inexistente', picks: makeCompletePicks() })
    await expect(validateDraftCompletion(state)).rejects.toThrow('No existe la formacion')
  })

  it('slot sin pick (valor vacío) → lanza error sobre ese slot', async () => {
    const mockDb = buildMockDb()
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>)
    mockDb.query.formations.findFirst.mockResolvedValue(FORMATION_433)

    // El slot GK está presente como clave pero con valor vacío (sin jugador asignado)
    const picks = makeCompletePicks()
    picks['GK'] = ''
    const state = makeDraftSessionState({ formationCode: '4-3-3', picks })

    await expect(validateDraftCompletion(state)).rejects.toThrow('Falta cubrir el slot GK')
  })

  it('slots en picks no coinciden en cantidad con la formación → lanza error', async () => {
    const mockDb = buildMockDb()
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>)
    mockDb.query.formations.findFirst.mockResolvedValue(FORMATION_433)

    // Solo 5 picks para una formación de 11 slots
    const picks: Record<string, string> = { GK: 'p-gk', LB: 'p-lb', CB1: 'p-cb1', CB2: 'p-cb2', RB: 'p-rb' }
    const state = makeDraftSessionState({ picks })

    await expect(validateDraftCompletion(state)).rejects.toThrow('slots')
  })
})

describe('markDraftAsCompleted', () => {
  it('marca el draft como COMPLETED y devuelve el id', async () => {
    const mockDb = buildMockDb()
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>)

    mockDb.query.users.findFirst.mockResolvedValue({ id: 'user-1', sessionToken: 'tok', nickname: 'Test' })
    mockDb.query.draftedTeams.findFirst.mockResolvedValue({ id: 'draft-1', status: 'BUILDING' })
    mockDb.query.draftedTeamPlayers.findMany.mockResolvedValue([
      { id: 'pick-1' }, { id: 'pick-2' },
    ])

    const state = makeDraftSessionState({ picks: { GK: 'p1', ST1: 'p2' } })
    const result = await markDraftAsCompleted('test-token', state)

    expect(result.draftedTeamId).toBe('draft-1')
    expect(result.picksCount).toBe(2)
    expect(mockDb.update).toHaveBeenCalled()
  })

  it('sin sesión de usuario → lanza error', async () => {
    const mockDb = buildMockDb()
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>)
    mockDb.query.users.findFirst.mockResolvedValue(null)

    await expect(
      markDraftAsCompleted('token-inexistente', makeDraftSessionState()),
    ).rejects.toThrow('No existe una sesion guest')
  })

  it('sin draft en construcción → lanza error', async () => {
    const mockDb = buildMockDb()
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>)
    mockDb.query.users.findFirst.mockResolvedValue({ id: 'user-1' })
    mockDb.query.draftedTeams.findFirst.mockResolvedValue(null) // sin draft BUILDING

    await expect(
      markDraftAsCompleted('test-token', makeDraftSessionState()),
    ).rejects.toThrow('No existe un draft en construccion')
  })
})
