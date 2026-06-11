import { describe, it, expect, beforeEach } from 'vitest'
import { getMemoryDraft, setMemoryDraft, clearMemoryDraft } from '@/lib/draft/memory'
import { makeDraftSessionState } from '../helpers/fixtures'

const TOKEN = 'test-session-token'
const TOKEN_2 = 'other-session-token'

beforeEach(() => {
  // Limpia el store global entre tests para evitar contaminación
  globalThis.__estaLocuraDraftMemoryStore = new Map()
})

describe('setMemoryDraft / getMemoryDraft', () => {
  it('guarda y recupera el mismo estado', () => {
    const state = makeDraftSessionState({ formationCode: '4-3-3', rerollsLeft: 2 })
    setMemoryDraft(TOKEN, state)

    const retrieved = getMemoryDraft(TOKEN)
    expect(retrieved).not.toBeNull()
    expect(retrieved!.draftState).toEqual(state)
    expect(retrieved!.sessionToken).toBe(TOKEN)
  })

  it('updatedAt es un ISO string válido', () => {
    setMemoryDraft(TOKEN, makeDraftSessionState())
    const record = getMemoryDraft(TOKEN)!
    expect(() => new Date(record.updatedAt)).not.toThrow()
    expect(new Date(record.updatedAt).getTime()).not.toBeNaN()
  })

  it('sobrescribe la entrada existente con el nuevo estado', () => {
    const state1 = makeDraftSessionState({ rerollsLeft: 3 })
    const state2 = makeDraftSessionState({ rerollsLeft: 1 })

    setMemoryDraft(TOKEN, state1)
    setMemoryDraft(TOKEN, state2)

    const retrieved = getMemoryDraft(TOKEN)
    expect(retrieved!.draftState.rerollsLeft).toBe(1)
  })

  it('sesiones distintas no se interfieren', () => {
    const stateA = makeDraftSessionState({ formationCode: '4-3-3' })
    const stateB = makeDraftSessionState({ formationCode: '4-4-2' })

    setMemoryDraft(TOKEN, stateA)
    setMemoryDraft(TOKEN_2, stateB)

    expect(getMemoryDraft(TOKEN)!.draftState.formationCode).toBe('4-3-3')
    expect(getMemoryDraft(TOKEN_2)!.draftState.formationCode).toBe('4-4-2')
  })
})

describe('getMemoryDraft', () => {
  it('devuelve null para un token sin guardar', () => {
    expect(getMemoryDraft('token-inexistente')).toBeNull()
  })
})

describe('clearMemoryDraft', () => {
  it('después de limpiar, getMemoryDraft devuelve null', () => {
    setMemoryDraft(TOKEN, makeDraftSessionState())
    clearMemoryDraft(TOKEN)
    expect(getMemoryDraft(TOKEN)).toBeNull()
  })

  it('limpiar un token no afecta a otros tokens', () => {
    setMemoryDraft(TOKEN, makeDraftSessionState())
    setMemoryDraft(TOKEN_2, makeDraftSessionState())

    clearMemoryDraft(TOKEN)

    expect(getMemoryDraft(TOKEN)).toBeNull()
    expect(getMemoryDraft(TOKEN_2)).not.toBeNull()
  })

  it('limpiar un token que no existe no lanza error', () => {
    expect(() => clearMemoryDraft('token-inexistente')).not.toThrow()
  })
})
