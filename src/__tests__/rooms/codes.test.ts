import { describe, it, expect } from 'vitest'
import { generateRoomCode } from '@/lib/rooms/codes'

const ALLOWED_CHARS = new Set('ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.split(''))

describe('generateRoomCode', () => {
  it('siempre devuelve exactamente 6 caracteres', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateRoomCode()).toHaveLength(6)
    }
  })

  it('solo usa caracteres del alfabeto permitido (sin O, 0, I, 1)', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateRoomCode()
      for (const char of code) {
        expect(ALLOWED_CHARS.has(char)).toBe(true)
      }
    }
  })

  it('no contiene los caracteres confundibles O, 0, I, 1', () => {
    const FORBIDDEN = new Set(['O', '0', 'I', '1'])
    for (let i = 0; i < 100; i++) {
      const code = generateRoomCode()
      for (const char of code) {
        expect(FORBIDDEN.has(char)).toBe(false)
      }
    }
  })

  it('100 códigos generados son todos distintos', () => {
    const codes = Array.from({ length: 100 }, () => generateRoomCode())
    const unique = new Set(codes)
    expect(unique.size).toBe(100)
  })

  it('devuelve solo mayúsculas', () => {
    for (let i = 0; i < 20; i++) {
      const code = generateRoomCode()
      expect(code).toBe(code.toUpperCase())
    }
  })
})
