import 'server-only'

import type { DraftSessionState } from '@/features/draft/types'

type MemoryDraftRecord = {
  sessionToken: string
  draftState: DraftSessionState
  updatedAt: string
}

declare global {
  var __estaLocuraDraftMemoryStore: Map<string, MemoryDraftRecord> | undefined
}

const draftMemoryStore = globalThis.__estaLocuraDraftMemoryStore ?? new Map<string, MemoryDraftRecord>()

if (!globalThis.__estaLocuraDraftMemoryStore) {
  globalThis.__estaLocuraDraftMemoryStore = draftMemoryStore
}

export function getMemoryDraft(sessionToken: string) {
  return draftMemoryStore.get(sessionToken) ?? null
}

export function setMemoryDraft(sessionToken: string, draftState: DraftSessionState) {
  const nextRecord: MemoryDraftRecord = {
    sessionToken,
    draftState,
    updatedAt: new Date().toISOString(),
  }

  draftMemoryStore.set(sessionToken, nextRecord)
  return nextRecord
}

export function clearMemoryDraft(sessionToken: string) {
  draftMemoryStore.delete(sessionToken)
}
