import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/client', () => ({
  getDb: vi.fn(),
}))

import { getDb } from '@/lib/db/client'
import { getRoomState } from '@/lib/rooms/queries'

function buildMockDb() {
  return {
    query: {
      rooms: { findFirst: vi.fn() },
      roomParticipants: { findMany: vi.fn() },
      draftedTeams: { findFirst: vi.fn() },
    },
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  }
}

function makeRoom(overrides = {}) {
  return {
    id: 'room-1',
    code: 'ABCDEF',
    hostUserId: 'user-host',
    status: 'LOBBY',
    difficultyMode: 'CLASSIC',
    rerollsPerPlayer: 3,
    maxHumanPlayers: 8,
    separateHumans: true,
    revealStageIndex: -1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeParticipant(userId: string, lastSeenAt: Date, overrides = {}) {
  return {
    id: `part-${userId}`,
    roomId: 'room-1',
    userId,
    nicknameSnapshot: `Player ${userId}`,
    isHost: userId === 'user-host',
    isReady: false,
    connectionStatus: 'ONLINE',
    draftStatus: 'WAITING',
    lastSeenAt,
    joinedAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getRoomState', () => {
  it('devuelve null si la sala no existe', async () => {
    const mockDb = buildMockDb()
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>)
    mockDb.query.rooms.findFirst.mockResolvedValue(null)

    const result = await getRoomState('XXXXXX')
    expect(result).toBeNull()
  })

  it('devuelve el estado de una sala sin participantes', async () => {
    const mockDb = buildMockDb()
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>)
    mockDb.query.rooms.findFirst.mockResolvedValue(makeRoom())
    mockDb.query.roomParticipants.findMany.mockResolvedValue([])

    const state = await getRoomState('ABCDEF')
    expect(state).not.toBeNull()
    expect(state!.code).toBe('ABCDEF')
    expect(state!.participants).toHaveLength(0)
    expect(state!.status).toBe('LOBBY')
  })

  it('participante con lastSeenAt reciente → connectionStatus ONLINE', async () => {
    const mockDb = buildMockDb()
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>)
    mockDb.query.rooms.findFirst.mockResolvedValue(makeRoom())

    // lastSeenAt hace 5 segundos (< 12s threshold)
    const recent = new Date(Date.now() - 5000)
    mockDb.query.roomParticipants.findMany.mockResolvedValue([
      makeParticipant('user-1', recent),
    ])
    mockDb.query.draftedTeams.findFirst.mockResolvedValue(null)

    const state = await getRoomState('ABCDEF')
    expect(state!.participants[0].connectionStatus).toBe('ONLINE')
  })

  it('participante con lastSeenAt hace más de 12s → connectionStatus OFFLINE', async () => {
    const mockDb = buildMockDb()
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>)
    mockDb.query.rooms.findFirst.mockResolvedValue(makeRoom())

    // lastSeenAt hace 30 segundos (> 12s threshold)
    const stale = new Date(Date.now() - 30000)
    mockDb.query.roomParticipants.findMany.mockResolvedValue([
      makeParticipant('user-1', stale),
    ])
    mockDb.query.draftedTeams.findFirst.mockResolvedValue(null)

    const state = await getRoomState('ABCDEF')
    expect(state!.participants[0].connectionStatus).toBe('OFFLINE')
  })

  it('participante con draft en progreso reporta picks correctamente', async () => {
    const mockDb = buildMockDb()
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>)
    mockDb.query.rooms.findFirst.mockResolvedValue(makeRoom())
    mockDb.query.roomParticipants.findMany.mockResolvedValue([
      makeParticipant('user-1', new Date()),
    ])
    // Draft con 5 picks
    mockDb.query.draftedTeams.findFirst.mockResolvedValue({ id: 'draft-1' })
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: 'pick-1' }, { id: 'pick-2' }, { id: 'pick-3' },
          { id: 'pick-4' }, { id: 'pick-5' },
        ]),
      }),
    })

    const state = await getRoomState('ABCDEF')
    expect(state!.participants[0].draftProgress.filled).toBe(5)
    expect(state!.participants[0].draftProgress.total).toBe(11)
  })

  it('devuelve las propiedades clave de la sala correctamente', async () => {
    const mockDb = buildMockDb()
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>)
    mockDb.query.rooms.findFirst.mockResolvedValue(makeRoom({
      status: 'DRAFT',
      difficultyMode: 'MEMORY',
      rerollsPerPlayer: 5,
      maxHumanPlayers: 4,
    }))
    mockDb.query.roomParticipants.findMany.mockResolvedValue([])

    const state = await getRoomState('ABCDEF')
    expect(state!.status).toBe('DRAFT')
    expect(state!.difficultyMode).toBe('MEMORY')
    expect(state!.rerollsPerPlayer).toBe(5)
    expect(state!.maxHumanPlayers).toBe(4)
  })
})
