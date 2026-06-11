import { describe, it, expect } from 'vitest'
import {
  getAllowedPositionsForSlot,
  getCompatibleSlots,
  isDraftComplete,
} from '@/features/draft/rules'
import type { DraftPlayer } from '@/features/draft/types'

function makePlayer(primaryPosition: string, secondaryPositions: string[] = []): DraftPlayer {
  return {
    id: 'p1',
    country: 'Argentina',
    countrySlug: 'argentina',
    name: 'Test Player',
    slug: 'test-player',
    listedPositionGroup: 'FWD',
    primaryPosition,
    secondaryPositions,
    birthDate: null,
    club: null,
    attack: 75,
    midfield: 75,
    defense: 75,
    goalkeeping: 75,
    ovr: 75,
    isDataReady: true,
    lockReason: null,
    enrichmentStatus: 'matched',
  }
}

describe('getAllowedPositionsForSlot', () => {
  it('GK solo acepta GK', () => {
    expect(getAllowedPositionsForSlot('GK')).toEqual(['GK'])
  })

  it('LB acepta LB, LWB, CB', () => {
    expect(getAllowedPositionsForSlot('LB')).toEqual(expect.arrayContaining(['LB', 'LWB', 'CB']))
    expect(getAllowedPositionsForSlot('LB')).toHaveLength(3)
  })

  it('RB acepta RB, RWB, CB', () => {
    expect(getAllowedPositionsForSlot('RB')).toEqual(expect.arrayContaining(['RB', 'RWB', 'CB']))
  })

  it('CB1 y CB2 aceptan CB, SW', () => {
    expect(getAllowedPositionsForSlot('CB1')).toEqual(expect.arrayContaining(['CB', 'SW']))
    expect(getAllowedPositionsForSlot('CB2')).toEqual(expect.arrayContaining(['CB', 'SW']))
  })

  it('LM acepta LM, LW, CM, CAM', () => {
    const allowed = getAllowedPositionsForSlot('LM')
    expect(allowed).toEqual(expect.arrayContaining(['LM', 'LW', 'CM', 'CAM']))
  })

  it('RM acepta RM, RW, CM, CAM', () => {
    const allowed = getAllowedPositionsForSlot('RM')
    expect(allowed).toEqual(expect.arrayContaining(['RM', 'RW', 'CM', 'CAM']))
  })

  it('CM1 acepta CM, CDM, CAM', () => {
    expect(getAllowedPositionsForSlot('CM1')).toEqual(expect.arrayContaining(['CM', 'CDM', 'CAM']))
  })

  it('CDM acepta CDM, CM', () => {
    expect(getAllowedPositionsForSlot('CDM')).toEqual(expect.arrayContaining(['CDM', 'CM']))
  })

  it('CAM acepta CAM, CM, CF', () => {
    expect(getAllowedPositionsForSlot('CAM')).toEqual(expect.arrayContaining(['CAM', 'CM', 'CF']))
  })

  it('LW acepta LW, LF, ST, LM', () => {
    expect(getAllowedPositionsForSlot('LW')).toEqual(expect.arrayContaining(['LW', 'LF', 'ST', 'LM']))
  })

  it('RW acepta RW, RF, ST, RM', () => {
    expect(getAllowedPositionsForSlot('RW')).toEqual(expect.arrayContaining(['RW', 'RF', 'ST', 'RM']))
  })

  it('ST1 y ST2 aceptan ST, CF, LF, RF', () => {
    expect(getAllowedPositionsForSlot('ST1')).toEqual(expect.arrayContaining(['ST', 'CF', 'LF', 'RF']))
    expect(getAllowedPositionsForSlot('ST2')).toEqual(expect.arrayContaining(['ST', 'CF', 'LF', 'RF']))
  })

  it('slot desconocido devuelve el fallback', () => {
    const fallback = getAllowedPositionsForSlot('UNKNOWN')
    expect(Array.isArray(fallback)).toBe(true)
    expect(fallback.length).toBeGreaterThan(0)
  })
})

describe('getCompatibleSlots', () => {
  it('ST en [GK, CB1, ST1] → solo ST1', () => {
    const player = makePlayer('ST')
    expect(getCompatibleSlots(player, ['GK', 'CB1', 'ST1'])).toEqual(['ST1'])
  })

  it('GK en [GK, CB1, ST1] → solo GK', () => {
    const player = makePlayer('GK')
    expect(getCompatibleSlots(player, ['GK', 'CB1', 'ST1'])).toEqual(['GK'])
  })

  it('CM (primaria) en [LM, RM] → ambos slots (CM está en los permitidos de LM y RM)', () => {
    const player = makePlayer('CM')
    const compatible = getCompatibleSlots(player, ['LM', 'RM'])
    expect(compatible).toContain('LM')
    expect(compatible).toContain('RM')
  })

  it('LW (primaria) en [LW, RW] → solo LW', () => {
    const player = makePlayer('LW')
    const compatible = getCompatibleSlots(player, ['LW', 'RW'])
    expect(compatible).toContain('LW')
    expect(compatible).not.toContain('RW')
  })

  it('jugador sin compatibilidad → []', () => {
    const player = makePlayer('GK')
    expect(getCompatibleSlots(player, ['ST1', 'CB1', 'LM'])).toEqual([])
  })

  it('posición secundaria permite encajar en un slot', () => {
    const player = makePlayer('LW', ['ST']) // primaria LW, secundaria ST
    const compatible = getCompatibleSlots(player, ['ST1', 'RW'])
    expect(compatible).toContain('ST1')
    expect(compatible).toContain('RW') // ST también está en RW
  })

  it('sin slots abiertos → []', () => {
    const player = makePlayer('ST')
    expect(getCompatibleSlots(player, [])).toEqual([])
  })
})

describe('isDraftComplete', () => {
  it('todos los slots llenados → true', () => {
    const slots = ['GK', 'CB1', 'ST1']
    const picks: Record<string, string> = { GK: 'p1', CB1: 'p2', ST1: 'p3' }
    expect(isDraftComplete(slots, picks)).toBe(true)
  })

  it('un slot sin cubrir → false', () => {
    const slots = ['GK', 'CB1', 'ST1']
    const picks: Record<string, string> = { GK: 'p1', CB1: 'p2' }
    expect(isDraftComplete(slots, picks)).toBe(false)
  })

  it('picks vacío con slots requeridos → false', () => {
    expect(isDraftComplete(['GK', 'ST1'], {})).toBe(false)
  })

  it('slots requeridos vacío → true (vacuously)', () => {
    expect(isDraftComplete([], { GK: 'p1' })).toBe(true)
  })

  it('slot presente pero con string vacía → false', () => {
    const slots = ['GK']
    const picks: Record<string, string> = { GK: '' }
    expect(isDraftComplete(slots, picks)).toBe(false)
  })
})
