import 'server-only'

import { and, eq, inArray } from 'drizzle-orm'

import { getDb } from '@/lib/db/client'
import { draftedTeams, tournamentEntries, tournaments, users } from '@/lib/db/schema'
import { createTournament, loadDraftedTeamRatings } from '@/lib/tournaments/create'

export async function createSingleplayerTournament(sessionToken: string) {
  const db = getDb()

  const user = await db.query.users.findFirst({
    where: eq(users.sessionToken, sessionToken),
  })

  if (!user) throw new Error('No existe una sesion valida para crear el torneo.')

  const draftedTeam = await db.query.draftedTeams.findFirst({
    where: and(eq(draftedTeams.userId, user.id), eq(draftedTeams.status, 'COMPLETED')),
    orderBy: (table, { desc }) => [desc(table.updatedAt)],
  })

  if (!draftedTeam) throw new Error('No existe un equipo draft completado para iniciar el torneo.')

  // Limpia SOLO los torneos singleplayer previos de este usuario.
  const userDraftedTeams = await db
    .select({ id: draftedTeams.id })
    .from(draftedTeams)
    .where(eq(draftedTeams.userId, user.id))

  const userDraftedTeamIds = userDraftedTeams.map((t) => t.id)

  if (userDraftedTeamIds.length > 0) {
    const priorEntries = await db
      .select({ tournamentId: tournamentEntries.tournamentId })
      .from(tournamentEntries)
      .where(inArray(tournamentEntries.draftedTeamId, userDraftedTeamIds))

    const priorTournamentIds = [...new Set(priorEntries.map((e) => e.tournamentId))]

    if (priorTournamentIds.length > 0) {
      await db
        .delete(tournaments)
        .where(
          and(eq(tournaments.type, 'SINGLEPLAYER'), inArray(tournaments.id, priorTournamentIds)),
        )
    }
  }

  const ratings = await loadDraftedTeamRatings(draftedTeam.id)

  const result = await createTournament({
    type: 'SINGLEPLAYER',
    humans: [
      {
        draftedTeamId: draftedTeam.id,
        displayName: 'Mi Selección',
        ratings,
      },
    ],
    separateHumans: false,
    seedBase: draftedTeam.id,
  })

  return {
    tournamentId: result.tournamentId,
    reused: false,
    groups: result.groups,
  }
}
