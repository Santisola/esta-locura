import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'

import { getDb } from '@/lib/db/client'
import { getSessionTokenReadOnly } from '@/lib/draft/session-token'
import { roomParticipants, rooms } from '@/lib/db/schema'
import { getUserBySession } from '@/lib/rooms/queries'

const MIN_PLAYERS = 2

// POST /api/rooms/[code]/start-draft — solo host.
// Requisitos: sala en LOBBY, ≥MIN_PLAYERS participantes, todos listos.
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
    if (room.hostUserId !== user.id) return NextResponse.json({ error: 'Solo el host puede iniciar el draft.' }, { status: 403 })
    if (room.status !== 'LOBBY') return NextResponse.json({ error: 'La sala no está en lobby.' }, { status: 409 })

    const participants = await db.query.roomParticipants.findMany({
      where: eq(roomParticipants.roomId, room.id),
    })

    if (participants.length < MIN_PLAYERS) {
      return NextResponse.json({ error: `Se necesitan al menos ${MIN_PLAYERS} jugadores para arrancar.` }, { status: 409 })
    }

    const notReady = participants.filter((p) => !p.isReady && p.userId !== user.id)
    if (notReady.length > 0) {
      return NextResponse.json(
        { error: 'No todos los jugadores están listos.', pending: notReady.map((p) => p.nicknameSnapshot) },
        { status: 409 },
      )
    }

    await db
      .update(rooms)
      .set({ status: 'DRAFT', startedAt: new Date(), updatedAt: new Date() })
      .where(eq(rooms.id, room.id))

    // Marcar todos como CHOOSING.
    await db
      .update(roomParticipants)
      .set({ draftStatus: 'CHOOSING', updatedAt: new Date() })
      .where(eq(roomParticipants.roomId, room.id))

    return NextResponse.json({ started: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al iniciar el draft.' },
      { status: 500 },
    )
  }
}
