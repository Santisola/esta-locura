import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeDraftSessionState } from '../helpers/fixtures'

vi.mock('@/lib/db/client', () => ({
  getDb: vi.fn(),
  isDatabaseConfigured: vi.fn(),
}))

import { getDb, isDatabaseConfigured } from '@/lib/db/client'
import { loadDraftSnapshot, saveDraftSnapshot, clearDraftSnapshot } from '@/lib/draft/persistence'

const TOKEN = 'test-token-abc'

function buildMockDb() {
  const mockDb: Record<string, unknown> = {
    query: {
      users: { findFirst: vi.fn() },
      formations: { findFirst: vi.fn() },
      draftedTeams: { findFirst: vi.fn() },
      draftedTeamPlayers: { findMany: vi.fn() },
      players: { findFirst: vi.fn() },
    },
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{
          id: 'draft-id-1',
          updatedAt: new Date(),
        }]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: 'draft-id-1',
            updatedAt: new Date(),
          }]),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  }
  return mockDb
}

beforeEach(() => {
  vi.clearAllMocks()
  globalThis.__estaLocuraDraftMemoryStore = new Map()
})

describe('saveDraftSnapshot — fallback a memoria', () => {
  it('cuando DB no está configurada guarda en memoria', async () => {
    vi.mocked(isDatabaseConfigured).mockReturnValue(false)

    const state = makeDraftSessionState({ rerollsLeft: 2 })
    const result = await saveDraftSnapshot(TOKEN, state)

    expect(result.persistenceMode).toBe('local-fallback')
    expect(result.lastSavedAt).toBeTruthy()
  })

  it('cuando DB lanza error cae al fallback de memoria', async () => {
    vi.mocked(isDatabaseConfigured).mockReturnValue(true)
    vi.mocked(getDb).mockImplementation(() => { throw new Error('DB no disponible') })

    const state = makeDraftSessionState()
    const result = await saveDraftSnapshot(TOKEN, state)

    expect(result.persistenceMode).toBe('local-fallback')
  })
})

describe('loadDraftSnapshot — fallback a memoria', () => {
  it('cuando DB no está configurada devuelve el estado de memoria', async () => {
    vi.mocked(isDatabaseConfigured).mockReturnValue(false)

    // Primero guardamos en memoria directamente
    const { setMemoryDraft } = await import('@/lib/draft/memory')
    const state = makeDraftSessionState({ formationCode: '4-2-3-1' })
    setMemoryDraft(TOKEN, state)

    const snapshot = await loadDraftSnapshot(TOKEN)
    expect(snapshot.persistenceMode).toBe('local-fallback')
    expect(snapshot.draftState?.formationCode).toBe('4-2-3-1')
  })

  it('sin datos en memoria y sin DB devuelve draftState null', async () => {
    vi.mocked(isDatabaseConfigured).mockReturnValue(false)
    const snapshot = await loadDraftSnapshot('token-sin-datos')
    expect(snapshot.draftState).toBeNull()
  })
})

