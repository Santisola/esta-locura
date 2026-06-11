import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'

import { getDb } from '@/lib/db/client'
import { getSessionTokenReadOnly } from '@/lib/draft/session-token'
import { draftedTeams, roomParticipants, rooms, users } from '@/lib/db/schema'
import { getUserBySession } from '@/lib/rooms/queries'
import { createTournament, loadDraftedTeamRatings } from '@/lib/tournaments/create'

// POST /api/rooms/[code]/start-tournament — solo host.
// Cierra el draft, arma el Mundial compartido con los equipos completados y
// descarta (avisa) los drafts incompletos.
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
    if (room.hostUserId !== user.id) return NextResponse.json({ error: 'Solo el host puede iniciar el torneo.' }, { status: 403 })
    if (room.status !== 'DRAFT') return NextResponse.json({ error: 'La sala no está en fase de draft.' }, { status: 409 })

    // Cargar todos los drafts de la sala.
    const allDrafts = await db.query.draftedTeams.findMany({
      where: eq(draftedTeams.roomId, room.id),
    })

    const completedDrafts = allDrafts.filter((d) => d.status === 'COMPLETED')
    const incompleteDrafts = allDrafts.filter((d) => d.status !== 'COMPLETED')

    if (completedDrafts.length === 0) {
      return NextResponse.json({ error: 'Ningún jugador completó su draft.' }, { status: 409 })
    }

    // Resolver nickname de cada draft (snapshot del participante).
    const participants = await db.query.roomParticipants.findMany({
      where: eq(roomParticipants.roomId, room.id),
    })
    const nicknameByUserId = new Map(participants.map((p) => [p.userId, p.nicknameSnapshot]))

    // Cargar ratings de cada draft completado.
    const humans = await Promise.all(
      completedDrafts.map(async (draft) => {
        const ratings = await loadDraftedTeamRatings(draft.id)
        const nickname = nicknameByUserId.get(draft.userId) ?? draft.displayName
        return {
          draftedTeamId: draft.id,
          displayName: nickname,
          ratings,
        }
      }),
    )

    const result = await createTournament({
      type: 'MULTIPLAYER',
      roomId: room.id,
      humans,
      separateHumans: room.separateHumans,
      seedBase: room.id,
    })

    // Transición de estado: DRAFT → TOURNAMENT, revealStageIndex = -1.
    await db
      .update(rooms)
      .set({ status: 'TOURNAMENT', revealStageIndex: -1, updatedAt: new Date() })
      .where(eq(rooms.id, room.id))

    return NextResponse.json({
      tournamentId: result.tournamentId,
      humanCount: humans.length,
      discarded: incompleteDrafts.length,
      discardedNicknames: incompleteDrafts.map((d) => nicknameByUserId.get(d.userId) ?? d.displayName),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al iniciar el torneo.' },
      { status: 500 },
    )
  }
}
