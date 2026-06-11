import 'server-only'

import { and, eq, isNull } from 'drizzle-orm'

import type { DraftSessionState } from '@/features/draft/types'
import { getDb, isDatabaseConfigured } from '@/lib/db/client'
import { draftedTeamPlayers, draftedTeams, players, users } from '@/lib/db/schema'
import { clearMemoryDraft, getMemoryDraft, setMemoryDraft } from '@/lib/draft/memory'

type PersistedDraftSnapshot = {
  draftState: DraftSessionState | null
  persistenceMode: 'remote' | 'local-fallback'
  lastSavedAt: string | null
}

function serializeDraftState(state: DraftSessionState) {
  return JSON.stringify(state)
}

function parseDraftState(rawState: string | null): DraftSessionState | null {
  if (!rawState) {
    return null
  }

  try {
    return JSON.parse(rawState) as DraftSessionState
  } catch {
    return null
  }
}

async function ensureGuestUser(sessionToken: string) {
  const db = getDb()
  const existing = await db.query.users.findFirst({
    where: eq(users.sessionToken, sessionToken),
  })

  if (existing) {
    return existing
  }

  const [createdUser] = await db
    .insert(users)
    .values({
      nickname: `Invitado ${sessionToken.slice(0, 6)}`,
      sessionToken,
    })
    .returning()

  return createdUser
}

async function syncDraftedTeamPlayers(draftedTeamId: string, draftState: DraftSessionState) {
  const db = getDb()

  await db.delete(draftedTeamPlayers).where(eq(draftedTeamPlayers.draftedTeamId, draftedTeamId))

  const picks = Object.entries(draftState.picks)

  if (picks.length === 0) {
    return
  }

  const insertedRows = []

  for (const [slotCode, playerId] of picks) {
    const player = await db.query.players.findFirst({
      where: eq(players.id, playerId),
    })

    if (!player) {
      continue
    }

    insertedRows.push({
      draftedTeamId,
      playerId: player.id,
      slotCode,
      sourceNationalTeamId: player.nationalTeamId,
      pickedAt: new Date(),
    })
  }

  if (insertedRows.length > 0) {
    await db.insert(draftedTeamPlayers).values(insertedRows)
  }
}

export async function loadDraftSnapshot(sessionToken: string, roomId?: string): Promise<PersistedDraftSnapshot> {
  if (!isDatabaseConfigured()) {
    const memoryDraft = getMemoryDraft(sessionToken)

    return {
      draftState: memoryDraft?.draftState ?? null,
      persistenceMode: 'local-fallback',
      lastSavedAt: memoryDraft?.updatedAt ?? null,
    }
  }

  try {
    const user = await ensureGuestUser(sessionToken)
    const db = getDb()
    const whereClause = roomId
      ? and(eq(draftedTeams.userId, user.id), eq(draftedTeams.roomId, roomId))
      : and(eq(draftedTeams.userId, user.id), isNull(draftedTeams.roomId))
    const existingDraft = await db.query.draftedTeams.findFirst({
      where: whereClause,
      orderBy: (table, { desc }) => [desc(table.updatedAt)],
    })

    return {
      draftState: parseDraftState(existingDraft?.displayName ?? null),
      persistenceMode: 'remote',
      lastSavedAt: existingDraft?.updatedAt?.toISOString?.() ?? null,
    }
  } catch {
    const memoryDraft = getMemoryDraft(sessionToken)

    return {
      draftState: memoryDraft?.draftState ?? null,
      persistenceMode: 'local-fallback',
      lastSavedAt: memoryDraft?.updatedAt ?? null,
    }
  }
}

export async function saveDraftSnapshot(sessionToken: string, draftState: DraftSessionState, roomId?: string) {
  if (!isDatabaseConfigured()) {
    const stored = setMemoryDraft(sessionToken, draftState)

    return {
      persistenceMode: 'local-fallback' as const,
      lastSavedAt: stored.updatedAt,
    }
  }

  try {
    const db = getDb()
    const user = await ensureGuestUser(sessionToken)
    const formation = await db.query.formations.findFirst({
      where: (table, { eq: equal }) => equal(table.code, draftState.formationCode),
    })

    if (!formation) {
      throw new Error(`No existe la formacion ${draftState.formationCode} en la base.`)
    }

    const whereClause = roomId
      ? and(eq(draftedTeams.userId, user.id), eq(draftedTeams.roomId, roomId))
      : and(eq(draftedTeams.userId, user.id), isNull(draftedTeams.roomId))
    const existingDraft = await db.query.draftedTeams.findFirst({
      where: whereClause,
      orderBy: (table, { desc }) => [desc(table.updatedAt)],
    })

    const payload = {
      formationId: formation.id,
      difficultyMode: draftState.difficulty,
      rerollsLeft: draftState.rerollsLeft,
      status: draftState.completedAt ? ('COMPLETED' as const) : ('BUILDING' as const),
      displayName: serializeDraftState(draftState),
      updatedAt: new Date(),
    }

    if (!existingDraft) {
      const [created] = await db
        .insert(draftedTeams)
        .values({
          userId: user.id,
          roomId: roomId ?? null,
          ...payload,
          createdAt: new Date(),
        })
        .returning()

      await syncDraftedTeamPlayers(created.id, draftState)

      return {
        persistenceMode: 'remote' as const,
        lastSavedAt: created.updatedAt.toISOString(),
      }
    }

    const [updated] = await db
      .update(draftedTeams)
      .set(payload)
      .where(eq(draftedTeams.id, existingDraft.id))
      .returning()

    await syncDraftedTeamPlayers(updated.id, draftState)

    return {
      persistenceMode: 'remote' as const,
      lastSavedAt: updated.updatedAt.toISOString(),
    }
  } catch {
    const stored = setMemoryDraft(sessionToken, draftState)

    return {
      persistenceMode: 'local-fallback' as const,
      lastSavedAt: stored.updatedAt,
    }
  }
}

export async function clearDraftSnapshot(sessionToken: string) {
  if (!isDatabaseConfigured()) {
    clearMemoryDraft(sessionToken)
    return { persistenceMode: 'local-fallback' as const }
  }

  try {
    const db = getDb()
    const user = await db.query.users.findFirst({
      where: eq(users.sessionToken, sessionToken),
    })

    if (!user) {
      return { persistenceMode: 'remote' as const }
    }

    await db.delete(draftedTeams).where(eq(draftedTeams.userId, user.id))
    return { persistenceMode: 'remote' as const }
  } catch {
    clearMemoryDraft(sessionToken)
    return { persistenceMode: 'local-fallback' as const }
  }
}
