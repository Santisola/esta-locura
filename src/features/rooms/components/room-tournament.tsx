'use client'

import { useEffect, useState } from 'react'
import type { RoomState, ParticipantState } from '@/lib/rooms/queries'
import type { RoomTournamentOverview } from '@/lib/tournaments/room-overview'

type Props = {
  state: RoomState
  me: ParticipantState | null
  onRefresh: () => void
}

// Etiquetas de fase de revelado (-1 a 5). Nomenclatura correcta en español:
// ROUND_OF_32 = 16avos · ROUND_OF_16 = octavos · QF = cuartos.
const STAGE_LABELS: Record<number, string> = {
  [-1]: 'El Mundial está por empezar',
  [0]: 'Fase de grupos',
  [1]: '16avos de final',
  [2]: 'Octavos de final',
  [3]: 'Cuartos de final',
  [4]: 'Semifinales',
  [5]: 'Final',
}

const KO_ROUND_LABEL: Record<string, string> = {
  ROUND_OF_32: '16avos',
  ROUND_OF_16: 'Octavos',
  QUARTER_FINAL: 'Cuartos',
  SEMI_FINAL: 'Semis',
  FINAL: 'Final',
}

const KO_ROUND_FULL: Record<string, string> = {
  GROUP: 'grupos',
  ROUND_OF_32: '16avos',
  ROUND_OF_16: 'octavos',
  QUARTER_FINAL: 'cuartos',
  SEMI_FINAL: 'semis',
  FINAL: 'la final',
}

