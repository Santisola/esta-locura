'use client'

import { useState } from 'react'

export function JoinRoomClient({ code }: { code: string }) {
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function join(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = nickname.trim()
    if (!trimmed) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: trimmed }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) {
        setError(data.error ?? 'No se pudo unir a la sala.')
        return
      }
      window.location.href = `/sala/${code}`
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-paper text-ink flex items-center justify-center px-5">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center">
          <div className="inline-flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-xl border-2 border-ink bg-gradient-to-br from-celeste to-violeta shadow-hardsm">
              <img src="/worldcup.svg" alt="EL" className="h-9 w-9" />
            </span>
            <p className="font-slab text-2xl leading-none tracking-wide text-ink">
              ESTA <span className="bg-gradient-to-r from-celeste to-violeta bg-clip-text text-transparent">LOCURA</span>
            </p>
          </div>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.24em] text-ink2">
            Te invitaron a la sala
          </p>
          <p className="mt-1 font-slab text-3xl tracking-[0.18em] text-ink">{code}</p>
        </div>

        {/* Form */}
        <form onSubmit={join} className="rounded-2xl border-2 border-ink bg-bone p-5 shadow-hardsm space-y-4">
          <div className="space-y-2">
            <label className="block font-mono text-[11px] uppercase tracking-[0.24em] text-ink2">
              Tu apodo
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Ej: El Flaco, Maradona 2.0…"
              maxLength={24}
              autoFocus
              className="w-full rounded-xl border-2 border-ink bg-paper2 px-4 py-3 text-sm text-ink placeholder:text-ink2/40 outline-none focus:border-violeta"
            />
            <p className="text-right font-mono text-[10px] text-ink2/50">{nickname.length}/24</p>
          </div>

          {error && (
            <p className="rounded-lg border-2 border-vermillion/40 bg-vermillion/10 px-4 py-3 text-sm font-semibold text-vermillion">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !nickname.trim()}
            className="w-full rounded-xl border-2 border-ink bg-gradient-to-r from-celeste to-violeta px-5 py-4 font-slab text-xl uppercase tracking-wide text-white shadow-hardsm transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? 'Entrando…' : 'Entrar a la sala →'}
          </button>
        </form>

        <div className="text-center">
          <a href="/multiplayer" className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink2 underline-offset-2 hover:underline">
            ← Volver
          </a>
        </div>
      </div>
    </main>
  )
}
