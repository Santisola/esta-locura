'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { RoomState, ParticipantState } from '@/lib/rooms/queries'

type Props = {
  state: RoomState
  me: ParticipantState | null
  onRefresh: () => void
}

export function RoomLobby({ state, me, onRefresh }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const isHost = me?.isHost ?? false
  const isReady = me?.isReady ?? false
  const inviteUrl = typeof window !== 'undefined' ? `${window.location.origin}/sala/${state.code}` : `/sala/${state.code}`

  // En el lobby nunca hay un draft en curso: limpiamos cualquier borrador local de
  // esta sala. Cubre el primer ingreso y el post-reinicio (evita arrastrar el equipo
  // viejo al volver a draftear después de "jugar de nuevo").
  useEffect(() => {
    try { window.localStorage.removeItem(`esta-locura.room-draft.${state.code}.v1`) } catch { /* noop */ }
  }, [state.code])

  async function toggleReady() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/rooms/${state.code}/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isReady: !isReady }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Error.')
      }
    } finally {
      setLoading(false)
      onRefresh()
    }
  }

  async function startDraft() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/rooms/${state.code}/start-draft`, { method: 'POST' })
      const d = await res.json()
      if (!res.ok) setError(d.error ?? 'Error al iniciar el draft.')
    } finally {
      setLoading(false)
      onRefresh()
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback para contextos sin Clipboard API (http, permisos): selección manual.
      const tmp = document.createElement('textarea')
      tmp.value = inviteUrl
      tmp.style.position = 'fixed'
      tmp.style.opacity = '0'
      document.body.appendChild(tmp)
      tmp.select()
      try {
        document.execCommand('copy')
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        // Silencioso.
      }
      document.body.removeChild(tmp)
    }
  }

  const allReady = state.participants.filter((p) => !p.isHost).every((p) => p.isReady)
  const canStart = isHost && state.participants.length >= 2 && allReady

  const metaChips = [
    state.difficultyMode === 'CLASSIC' ? 'Clásico' : 'De memoria',
    `${state.rerollsPerPlayer} rerolls`,
    state.separateHumans ? 'Grupos separados' : 'Grupos libres',
  ]

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto w-full max-w-lg px-5 py-10 sm:px-8">
        {/* Header / scoreboard */}
        <header className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink/80 pb-5">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-xl border-2 border-ink bg-gradient-to-br from-celeste to-violeta shadow-hardsm">
              <img src="/worldcup.svg" alt="EL" className="h-9 w-9" />
            </span>
            <div>
              <p className="font-slab text-2xl leading-none tracking-wide text-ink">
                ESTA <span className="bg-gradient-to-r from-celeste to-violeta bg-clip-text text-transparent">LOCURA</span>
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.3em] text-ink2">Sala de espera</p>
            </div>
          </Link>
          <div className="text-right">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink2">Código</p>
            <p className="font-slab text-3xl leading-none tracking-[0.18em] text-ink">{state.code}</p>
          </div>
        </header>

        {/* Chips de configuración */}
        <div className="mt-5 flex flex-wrap gap-2">
          {metaChips.map((c) => (
            <span key={c} className="rounded-full border border-line bg-bone px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-ink2">
              {c}
            </span>
          ))}
        </div>

        {/* Invite */}
        <div className="mt-5 rounded-2xl border-2 border-ink bg-bone p-4 shadow-hardsm">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink2">Link de invitación</p>
          <div className="mt-2 flex items-center gap-3">
            <p className="min-w-0 flex-1 truncate font-mono text-sm text-ink">{inviteUrl}</p>
            <button
              onClick={copyInvite}
              className="shrink-0 rounded-full border-2 border-ink bg-bone px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink shadow-hardsm transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
            >
              {copied ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
        </div>

        {/* Participantes */}
        <div className="mt-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-ink2">
            Jugadores · {state.participants.length}/{state.maxHumanPlayers}
          </p>
          <ul className="mt-3 space-y-2">
            {state.participants.map((p) => (
              <li
                key={p.userId}
                className="flex items-center gap-3 rounded-2xl border-2 border-ink bg-bone px-4 py-3 shadow-hardsm"
              >
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                    p.connectionStatus === 'ONLINE' ? 'bg-grass' : 'bg-ink/20'
                  }`}
                />
                <span className="flex-1 truncate text-sm font-semibold text-ink">
                  {p.nickname}
                  {p.isHost && (
                    <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.18em] text-violeta">host</span>
                  )}
                  {p.userId === me?.userId && (
                    <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink2/70">vos</span>
                  )}
                </span>
                <span
                  className={`font-mono text-[11px] uppercase tracking-[0.12em] ${
                    p.isHost ? 'text-ink2/40' : p.isReady ? 'text-grass' : 'text-ink2'
                  }`}
                >
                  {p.isHost ? '—' : p.isReady ? 'Listo ✓' : 'Esperando…'}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Acciones */}
        <div className="mt-6 space-y-3">
          {!isHost && (
            <button
              onClick={toggleReady}
              disabled={loading}
              className={`w-full rounded-xl border-2 border-ink px-5 py-4 font-slab text-lg uppercase tracking-wide shadow-hardsm transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${
                isReady
                  ? 'bg-bone text-ink'
                  : 'bg-gradient-to-r from-celeste to-violeta text-white'
              }`}
            >
              {isReady ? 'Cancelar listo' : '¡Estoy listo!'}
            </button>
          )}

          {isHost && (
            <button
              onClick={startDraft}
              disabled={loading || !canStart}
              className="w-full rounded-xl border-2 border-ink bg-gradient-to-r from-celeste to-violeta px-5 py-4 font-slab text-lg uppercase tracking-wide text-white shadow-hardsm transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? 'Iniciando…' : 'Empezar draft'}
            </button>
          )}

          {isHost && !canStart && (
            <p className="text-center font-mono text-[11px] uppercase tracking-[0.14em] text-ink2">
              {state.participants.length < 2
                ? 'Esperando más jugadores…'
                : 'Esperando que todos estén listos…'}
            </p>
          )}

          {error && <p className="text-center text-sm font-semibold text-vermillion">{error}</p>}
        </div>

        <div className="mt-8 text-center">
          <a href="/multiplayer" className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink2 underline-offset-2 hover:underline">
            ← Salir de la sala
          </a>
        </div>
      </div>
    </main>
  )
}
