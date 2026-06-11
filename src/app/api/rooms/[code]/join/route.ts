import { NextResponse } from 'next/server'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'

import { getDb } from '@/lib/db/client'
import { getOrCreateSessionToken } from '@/lib/draft/session-token'
import { rooms, roomParticipants, users } from '@/lib/db/schema'
import { getRoomState, getUserBySession } from '@/lib/rooms/queries'

const joinSchema = z.object({
  nickname: z.string().min(1).max(32).trim(),
})

// POST /api/rooms/[code]/join
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params
    const body = await request.json()
    const parsed = joinSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Nickname inválido.' }, { status: 400 })
    }

    const { nickname } = parsed.data
    const sessionToken = await getOrCreateSessionToken()
    const db = getDb()

    const room = await db.query.rooms.findFirst({ where: eq(rooms.code, code.toUpperCase()) })

    if (!room) return NextResponse.json({ error: 'Sala no encontrada.' }, { status: 404 })
    if (room.status !== 'LOBBY') return NextResponse.json({ error: 'La sala ya no está en fase de lobby.' }, { status: 409 })

    let user = await getUserBySession(sessionToken)

    if (!user) {
      const [created] = await db
        .insert(users)
        .values({ nickname, sessionToken })
        .returning()
      user = created
    } else if (user.nickname !== nickname) {
      await db.update(users).set({ nickname, updatedAt: new Date() }).where(eq(users.id, user.id))
      user = { ...user, nickname }
    }

    // Verificar si ya es participante (reconexión).
    const existing = await db.query.roomParticipants.findFirst({
      where: and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, user.id)),
    })

    if (existing) {
      await db
        .update(roomParticipants)
        .set({ lastSeenAt: new Date(), updatedAt: new Date() })
        .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, user.id)))
    } else {
      const currentCount = await db.query.roomParticipants.findMany({
        where: eq(roomParticipants.roomId, room.id),
      })

      if (currentCount.length >= room.maxHumanPlayers) {
        return NextResponse.json({ error: 'La sala está llena.' }, { status: 409 })
      }

      // Nickname único en la sala.
      const nicknameTaken = currentCount.some((p) => p.nicknameSnapshot === nickname)
      if (nicknameTaken) {
        return NextResponse.json({ error: 'Ese nombre ya está en uso en la sala.' }, { status: 409 })
      }

      await db.insert(roomParticipants).values({
        roomId: room.id,
        userId: user.id,
        nicknameSnapshot: nickname,
        isHost: false,
        isReady: false,
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      })
    }

    const state = await getRoomState(code.toUpperCase())
    return NextResponse.json({ joined: true, state })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo unir a la sala.' },
      { status: 500 },
    )
  }
}
