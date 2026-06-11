import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getDb } from '@/lib/db/client'
import { getOrCreateSessionToken } from '@/lib/draft/session-token'
import { rooms, roomParticipants, users } from '@/lib/db/schema'
import { generateRoomCode } from '@/lib/rooms/codes'
import { getUserBySession } from '@/lib/rooms/queries'
import { eq } from 'drizzle-orm'

const createRoomSchema = z.object({
  nickname: z.string().min(1).max(32).trim(),
  difficultyMode: z.enum(['CLASSIC', 'MEMORY']),
  rerollsPerPlayer: z.number().int().min(0).max(10).default(3),
  maxHumanPlayers: z.number().int().min(2).max(12).default(8),
  separateHumans: z.boolean().default(true),
})

// POST /api/rooms — crea una sala nueva y devuelve el código.
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = createRoomSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos.', details: parsed.error.flatten() }, { status: 400 })
    }

    const { nickname, difficultyMode, rerollsPerPlayer, maxHumanPlayers, separateHumans } = parsed.data
    const sessionToken = await getOrCreateSessionToken()
    const db = getDb()

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

    // Reintentar en caso de colisión de código (muy improbable).
    let code: string = generateRoomCode()
    for (let attempt = 0; attempt < 5; attempt++) {
      const existing = await db.query.rooms.findFirst({ where: eq(rooms.code, code) })
      if (!existing) break
      code = generateRoomCode()
    }

    const [room] = await db
      .insert(rooms)
      .values({ code, hostUserId: user.id, difficultyMode, rerollsPerPlayer, maxHumanPlayers, separateHumans, updatedAt: new Date() })
      .returning({ id: rooms.id, code: rooms.code })

    await db.insert(roomParticipants).values({
      roomId: room.id,
      userId: user.id,
      nicknameSnapshot: nickname,
      isHost: true,
      isReady: false,
      lastSeenAt: new Date(),
      updatedAt: new Date(),
    })

    return NextResponse.json({ roomId: room.id, code: room.code })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo crear la sala.' },
      { status: 500 },
    )
  }
}
