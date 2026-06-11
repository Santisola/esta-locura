import { NextResponse } from 'next/server'

import { getDb, isDatabaseConfigured } from '@/lib/db/client'
import { getOrCreateSessionToken } from '@/lib/draft/session-token'
import { draftedTeams, tournamentEntries, tournaments, users } from '@/lib/db/schema'
import { simulateSingleplayerTournament } from '@/lib/tournaments/simulate'
import { and, eq } from 'drizzle-orm'

// Fallback para torneos creados antes de que la simulacion corriera en el mismo
// paso de creacion del torneo. Para torneos nuevos esto no se usa (ya vienen
// FINISHED). Mantiene el scope por usuario.
export async function POST() {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: 'Base de datos no configurada.' }, { status: 500 })
    }

    const db = getDb()
    const sessionToken = await getOrCreateSessionToken()

    const user = await db.query.users.findFirst({
      where: eq(users.sessionToken, sessionToken),
    })

    if (!user) {
      return NextResponse.json({ error: 'Sesion no encontrada.' }, { status: 401 })
    }

    const draft = await db.query.draftedTeams.findFirst({
      where: and(eq(draftedTeams.userId, user.id), eq(draftedTeams.status, 'COMPLETED')),
      orderBy: (table, { desc }) => [desc(table.updatedAt)],
    })

    if (!draft) {
      return NextResponse.json({ error: 'No hay un equipo draft completado.' }, { status: 404 })
    }

    const entryAnchor = await db.query.tournamentEntries.findFirst({
      where: eq(tournamentEntries.draftedTeamId, draft.id),
      columns: { tournamentId: true },
    })

    if (!entryAnchor) {
      return NextResponse.json({ error: 'No hay un torneo asociado a tu equipo.' }, { status: 404 })
    }

    const tournament = await db.query.tournaments.findFirst({
      where: and(
        eq(tournaments.id, entryAnchor.tournamentId),
        eq(tournaments.type, 'SINGLEPLAYER'),
        eq(tournaments.status, 'GROUP_STAGE'),
      ),
    })

    if (!tournament) {
      return NextResponse.json({ error: 'No hay un torneo activo en fase de grupos.' }, { status: 404 })
    }

    const { championId, humanEntryIds } = await simulateSingleplayerTournament(tournament.id)
    const humanEntryId = humanEntryIds[0] ?? null

    return NextResponse.json({ simulated: true, championId, humanEntryId })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error al simular el torneo.',
      },
      { status: 500 },
    )
  }
}
