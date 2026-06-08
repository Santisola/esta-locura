import { NextResponse } from 'next/server'

import { validateDraftCompletion } from '@/lib/draft/finalize'
import { getOrCreateSessionToken } from '@/lib/draft/session-token'
import { createSingleplayerTournament } from '@/lib/tournaments/singleplayer'
import { loadDraftSnapshot, saveDraftSnapshot } from '@/lib/draft/persistence'

export async function POST() {
  try {
    const sessionToken = await getOrCreateSessionToken()
    const snapshot = await loadDraftSnapshot(sessionToken)

    if (!snapshot.draftState) {
      return NextResponse.json({ error: 'No hay draft cargado para esta sesion.' }, { status: 400 })
    }

    await validateDraftCompletion(snapshot.draftState)

    const completedDraftState = {
      ...snapshot.draftState,
      completedAt: snapshot.draftState.completedAt ?? new Date().toISOString(),
    }

    await saveDraftSnapshot(sessionToken, completedDraftState)
    const tournament = await createSingleplayerTournament(sessionToken)

    return NextResponse.json({
      draftCompleted: true,
      tournament,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'No se pudo iniciar el torneo singleplayer.',
      },
      { status: 400 }
    )
  }
}
