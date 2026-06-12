import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'

import { getDb } from '@/lib/db/client'
import { getSessionTokenReadOnly } from '@/lib/draft/session-token'
import { rooms } from '@/lib/db/schema'
import { getUserBySession } from '@/lib/rooms/queries'

// Índices de fase:
// -1: nada | 0: grupos
// 1: preview R32 | 2: resultados R32
// 3: preview R16 | 4: resultados R16
// 5: preview QF  | 6: resultados QF
// 7: preview SF  | 8: resultados SF
// 9: preview Final | 10: resultados Final → FINISHED
const MAX_STAGE_INDEX = 10

// POST /api/rooms/[code]/advance — solo host.
// Incrementa revealStageIndex en 1. Si llega a MAX_STAGE_INDEX → sala FINISHED.
// Idempotente: no avanza si ya está en el índice máximo.
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
    if (room.hostUserId !== user.id) return NextResponse.json({ error: 'Solo el host puede avanzar el torneo.' }, { status: 403 })
    if (room.status !== 'TOURNAMENT') return NextResponse.json({ error: 'La sala no está en fase de torneo.' }, { status: 409 })

    const currentIndex = room.revealStageIndex
    if (currentIndex >= MAX_STAGE_INDEX) {
      return NextResponse.json({ revealStageIndex: currentIndex, finished: true })
    }

    const nextIndex = currentIndex + 1
    const isFinished = nextIndex >= MAX_STAGE_INDEX

    await db
      .update(rooms)
      .set({
        revealStageIndex: nextIndex,
        revealUpdatedAt: new Date(),
        status: isFinished ? 'FINISHED' : 'TOURNAMENT',
        ...(isFinished ? { endedAt: new Date() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(rooms.id, room.id))

    return NextResponse.json({ revealStageIndex: nextIndex, finished: isFinished })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al avanzar el torneo.' },
      { status: 500 },
    )
  }
}
