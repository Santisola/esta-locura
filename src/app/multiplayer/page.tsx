'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function MultiplayerPage() {
  const router = useRouter()
  const [nickname, setNickname] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [mode, setMode] = useState<'CLASSIC' | 'MEMORY'>('CLASSIC')
  const [separateHumans, setSeparateHumans] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    if (!nickname.trim()) {
      setError('Ingresá tu nombre primero.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickname.trim(), difficultyMode: mode, separateHumans }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al crear la sala.')
      router.push(`/sala/${data.code}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado.')
      setLoading(false)
    }
  }

  async function handleJoin() {
    if (!nickname.trim()) {
      setError('Ingresá tu nombre primero.')
      return
    }
    if (!joinCode.trim()) {
      setError('Ingresá el código de la sala.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const code = joinCode.trim().toUpperCase()
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickname.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudo unir a la sala.')
      router.push(`/sala/${code}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado.')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto w-full max-w-md px-5 py-10 sm:px-8">
        {/* Header */}
        <header className="flex items-center justify-between border-b-2 border-ink/80 pb-5">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-xl border-2 border-ink bg-gradient-to-br from-celeste to-violeta shadow-hardsm">
              <img src="/worldcup.svg" alt="EL" className="h-9 w-9" />
            </span>
            <div>
              <p className="font-slab text-2xl leading-none tracking-wide text-ink">
                ESTA <span className="bg-gradient-to-r from-celeste to-violeta bg-clip-text text-transparent">LOCURA</span>
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.3em] text-ink2">Multijugador</p>
            </div>
          </Link>
        </header>

        <p className="mt-6 text-base leading-7 text-ink2">
          Jugá con amigos. Cada uno arma su equipo. Compiten en el mismo Mundial y solo uno sale campeón.
        </p>

        {/* Nickname */}
        <div className="mt-6 space-y-2">
          <label className="block font-mono text-[11px] uppercase tracking-[0.24em] text-ink2">
            Tu nombre en la sala
          </label>
          <input
            type="text"
            maxLength={32}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="ej. Santi"
            className="w-full rounded-xl border-2 border-ink bg-bone px-4 py-3 text-sm text-ink placeholder:text-ink2/40 shadow-hardsm outline-none focus:border-violeta"
          />
        </div>

        {/* Crear sala */}
        <div className="mt-5 space-y-3 rounded-2xl border-2 border-ink bg-bone p-5 shadow-hardsm">
          <h2 className="font-slab text-lg uppercase tracking-wide text-ink">Crear sala</h2>

          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink2">Modo · Dificultad</p>
          <div className="flex gap-2">
            {(['CLASSIC', 'MEMORY'] as const).map((m) => {
              const active = mode === m
              return (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 rounded-lg border-2 px-3 py-2.5 text-center font-mono text-xs uppercase tracking-[0.12em] transition ${
                    active ? 'border-ink bg-ink text-paper' : 'border-line bg-paper2 text-ink hover:border-ink/50'
                  }`}
                >
                  {m === 'CLASSIC' ? 'Clásico' : 'De memoria'}
                </button>
              )
            })}
          </div>

          {/* Separación de humanos */}
          <button
            type="button"
            onClick={() => setSeparateHumans((v) => !v)}
            className={`flex w-full items-center justify-between gap-3 rounded-lg border-2 px-4 py-3 text-left transition ${
              separateHumans ? 'border-ink bg-paper2' : 'border-line bg-paper2'
            }`}
          >
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink">
                {separateHumans ? 'Grupos separados' : 'Grupos libres'}
              </p>
              <p className="mt-0.5 text-[11px] leading-4 text-ink2">
                {separateHumans
                  ? 'Cada jugador en un grupo distinto — solo se cruzan en mata-mata'
                  : 'Los jugadores pueden caer en el mismo grupo'}
              </p>
            </div>
            <span
              className={`flex h-6 w-10 shrink-0 items-center rounded-full border-2 transition-colors ${
                separateHumans ? 'border-ink bg-gradient-to-r from-celeste to-violeta' : 'border-line bg-bone'
              }`}
            >
              <span
                className={`mx-0.5 h-4 w-4 rounded-full transition-transform ${
                  separateHumans ? 'translate-x-4 bg-white' : 'translate-x-0 bg-ink/30'
                }`}
              />
            </span>
          </button>

          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full rounded-xl border-2 border-ink bg-gradient-to-r from-celeste to-violeta px-5 py-3.5 font-slab text-lg uppercase tracking-wide text-white shadow-hardsm transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? 'Creando…' : 'Crear sala'}
          </button>
        </div>

        {/* Unirse */}
        <div className="mt-5 space-y-3 rounded-2xl border-2 border-ink bg-bone p-5 shadow-hardsm">
          <h2 className="font-slab text-lg uppercase tracking-wide text-ink">Unirse con código</h2>
          <input
            type="text"
            maxLength={6}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            className="w-full rounded-xl border-2 border-ink bg-paper2 px-4 py-3 text-center font-mono text-xl uppercase tracking-[0.3em] text-ink placeholder:text-ink2/30 outline-none focus:border-violeta"
          />
          <button
            onClick={handleJoin}
            disabled={loading}
            className="w-full rounded-xl border-2 border-ink bg-bone px-5 py-3.5 font-slab text-lg uppercase tracking-wide text-ink shadow-hardsm transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? 'Uniéndose…' : 'Unirse'}
          </button>
        </div>

        {error && <p className="mt-5 text-center text-sm font-semibold text-vermillion">{error}</p>}

        <div className="mt-8 text-center">
          <Link href="/" className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink2 underline-offset-2 hover:underline">
            ← Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  )
}
