'use client'

import { useState } from 'react'
import type { RoomState, ParticipantState } from '@/lib/rooms/queries'

type Props = {
  state: RoomState
  me: ParticipantState | null
  onRefresh: () => void
}

export function RoomDraft({ state, me, onRefresh }: Props) {
  const [startingTournament, setStartingTournament] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmForce, setConfirmForce] = useState(false)

  const isHost = me?.isHost ?? false
  const myDraftDone = me?.draftStatus === 'COMPLETED'
  const completedCount = state.participants.filter((p) => p.draftStatus === 'COMPLETED').length
  const totalCount = state.participants.length
  const allDone = completedCount === totalCount

  async function startTournament() {
    setStartingTournament(true)
    setError(null)
    setConfirmForce(false)
    try {
      const res = await fetch(`/api/rooms/${state.code}/start-tournament`, { method: 'POST' })
      const d = await res.json()
      if (!res.ok) {
        setError(d.error ?? 'Error al iniciar el torneo.')
        setStartingTournament(false)
        return
      }
      // El poll va a detectar el cambio de estado.
      onRefresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado.')
      setStartingTournament(false)
    }
  }

  const incompleteCount = totalCount - completedCount

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto w-full max-w-lg px-5 py-10 sm:px-8">
        {/* Header */}
        <header className="flex items-end justify-between border-b-2 border-ink/80 pb-5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink2">
              Sala {state.code} · Fase de draft
            </p>
            <h1 className="mt-1 font-slab text-3xl uppercase tracking-wide text-ink">Armá tu equipo</h1>
          </div>
          <div className="text-right">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink2">Listos</p>
            <p className="font-slab text-3xl leading-none text-ink">
              {completedCount}<span className="text-ink2/50">/{totalCount}</span>
            </p>
          </div>
        </header>

        {/* Progreso de la sala */}
        <div className="mt-5 rounded-2xl border-2 border-ink bg-bone p-4 shadow-hardsm">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-ink2">Progreso del grupo</p>
          <ul className="mt-3 space-y-2.5">
            {state.participants.map((p) => (
              <li key={p.userId} className="flex items-center gap-3">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                    p.connectionStatus === 'ONLINE' ? 'bg-grass' : 'bg-ink/20'
                  }`}
                />
                <span className="flex-1 truncate text-sm font-semibold text-ink">
                  {p.nickname}
                  {p.userId === me?.userId && (
                    <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink2/70">vos</span>
                  )}
                </span>
                {p.draftStatus === 'COMPLETED' ? (
                  <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-grass">Listo ✓</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 overflow-hidden rounded-full border border-line bg-paper2">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-celeste to-violeta transition-all"
                        style={{ width: `${(p.draftProgress.filled / p.draftProgress.total) * 100}%` }}
                      />
                    </div>
                    <span className="font-mono text-[10px] text-ink2">
                      {p.draftProgress.filled}/{p.draftProgress.total}
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Draft propio */}
        {!myDraftDone ? (
          <div className="mt-5 rounded-2xl border-2 border-ink bg-bone p-5 shadow-hardsm">
            <p className="text-sm leading-6 text-ink2">
              Andá a la mesa de draft, armá tu selección y volvé acá para arrancar el Mundial cuando todos estén listos.
            </p>
            <a
              href={`/draft?sala=${state.code}`}
              className="mt-4 block w-full rounded-xl border-2 border-ink bg-gradient-to-r from-celeste to-violeta px-5 py-4 text-center font-slab text-lg uppercase tracking-wide text-white shadow-hardsm transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none active:scale-[0.98]"
            >
              Ir al draft →
            </a>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border-2 border-grass bg-grass/10 p-5 text-center shadow-hardsm">
            <p className="font-slab text-lg uppercase tracking-wide text-grassdark">✓ Tu draft está completo</p>
            <p className="mt-1 text-sm text-ink2">Esperando a los demás o al host para arrancar el Mundial.</p>
          </div>
        )}

        {/* Acciones del host */}
        {isHost && (
          <div className="mt-6 space-y-3">
            {!confirmForce && (
              <button
                onClick={() => {
                  if (!allDone) {
                    setConfirmForce(true)
                  } else {
                    startTournament()
                  }
                }}
                disabled={startingTournament}
                className="w-full rounded-xl border-2 border-ink bg-gradient-to-r from-celeste to-violeta px-5 py-4 font-slab text-lg uppercase tracking-wide text-white shadow-hardsm transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {startingTournament
                  ? 'Generando el Mundial…'
                  : allDone
                  ? '¡Abrir el Mundial!'
                  : 'Cerrar draft y abrir el Mundial'}
              </button>
            )}

            {confirmForce && (
              <div className="rounded-2xl border-2 border-vermillion bg-vermillion/10 p-4 shadow-hardsm space-y-3">
                <p className="text-sm text-ink">
                  <span className="font-bold text-vermillion">Atención:</span>{' '}
                  {incompleteCount} jugador{incompleteCount !== 1 ? 'es' : ''} no terminó el draft
                  y {incompleteCount !== 1 ? 'serán reemplazados' : 'será reemplazado'} por
                  selecciones reales.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={startTournament}
                    disabled={startingTournament}
                    className="flex-1 rounded-lg border-2 border-vermillion bg-bone px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-vermillion transition hover:bg-vermillion hover:text-white"
                  >
                    Confirmar igualmente
                  </button>
                  <button
                    onClick={() => setConfirmForce(false)}
                    className="flex-1 rounded-lg border-2 border-line bg-bone px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink2 transition hover:border-ink/50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {error && <p className="text-center text-sm font-semibold text-vermillion">{error}</p>}
          </div>
        )}
      </div>
    </main>
  )
}
