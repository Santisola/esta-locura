import 'server-only'

import { and, eq } from 'drizzle-orm'

import type { DraftSessionState } from '@/features/draft/types'
import { getAllowedPositionsForSlot } from '@/features/draft/rules'
import { getDb } from '@/lib/db/client'
import { draftedTeamPlayers, draftedTeams, formations, players } from '@/lib/db/schema'

export async function validateDraftCompletion(draftState: DraftSessionState) {
  const db = getDb()
  const formation = await db.query.formations.findFirst({
    where: eq(formations.code, draftState.formationCode),
  })

  if (!formation) {
    throw new Error(`No existe la formacion ${draftState.formationCode}.`)
  }

  const requiredSlots = formation.slots.map((slot) => slot.code)
  const pickedSlots = Object.keys(draftState.picks)

  if (requiredSlots.length !== pickedSlots.length) {
    throw new Error('El equipo todavia no completo todos los slots de la formacion.')
  }

  for (const slotCode of requiredSlots) {
    const playerId = draftState.picks[slotCode]

    if (!playerId) {
      throw new Error(`Falta cubrir el slot ${slotCode}.`)
    }

    const player = await db.query.players.findFirst({
      where: eq(players.id, playerId),
    })

    if (!player) {
      throw new Error(`No existe el jugador asignado al slot ${slotCode}.`)
    }

    const allowedPositions = getAllowedPositionsForSlot(slotCode)
    const candidatePositions = [player.primaryPosition, ...player.secondaryPositions]

    if (!candidatePositions.some((position) => allowedPositions.includes(position))) {
      throw new Error(`${player.name} no encaja en el slot ${slotCode}.`)
    }
  }

  return formation
}

export async function markDraftAsCompleted(sessionToken: string, draftState: DraftSessionState) {
  const db = getDb()
  const user = await db.query.users.findFirst({
    where: (table, { eq: equal }) => equal(table.sessionToken, sessionToken),
  })

  if (!user) {
    throw new Error('No existe una sesion guest para finalizar el draft.')
  }

  const draft = await db.query.draftedTeams.findFirst({
    where: and(eq(draftedTeams.userId, user.id), eq(draftedTeams.status, 'BUILDING')),
    orderBy: (table, { desc }) => [desc(table.updatedAt)],
  })

  if (!draft) {
    throw new Error('No existe un draft en construccion para esta sesion.')
  }

  await db
    .update(draftedTeams)
    .set({
      status: 'COMPLETED',
      updatedAt: new Date(),
    })
    .where(eq(draftedTeams.id, draft.id))

  const picks = await db.query.draftedTeamPlayers.findMany({
    where: eq(draftedTeamPlayers.draftedTeamId, draft.id),
  })

  return {
    draftedTeamId: draft.id,
    picksCount: picks.length,
  }
}
