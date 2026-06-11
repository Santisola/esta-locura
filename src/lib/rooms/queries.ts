import 'server-only'

import { and, eq } from 'drizzle-orm'

import { getDb } from '@/lib/db/client'
import { draftedTeamPlayers, draftedTeams, roomParticipants, rooms, users } from '@/lib/db/schema'

const OFFLINE_THRESHOLD_MS = 12_000

export type ParticipantState = {
  userId: string
  nickname: string
  isHost: boolean
  isReady: boolean
  connectionStatus: 'ONLINE' | 'OFFLINE'
  draftStatus: 'WAITING' | 'CHOOSING' | 'COMPLETED' | 'DISCONNECTED'
  draftProgress: { filled: number; total: number }
}

export type RoomState = {
  roomId: string
  code: string
  status: 'LOBBY' | 'DRAFT' | 'TOURNAMENT' | 'FINISHED' | 'CANCELLED'
  hostUserId: string
  difficultyMode: 'CLASSIC' | 'MEMORY'
  rerollsPerPlayer: number
  maxHumanPlayers: number
  separateHumans: boolean
  revealStageIndex: number
  participants: ParticipantState[]
}

// Resuelve el estado completo de la sala: participantes, presencia y progreso
// de draft. El estado se recalcula en cada poll; no hay cache.
export async function getRoomState(code: string): Promise<RoomState | null> {
  const db = getDb()

  const room = await db.query.rooms.findFirst({
    where: eq(rooms.code, code),
  })

  if (!room) return null

  const participants = await db.query.roomParticipants.findMany({
    where: eq(roomParticipants.roomId, room.id),
    orderBy: (table, { asc }) => [asc(table.joinedAt)],
  })

  const now = Date.now()

  const participantStates: ParticipantState[] = await Promise.all(
    participants.map(async (p) => {
      const isOnline = now - new Date(p.lastSeenAt).getTime() < OFFLINE_THRESHOLD_MS
      const connectionStatus = isOnline ? 'ONLINE' : 'OFFLINE'

      // Progreso de draft: contar picks del drafted_team en BUILDING o COMPLETED
      // vinculado a esta sala y a este usuario.
      let draftProgress = { filled: 0, total: 11 }

      const userDraft = await db.query.draftedTeams.findFirst({
        where: and(
          eq(draftedTeams.userId, p.userId),
          eq(draftedTeams.roomId, room.id),
        ),
        orderBy: (table, { desc }) => [desc(table.updatedAt)],
      })

      if (userDraft) {
        const picks = await db
          .select({ id: draftedTeamPlayers.id })
          .from(draftedTeamPlayers)
          .where(eq(draftedTeamPlayers.draftedTeamId, userDraft.id))
        draftProgress = { filled: picks.length, total: 11 }
      }

      return {
        userId: p.userId,
        nickname: p.nicknameSnapshot,
        isHost: p.isHost,
        isReady: p.isReady,
        connectionStatus,
        draftStatus: p.draftStatus as ParticipantState['draftStatus'],
        draftProgress,
      }
    }),
  )

  return {
    roomId: room.id,
    code: room.code,
    status: room.status as RoomState['status'],
    hostUserId: room.hostUserId,
    difficultyMode: room.difficultyMode as RoomState['difficultyMode'],
    rerollsPerPlayer: room.rerollsPerPlayer,
    maxHumanPlayers: room.maxHumanPlayers,
    separateHumans: room.separateHumans,
    revealStageIndex: room.revealStageIndex,
    participants: participantStates,
  }
}

// Resuelve qué userId corresponde a la cookie de sesión dada.
export async function getUserBySession(sessionToken: string) {
  const db = getDb()
  return db.query.users.findFirst({
    where: eq(users.sessionToken, sessionToken),
  })
}
