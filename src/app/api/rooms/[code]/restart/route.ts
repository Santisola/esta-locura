import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'

import { getDb } from '@/lib/db/client'
import { getSessionTokenReadOnly } from '@/lib/draft/session-token'
import { draftedTeams, roomParticipants, rooms, tournaments } from '@/lib/db/schema'
import { getUserBySession } from '@/lib/rooms/queries'

// POST /api/rooms/[code]/restart — solo host.
// Reinicia la sala para jugar de nuevo: borra el torneo y los drafts, resetea el
// estado de los participantes y vuelve la sala a LOBBY. Todo en un batch atómico.
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
    if (room.hostUserId !== user.id) return NextResponse.json({ error: 'Solo el host puede reiniciar la sala.' }, { status: 403 })
    if (room.status !== 'TOURNAMENT' && room.status !== 'FINISHED') {
      return NextResponse.json({ error: 'La sala no está en un Mundial para reiniciar.' }, { status: 409 })
    }

    type BatchOp = Parameters<typeof db.batch>[0][number]
    const ops: [BatchOp, ...BatchOp[]] = [
      // Borrar torneo(s) de la sala — cascadea entries, matches, standings y events.
      db.delete(tournaments).where(eq(tournaments.roomId, room.id)),
      // Borrar drafts de la sala — cascadea drafted_team_players.
      db.delete(draftedTeams).where(eq(draftedTeams.roomId, room.id)),
      // Resetear participantes: vuelven a no-listos y sin draft.
      db
        .update(roomParticipants)
        .set({ draftStatus: 'WAITING', isReady: false, updatedAt: new Date() })
        .where(eq(roomParticipants.roomId, room.id)),
      // Volver la sala al lobby.
      db
        .update(rooms)
        .set({
          status: 'LOBBY',
          revealStageIndex: -1,
          revealUpdatedAt: null,
          startedAt: null,
          endedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(rooms.id, room.id)),
    ]

    await db.batch(ops)

    return NextResponse.json({ restarted: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al reiniciar la sala.' },
      { status: 500 },
    )
  }
}
