import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'

import { getDb } from '@/lib/db/client'
import { getSessionTokenReadOnly } from '@/lib/draft/session-token'
import { roomParticipants, rooms } from '@/lib/db/schema'
import { getRoomState, getUserBySession } from '@/lib/rooms/queries'

// GET /api/rooms/[code]/state — polling endpoint.
// Actualiza lastSeenAt del participante y devuelve el estado completo de la sala.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params
    const sessionToken = await getSessionTokenReadOnly()

    if (!sessionToken) {
      return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 })
    }

    const db = getDb()
    const user = await getUserBySession(sessionToken)

    if (!user) {
      return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 })
    }

    const room = await db.query.rooms.findFirst({ where: eq(rooms.code, code.toUpperCase()) })

    if (!room) return NextResponse.json({ error: 'Sala no encontrada.' }, { status: 404 })

    // Actualizar heartbeat del participante.
    await db
      .update(roomParticipants)
      .set({ lastSeenAt: new Date(), updatedAt: new Date() })
      .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, user.id)))

    const state = await getRoomState(code.toUpperCase())

    if (!state) return NextResponse.json({ error: 'Sala no encontrada.' }, { status: 404 })

    const me = state.participants.find((p) => p.userId === user.id) ?? null

    return NextResponse.json({ state, me })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener estado de la sala.' },
      { status: 500 },
    )
  }
}
