import { NextResponse } from 'next/server'
import { z } from 'zod'

import type { DraftSessionState } from '@/features/draft/types'
import { clearDraftSnapshot, loadDraftSnapshot, saveDraftSnapshot } from '@/lib/draft/persistence'
import { getOrCreateSessionToken } from '@/lib/draft/session-token'

const draftSessionStateSchema: z.ZodType<DraftSessionState> = z.object({
  formationCode: z.string().min(1),
  difficulty: z.enum(['CLASSIC', 'MEMORY']),
  rerollsLeft: z.number().int().min(0).max(3),
  currentCountrySlug: z.string().nullable(),
  usedCountrySlugs: z.array(z.string()),
  picks: z.record(z.string(), z.string()),
  usedPlayerIds: z.array(z.string()),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
})

const saveDraftSchema = z.object({
  draftState: draftSessionStateSchema,
})

export async function GET() {
  const sessionToken = await getOrCreateSessionToken()
  const snapshot = await loadDraftSnapshot(sessionToken)

  return NextResponse.json({
    sessionToken,
    ...snapshot,
  })
}

export async function POST(request: Request) {
  const sessionToken = await getOrCreateSessionToken()
  const body = await request.json()
  const parsed = saveDraftSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Payload de draft invalido.',
        issues: parsed.error.flatten(),
      },
      { status: 400 }
    )
  }

  const saved = await saveDraftSnapshot(sessionToken, parsed.data.draftState)

  return NextResponse.json({
    sessionToken,
    ...saved,
  })
}

export async function DELETE() {
  const sessionToken = await getOrCreateSessionToken()
  const cleared = await clearDraftSnapshot(sessionToken)

  return NextResponse.json({
    sessionToken,
    ...cleared,
  })
}
