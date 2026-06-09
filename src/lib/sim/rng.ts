export function createSeed(value: string): number {
  let hash = 0
  for (const char of value) {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0
  }
  return Math.abs(hash)
}

export function createRng(seed: number): () => number {
  let state = seed % 2147483647
  if (state <= 0) state += 2147483646

  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}

export function simulatePoisson(lambda: number, rng: () => number): number {
  const L = Math.exp(-lambda)
  let k = 0
  let p = 1

  do {
    k++
    p *= rng()
  } while (p > L)

  return k - 1
}

export function pickRandomShirtNumber(rng: () => number): number {
  return Math.floor(rng() * 30) + 1
}