export function RoomTournament({ state, me, onRefresh }: Props) {
  const [overview, setOverview] = useState<RoomTournamentOverview | null>(null)
  const [advancing, setAdvancing] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [ovError, setOvError] = useState<string | null>(null)

  const isHost = me?.isHost ?? false
  const revealIdx = state.revealStageIndex
  const isFinished = state.status === 'FINISHED'

  useEffect(() => {
    if (revealIdx < 0) return
    fetch(`/api/rooms/${state.code}/tournament`)
      .then((r) => r.json())
      .then((d) => setOverview(d))
      .catch(() => {})
  }, [state.code, revealIdx])

  async function advance() {
    setAdvancing(true)
    setOvError(null)
    try {
      const res = await fetch(`/api/rooms/${state.code}/advance`, { method: 'POST' })
      const d = await res.json()
      if (!res.ok) { setOvError(d.error ?? 'Error.'); return }
    } finally {
      setAdvancing(false)
      onRefresh()
    }
  }

  async function restart() {
    setRestarting(true)
    setOvError(null)
    try {
      const res = await fetch(`/api/rooms/${state.code}/restart`, { method: 'POST' })
      const d = await res.json()
      if (!res.ok) { setOvError(d.error ?? 'Error al reiniciar.'); return }
    } finally {
      setRestarting(false)
      onRefresh()
    }
  }

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-8">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink/80 pb-5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink2">Sala {state.code}</p>
            <h1 className="mt-1 font-slab text-3xl uppercase tracking-wide text-ink">
              {STAGE_LABELS[revealIdx] ?? 'El Mundial'}
            </h1>
          </div>
          {isFinished && overview?.championName && (
            <div className="text-right">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink2">Campeón</p>
              <p className="font-slab text-lg text-gold">{overview.championName}</p>
            </div>
          )}
        </header>

        {/* Tablero de participantes */}
        {overview && overview.humans.length > 0 && (
          <div className="mt-5 rounded-2xl border-2 border-ink bg-bone p-4 shadow-hardsm">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-ink2">
              Equipos de los participantes
            </p>
            <div className="mt-3 space-y-2">
              {overview.humans.map((h) => (
                <div
                  key={h.entryId}
                  className={`flex items-center gap-3 rounded-lg border-2 px-3 py-2.5 ${
                    h.isMe ? 'border-violeta bg-paper2' : 'border-line bg-paper2'
                  }`}
                >
                  <span
                    className={`flex-1 truncate text-sm font-bold ${
                      h.status === 'CHAMPION'
                        ? 'text-gold'
                        : h.status === 'ELIMINATED'
                        ? 'text-ink2/50 line-through'
                        : 'text-ink'
                    }`}
                  >
                    {h.nickname}
                    {h.isMe && <span className="ml-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink2/60 no-underline">vos</span>}
                  </span>
                  <span className="shrink-0 text-xs">
                    {h.status === 'CHAMPION' && <span className="font-bold text-gold">🏆 Campeón</span>}
                    {h.status === 'ALIVE' && <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-grass">En carrera</span>}
                    {h.status === 'ELIMINATED' && (
                      <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink2/60">
                        Eliminado · {KO_ROUND_FULL[h.reachedRound] ?? h.reachedRound.toLowerCase()}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Estado "esperando" */}
        {revealIdx === -1 && (
          <div className="mt-6 rounded-2xl border-2 border-ink bg-bone p-8 text-center shadow-hardsm">
            <p className="font-slab text-xl uppercase tracking-wide text-ink">El Mundial fue generado</p>
            <p className="mt-2 text-sm text-ink2">
              {isHost
                ? 'Tocá "Arrancar" para revelar la fase de grupos.'
                : 'Esperando al host para arrancar…'}
            </p>
          </div>
        )}

        {/* Grupos (revelados) */}
        {overview && revealIdx >= 0 && overview.groups.length > 0 && (
          <div className="mt-6 space-y-3">
            <h2 className="font-slab text-xl uppercase tracking-wide text-ink">Fase de grupos</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {overview.groups.map((group) => {
                const hasHuman = group.entries.some((e) => e.type === 'HUMAN_DRAFTED')
                return (
                  <div
                    key={group.code}
                    className={`space-y-2 rounded-2xl border-2 p-3 shadow-hardsm ${
                      hasHuman ? 'border-violeta bg-bone' : 'border-ink bg-bone'
                    }`}
                  >
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink2">
                      Grupo {group.code}
                    </p>
                    {group.standings.map((s) => {
                      const isHuman = group.entries.find((e) => e.id === s.entryId)?.type === 'HUMAN_DRAFTED'
                      return (
                        <div key={s.entryId} className="flex items-center gap-2 text-sm">
                          <span className="w-4 text-right text-ink2/50">{s.rank}.</span>
                          <span className={`flex-1 truncate ${isHuman ? 'font-bold text-violeta' : 'text-ink'}`}>
                            {s.name}
                          </span>
                          <span className="font-mono text-[11px] text-ink2">{s.points}pts</span>
                          <span className="font-mono text-[11px] text-ink2/60">{s.goalsFor}:{s.goalsAgainst}</span>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Bracket KO (revelado) */}
        {overview && overview.knockoutMatches.length > 0 && (
          <div className="mt-6 space-y-3">
            <h2 className="font-slab text-xl uppercase tracking-wide text-ink">Eliminatorias</h2>
            <div className="space-y-2">
              {(['ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL'] as const).map(
                (round) => {
                  const roundMatches = overview.knockoutMatches.filter((m) => m.round === round)
                  if (roundMatches.length === 0) return null
                  return (
                    <div key={round} className="space-y-1.5">
                      <p className="pt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink2/70">
                        {KO_ROUND_LABEL[round]}
                      </p>
                      {roundMatches.map((m) => {
                        const homeIsHuman = overview.humans.some((h) => h.entryId === m.homeEntryId)
                        const awayIsHuman = overview.humans.some((h) => h.entryId === m.awayEntryId)
                        return (
                          <div
                            key={m.id}
                            className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm shadow-hardsm ${
                              m.isHumanDerby ? 'border-violeta bg-bone' : 'border-ink bg-bone'
                            }`}
                          >
                            {m.isHumanDerby && (
                              <span className="shrink-0 rounded bg-gradient-to-r from-celeste to-violeta px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-white">
                                Derby
                              </span>
                            )}
                            <span className={`flex-1 truncate ${homeIsHuman ? 'font-bold text-violeta' : 'text-ink'}`}>
                              {m.homeName}
                            </span>
                            <span className="shrink-0 font-slab text-ink">
                              {m.homeScore} – {m.awayScore}
                              {m.wentToPenalties && (
                                <span className="ml-1 font-mono text-[9px] uppercase text-ink2/60">pen</span>
                              )}
                            </span>
                            <span className={`flex-1 truncate text-right ${awayIsHuman ? 'font-bold text-violeta' : 'text-ink'}`}>
                              {m.awayName}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )
                },
              )}
            </div>
          </div>
        )}

        {/* Campeón final */}
        {isFinished && overview?.championName && (
          <div className="mt-6 rounded-2xl border-2 border-gold bg-gold/10 p-8 text-center shadow-hardsm">
            <p className="font-slab text-4xl text-gold">🏆 {overview.championName}</p>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.24em] text-ink2">Campeón del Mundo</p>
          </div>
        )}

        {/* Controles */}
        <div className="mt-6 space-y-3 border-t-2 border-ink/15 pt-5">
          {/* Avance de fase (mientras no terminó) */}
          {isHost && !isFinished && (
            <button
              onClick={advance}
              disabled={advancing}
              className="w-full rounded-xl border-2 border-ink bg-gradient-to-r from-celeste to-violeta px-5 py-4 font-slab text-lg uppercase tracking-wide text-white shadow-hardsm transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {advancing
                ? 'Avanzando…'
                : revealIdx === -1
                ? 'Arrancar el Mundial'
                : `Revelar ${STAGE_LABELS[(revealIdx + 1) as keyof typeof STAGE_LABELS] ?? 'siguiente fase'}`}
            </button>
          )}
          {!isHost && !isFinished && (
            <p className="text-center font-mono text-[11px] uppercase tracking-[0.14em] text-ink2">
              Esperando al host para avanzar de fase…
            </p>
          )}

          {/* Reinicio (Mundial terminado) */}
          {isFinished && isHost && (
            <button
              onClick={restart}
              disabled={restarting}
              className="w-full rounded-xl border-2 border-ink bg-gradient-to-r from-celeste to-violeta px-5 py-4 font-slab text-lg uppercase tracking-wide text-white shadow-hardsm transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {restarting ? 'Reiniciando…' : '↺ Volver a la sala y jugar de nuevo'}
            </button>
          )}
          {isFinished && !isHost && (
            <p className="text-center font-mono text-[11px] uppercase tracking-[0.14em] text-ink2">
              Esperando que el host reinicie la sala para jugar de nuevo…
            </p>
          )}

          {ovError && <p className="text-center text-sm font-semibold text-vermillion">{ovError}</p>}

          <div className="pt-2 text-center">
            <a href="/multiplayer" className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink2 underline-offset-2 hover:underline">
              ← Salir de la sala
            </a>
          </div>
        </div>
      </div>
    </main>
  )
}
