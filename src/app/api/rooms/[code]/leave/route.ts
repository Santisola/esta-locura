import { NextResponse } from 'next/server'
import { and, eq, ne } from 'drizzle-orm'

import { getDb } from '@/lib/db/client'
import { getSessionTokenReadOnly } from '@/lib/draft/session-token'
import { roomParticipants, rooms } from '@/lib/db/schema'
import { getUserBySession } from '@/lib/rooms/queries'

// POST /api/rooms/[code]/leave
// Si era host → migra al siguiente participante online.
// Si quedó vacía → cancela la sala.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params
    const sessionToken = await getSessionTokenReadOnly()
    if (!sessionToken) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 })

    const db = getDb()
    const user = await getUserBySession(sessionToken)
    if (!user) return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 })

    const room = await db.query.rooms.findFirst({ where: eq(rooms.code, code.toUpperCase()) })
    if (!room) return NextResponse.json({ error: 'Sala no encontrada.' }, { status: 404 })

    const participant = await db.query.roomParticipants.findFirst({
      where: and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, user.id)),
    })
    if (!participant) return NextResponse.json({ error: 'No sos participante de esta sala.' }, { status: 403 })

    const wasHost = participant.isHost

    await db
      .delete(roomParticipants)
      .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, user.id)))

    const remaining = await db.query.roomParticipants.findMany({
      where: eq(roomParticipants.roomId, room.id),
      orderBy: (table, { asc }) => [asc(table.joinedAt)],
    })

    if (remaining.length === 0) {
      await db.update(rooms).set({ status: 'CANCELLED', updatedAt: new Date() }).where(eq(rooms.id, room.id))
      return NextResponse.json({ left: true, roomCancelled: true })
    }

    if (wasHost) {
      const newHost = remaining[0]
      await db
        .update(roomParticipants)
        .set({ isHost: true, updatedAt: new Date() })
        .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, newHost.userId)))
      await db
        .update(rooms)
        .set({ hostUserId: newHost.userId, updatedAt: new Date() })
        .where(eq(rooms.id, room.id))
    }

    return NextResponse.json({ left: true, roomCancelled: false })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error.' },
      { status: 500 },
    )
  }
}
