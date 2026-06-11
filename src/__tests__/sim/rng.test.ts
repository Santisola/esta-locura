import { describe, it, expect } from 'vitest'
import { createSeed, createRng, simulatePoisson } from '@/lib/sim/rng'

describe('createSeed', () => {
  it('misma string produce el mismo número', () => {
    expect(createSeed('abc')).toBe(createSeed('abc'))
  })

  it('strings distintas producen números distintos', () => {
    expect(createSeed('abc')).not.toBe(createSeed('xyz'))
    expect(createSeed('torneo-1')).not.toBe(createSeed('torneo-2'))
  })

  it('siempre devuelve un número no negativo', () => {
    const seeds = ['', 'a', 'Mundial 2026', '!@#$%', '0'.repeat(100)]
    for (const s of seeds) {
      expect(createSeed(s)).toBeGreaterThanOrEqual(0)
    }
  })

  it('string vacía produce un número consistente', () => {
    expect(createSeed('')).toBe(createSeed(''))
  })
})

describe('createRng', () => {
  it('misma seed produce exactamente la misma secuencia', () => {
    const rng1 = createRng(42)
    const rng2 = createRng(42)
    for (let i = 0; i < 20; i++) {
      expect(rng1()).toBe(rng2())
    }
  })

  it('seeds distintas producen secuencias distintas', () => {
    const rng1 = createRng(1)
    const rng2 = createRng(2)
    const vals1 = Array.from({ length: 10 }, () => rng1())
    const vals2 = Array.from({ length: 10 }, () => rng2())
    expect(vals1).not.toEqual(vals2)
  })

  it('todos los valores están en [0, 1)', () => {
    const rng = createRng(999)
    for (let i = 0; i < 100; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('seed 0 o negativa no rompe el generador', () => {
    expect(() => {
      const rng = createRng(0)
      for (let i = 0; i < 10; i++) rng()
    }).not.toThrow()

    expect(() => {
      const rng = createRng(-999)
      for (let i = 0; i < 10; i++) rng()
    }).not.toThrow()
  })
})

describe('simulatePoisson', () => {
  it('siempre devuelve un entero no negativo', () => {
    const rng = createRng(7)
    for (let i = 0; i < 100; i++) {
      const v = simulatePoisson(1.5, rng)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(0)
    }
  })

  it('lambda muy pequeño produce casi siempre 0', () => {
    const rng = createRng(1)
    const results = Array.from({ length: 200 }, () => simulatePoisson(0.05, rng))
    const zeros = results.filter((v) => v === 0).length
    // Con lambda 0.05, P(X=0) = e^-0.05 ≈ 95%
    expect(zeros).toBeGreaterThan(150)
  })

  it('media muestral se aproxima a lambda', () => {
    const rng = createRng(42)
    const lambda = 2.5
    const n = 5000
    const results = Array.from({ length: n }, () => simulatePoisson(lambda, rng))
    const mean = results.reduce((a, b) => a + b, 0) / n
    // Tolerancia: ±0.15
    expect(mean).toBeGreaterThan(lambda - 0.15)
    expect(mean).toBeLessThan(lambda + 0.15)
  })
})
