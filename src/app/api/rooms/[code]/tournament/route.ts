import { NextResponse } from 'next/server'

import { getSessionTokenReadOnly } from '@/lib/draft/session-token'
import { getRoomTournamentOverview } from '@/lib/tournaments/room-overview'
import { getUserBySession } from '@/lib/rooms/queries'

// GET /api/rooms/[code]/tournament
// Devuelve el overview del torneo clampado al revealStageIndex de la sala.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params
    const sessionToken = await getSessionTokenReadOnly()
    if (!sessionToken) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 })

    const user = await getUserBySession(sessionToken)
    if (!user) return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 })

    const overview = await getRoomTournamentOverview(code.toUpperCase(), user.id)
    if (!overview) return NextResponse.json({ error: 'Torneo no encontrado.' }, { status: 404 })

    return NextResponse.json(overview)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener el torneo.' },
      { status: 500 },
    )
  }
}
