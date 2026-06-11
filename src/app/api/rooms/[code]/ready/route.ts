import { NextResponse } from 'next/server'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'

import { getDb } from '@/lib/db/client'
import { getSessionTokenReadOnly } from '@/lib/draft/session-token'
import { roomParticipants, rooms } from '@/lib/db/schema'
import { getUserBySession } from '@/lib/rooms/queries'

const schema = z.object({ isReady: z.boolean() })

// POST /api/rooms/[code]/ready — toggle de listo del participante.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params
    const sessionToken = await getSessionTokenReadOnly()
    if (!sessionToken) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 })

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 })

    const db = getDb()
    const user = await getUserBySession(sessionToken)
    if (!user) return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 })

    const room = await db.query.rooms.findFirst({ where: eq(rooms.code, code.toUpperCase()) })
    if (!room) return NextResponse.json({ error: 'Sala no encontrada.' }, { status: 404 })
    if (room.status !== 'LOBBY') return NextResponse.json({ error: 'La sala no está en lobby.' }, { status: 409 })

    const updated = await db
      .update(roomParticipants)
      .set({ isReady: parsed.data.isReady, lastSeenAt: new Date(), updatedAt: new Date() })
      .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, user.id)))
      .returning({ isReady: roomParticipants.isReady })

    if (updated.length === 0) return NextResponse.json({ error: 'No sos participante de esta sala.' }, { status: 403 })

    return NextResponse.json({ isReady: updated[0].isReady })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error.' },
      { status: 500 },
    )
  }
}
