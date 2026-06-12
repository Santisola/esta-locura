'use client'

import { useEffect } from 'react'
import confetti from 'canvas-confetti'

const GOLD = ['#FFD700', '#FFC200', '#F5A623', '#FFE066', '#FFBA00', '#D4A017']

export function GoldenConfetti() {
  useEffect(() => {
    const burst = (origin: { x: number; y: number }, spread: number) =>
      confetti({
        particleCount: 60,
        angle: 270,
        spread,
        origin,
        colors: GOLD,
        gravity: 0.9,
        scalar: 1.1,
        ticks: 200,
        drift: 0,
      })

    // Ráfaga inicial — tres puntos desde arriba
    burst({ x: 0.2, y: 0 }, 60)
    burst({ x: 0.5, y: 0 }, 80)
    burst({ x: 0.8, y: 0 }, 60)

    // Segunda oleada 600ms después
    const t1 = setTimeout(() => {
      burst({ x: 0.35, y: 0 }, 70)
      burst({ x: 0.65, y: 0 }, 70)
    }, 600)

    // Tercera oleada 1200ms después
    const t2 = setTimeout(() => {
      burst({ x: 0.5, y: 0 }, 100)
    }, 1200)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  return null
}
