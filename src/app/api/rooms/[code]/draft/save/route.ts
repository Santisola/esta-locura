import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import { loadDraftSnapshot, saveDraftSnapshot } from '@/lib/draft/persistence'
import { getDb } from '@/lib/db/client'
import { getOrCreateSessionToken, getSessionTokenReadOnly } from '@/lib/draft/session-token'
import { rooms } from '@/lib/db/schema'
import type { DraftSessionState } from '@/features/draft/types'

async function resolveRoom(code: string) {
  const db = getDb()
  return db.query.rooms.findFirst({ where: eq(rooms.code, code.toUpperCase()) })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params
  const sessionToken = await getSessionTokenReadOnly()

  const room = await resolveRoom(code)
  if (!room) return NextResponse.json({ error: 'Room not found.' }, { status: 404 })

  // Sin sesión todavía no hay draft que cargar: devolvemos un snapshot vacío.
  if (!sessionToken) {
    return NextResponse.json({ draftState: null, persistenceMode: 'remote', lastSavedAt: null })
  }

  const snapshot = await loadDraftSnapshot(sessionToken, room.id)
  return NextResponse.json(snapshot)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params
  const sessionToken = await getOrCreateSessionToken()

  const room = await resolveRoom(code)
  if (!room) return NextResponse.json({ error: 'Room not found.' }, { status: 404 })

  const body = await req.json() as { draftState?: DraftSessionState }
  if (!body.draftState) return NextResponse.json({ error: 'Missing draftState.' }, { status: 400 })

  const result = await saveDraftSnapshot(sessionToken, body.draftState, room.id)
  return NextResponse.json(result)
}