describe('saveDraftSnapshot — rama DB', () => {
  it('primer save (sin draft previo) llama a insert', async () => {
    vi.mocked(isDatabaseConfigured).mockReturnValue(true)
    const mockDb = buildMockDb()
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>)

    const mockUser = { id: 'user-1', sessionToken: TOKEN, nickname: 'Invitado' }
    const mockFormation = {
      id: 'formation-1',
      code: '4-3-3',
      slots: [{ code: 'GK', lane: 'GK', order: 0 }],
    }
    ;(mockDb.query as Record<string, Record<string, ReturnType<typeof vi.fn>>>)
      .users.findFirst.mockResolvedValue(mockUser)
    ;(mockDb.query as Record<string, Record<string, ReturnType<typeof vi.fn>>>)
      .formations.findFirst.mockResolvedValue(mockFormation)
    ;(mockDb.query as Record<string, Record<string, ReturnType<typeof vi.fn>>>)
      .draftedTeams.findFirst.mockResolvedValue(null) // sin draft previo
    ;(mockDb.query as Record<string, Record<string, ReturnType<typeof vi.fn>>>)
      .players.findFirst.mockResolvedValue(null)

    const state = makeDraftSessionState({ picks: {} })
    const result = await saveDraftSnapshot(TOKEN, state)

    expect(result.persistenceMode).toBe('remote')
    expect(mockDb.insert).toHaveBeenCalled()
  })

  it('save con draft existente llama a update', async () => {
    vi.mocked(isDatabaseConfigured).mockReturnValue(true)
    const mockDb = buildMockDb()
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>)

    const mockUser = { id: 'user-1', sessionToken: TOKEN, nickname: 'Invitado' }
    const mockFormation = { id: 'formation-1', code: '4-3-3', slots: [] }
    const mockDraft = { id: 'draft-id-1', userId: 'user-1', updatedAt: new Date() }
    ;(mockDb.query as Record<string, Record<string, ReturnType<typeof vi.fn>>>)
      .users.findFirst.mockResolvedValue(mockUser)
    ;(mockDb.query as Record<string, Record<string, ReturnType<typeof vi.fn>>>)
      .formations.findFirst.mockResolvedValue(mockFormation)
    ;(mockDb.query as Record<string, Record<string, ReturnType<typeof vi.fn>>>)
      .draftedTeams.findFirst.mockResolvedValue(mockDraft)
    ;(mockDb.query as Record<string, Record<string, ReturnType<typeof vi.fn>>>)
      .players.findFirst.mockResolvedValue(null)

    const state = makeDraftSessionState({ picks: {} })
    const result = await saveDraftSnapshot(TOKEN, state)

    expect(result.persistenceMode).toBe('remote')
    expect(mockDb.update).toHaveBeenCalled()
  })
})

describe('loadDraftSnapshot — rama DB', () => {
  it('devuelve el draftState parseado desde displayName', async () => {
    vi.mocked(isDatabaseConfigured).mockReturnValue(true)
    const mockDb = buildMockDb()
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>)

    const state = makeDraftSessionState({ formationCode: '3-5-2' })
    const mockUser = { id: 'user-1', sessionToken: TOKEN, nickname: 'Invitado' }
    const mockDraft = {
      id: 'draft-id-1',
      displayName: JSON.stringify(state),
      updatedAt: new Date(),
    }
    ;(mockDb.query as Record<string, Record<string, ReturnType<typeof vi.fn>>>)
      .users.findFirst.mockResolvedValue(mockUser)
    ;(mockDb.query as Record<string, Record<string, ReturnType<typeof vi.fn>>>)
      .draftedTeams.findFirst.mockResolvedValue(mockDraft)

    const snapshot = await loadDraftSnapshot(TOKEN)
    expect(snapshot.persistenceMode).toBe('remote')
    expect(snapshot.draftState?.formationCode).toBe('3-5-2')
  })

  it('displayName con JSON inválido devuelve draftState null', async () => {
    vi.mocked(isDatabaseConfigured).mockReturnValue(true)
    const mockDb = buildMockDb()
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>)

    const mockUser = { id: 'user-1', sessionToken: TOKEN, nickname: 'Invitado' }
    const mockDraft = { id: 'draft-id-1', displayName: 'JSON INVÁLIDO {{{', updatedAt: new Date() }
    ;(mockDb.query as Record<string, Record<string, ReturnType<typeof vi.fn>>>)
      .users.findFirst.mockResolvedValue(mockUser)
    ;(mockDb.query as Record<string, Record<string, ReturnType<typeof vi.fn>>>)
      .draftedTeams.findFirst.mockResolvedValue(mockDraft)

    const snapshot = await loadDraftSnapshot(TOKEN)
    expect(snapshot.draftState).toBeNull()
  })
})

describe('clearDraftSnapshot', () => {
  it('cuando DB no está configurada limpia la memoria', async () => {
    vi.mocked(isDatabaseConfigured).mockReturnValue(false)

    const { setMemoryDraft, getMemoryDraft } = await import('@/lib/draft/memory')
    setMemoryDraft(TOKEN, makeDraftSessionState())

    await clearDraftSnapshot(TOKEN)
    expect(getMemoryDraft(TOKEN)).toBeNull()
  })
})
