import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'

import { getDb } from '@/lib/db/client'
import { getSessionTokenReadOnly } from '@/lib/draft/session-token'
import { draftedTeams, roomParticipants, rooms } from '@/lib/db/schema'
import { getUserBySession } from '@/lib/rooms/queries'

// POST /api/rooms/[code]/draft/finalize
// Marca el drafted_team del participante como COMPLETED y actualiza
// su draft_status en room_participants.
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
    if (room.status !== 'DRAFT') return NextResponse.json({ error: 'La sala no está en fase de draft.' }, { status: 409 })

    const userDraft = await db.query.draftedTeams.findFirst({
      where: and(
        eq(draftedTeams.userId, user.id),
        eq(draftedTeams.roomId, room.id),
      ),
      orderBy: (table, { desc }) => [desc(table.updatedAt)],
    })

    if (!userDraft) return NextResponse.json({ error: 'No tenés un draft en esta sala.' }, { status: 404 })

    // Idempotente: siempre sincronizamos drafted_team y room_participants. No hacemos
    // early-return si el drafted_team ya está COMPLETED, porque el guardado previo del
    // workbench puede haberlo marcado antes de que el participante quede COMPLETED.
    await db
      .update(draftedTeams)
      .set({ status: 'COMPLETED', updatedAt: new Date() })
      .where(eq(draftedTeams.id, userDraft.id))

    await db
      .update(roomParticipants)
      .set({ draftStatus: 'COMPLETED', lastSeenAt: new Date(), updatedAt: new Date() })
      .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, user.id)))

    return NextResponse.json({ finalized: true, draftedTeamId: userDraft.id })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al finalizar el draft.' },
      { status: 500 },
    )
  }
}
