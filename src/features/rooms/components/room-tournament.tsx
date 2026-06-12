'use client'

import { useEffect, useRef, useState } from 'react'
import type { RoomState, ParticipantState } from '@/lib/rooms/queries'
import type { RoomTournamentOverview } from '@/lib/tournaments/room-overview'
import { GoldenConfetti } from '@/components/golden-confetti'

type Props = {
  state: RoomState
  me: ParticipantState | null
  onRefresh: () => void
}

// -1: nada | 0: grupos
// 1: cruces R32 | 2: resultados R32
// 3: cruces R16 | 4: resultados R16
// 5: cruces QF  | 6: resultados QF
// 7: cruces SF  | 8: resultados SF
// 9: cruce Final | 10: resultado Final
const STAGE_LABELS: Record<number, string> = {
  [-1]: 'El Mundial está por empezar',
  [0]: 'Fase de grupos',
  [1]: 'Cruces de 16avos',
  [2]: '16avos de final',
  [3]: 'Cruces de octavos',
  [4]: 'Octavos de final',
  [5]: 'Cruces de cuartos',
  [6]: 'Cuartos de final',
  [7]: 'Cruces de semis',
  [8]: 'Semifinales',
  [9]: 'Cruce de la Final',
  [10]: 'Final',
}

const KO_ROUND_LABEL: Record<string, string> = {
  ROUND_OF_32: '16avos de final',
  ROUND_OF_16: 'Octavos de final',
  QUARTER_FINAL: 'Cuartos de final',
  SEMI_FINAL: 'Semifinales',
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

// Qué sección scrollear según el índice revelado
const STAGE_TO_SCROLL_TARGET: Record<number, string> = {
  0: 'groups',
  1: 'ROUND_OF_32', 2: 'ROUND_OF_32',
  3: 'ROUND_OF_16', 4: 'ROUND_OF_16',
  5: 'QUARTER_FINAL', 6: 'QUARTER_FINAL',
  7: 'SEMI_FINAL', 8: 'SEMI_FINAL',
  9: 'FINAL', 10: 'FINAL',
}

// Avanzar desde -1: el botón dice "Arrancar"
// Desde 0 en adelante el botón anuncia la siguiente fase
function nextStageLabel(currentIdx: number): string {
  if (currentIdx === -1) return 'Arrancar el Mundial'
  const next = currentIdx + 1
  const label = STAGE_LABELS[next]
  if (!label) return 'Siguiente fase'
  // Distinguir entre "revelar cruces" (impares) y "revelar resultados" (pares ≥ 2)
  if (next % 2 === 1) return `Mostrar cruces — ${label}`
  return `Revelar resultados — ${label}`
}

export function RoomTournament({ state, me, onRefresh }: Props) {
  const [overview, setOverview] = useState<RoomTournamentOverview | null>(null)
  const [ovLoading, setOvLoading] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [revealingAll, setRevealingAll] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [ovError, setOvError] = useState<string | null>(null)

  const isHost = me?.isHost ?? false
  const revealIdx = state.revealStageIndex
  const isFinished = state.status === 'FINISHED'

  // Ref por sección para auto-scroll preciso
  const roundRefs = useRef<Record<string, HTMLDivElement | null>>({
    groups: null,
    ROUND_OF_32: null,
    ROUND_OF_16: null,
    QUARTER_FINAL: null,
    SEMI_FINAL: null,
    FINAL: null,
  })
  // Inicializado con el índice actual para no scrollear en la carga inicial
  const prevRevealRef = useRef<number>(revealIdx)

  useEffect(() => {
    if (revealIdx < 0) return
    setOvLoading(true)
    fetch(`/api/rooms/${state.code}/tournament`)
      .then((r) => r.json())
      .then((d) => {
        setOverview(d)
      })
      .catch(() => {})
      .finally(() => setOvLoading(false))
  }, [state.code, revealIdx])

  // Auto-scroll a la sección nueva cuando la fase cambia.
  // Solo scrollea cuando el overview ya refleja el revealIdx actual (no el anterior).
  useEffect(() => {
    if (!overview) return
    if (overview.revealStageIndex !== revealIdx) return // overview todavía desactualizado
    if (revealIdx === prevRevealRef.current) return     // ya scrolleamos para este índice
    prevRevealRef.current = revealIdx
    const target = STAGE_TO_SCROLL_TARGET[revealIdx]
    if (!target) return
    setTimeout(() => {
      roundRefs.current[target]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 150)
  }, [overview, revealIdx])

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

  // Revela todo el Mundial de una: salta directo al resultado de la Final.
  async function revealAll() {
    setRevealingAll(true)
    setOvError(null)
    try {
      const res = await fetch(`/api/rooms/${state.code}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
      const d = await res.json()
      if (!res.ok) { setOvError(d.error ?? 'Error.'); return }
    } finally {
      setRevealingAll(false)
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

        {/* Indicador de carga entre fases */}
        {ovLoading && (
          <div className="mt-6 flex items-center justify-center gap-3 rounded-2xl border-2 border-ink/20 bg-bone py-6 shadow-hardsm">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-ink border-t-transparent" />
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink2">Cargando siguiente fase…</p>
          </div>
        )}

        {/* Grupos (revelados) */}
        {!ovLoading && overview && revealIdx >= 0 && overview.groups.length > 0 && (
          <div ref={(el) => { roundRefs.current.groups = el }} className="mt-6 space-y-3">
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

        {/* Bracket KO */}
        {!ovLoading && overview && overview.knockoutMatches.length > 0 && (
          <div className="mt-6 space-y-3">
            <h2 className="font-slab text-xl uppercase tracking-wide text-ink">Eliminatorias</h2>
            <div className="space-y-4">
              {(['ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL'] as const).map(
                (round) => {
                  const roundMatches = overview.knockoutMatches.filter((m) => m.round === round)
                  if (roundMatches.length === 0) return null
                  const scoresShown = roundMatches[0].showScores
                  return (
                    <div key={round} ref={(el) => { roundRefs.current[round] = el }} className="space-y-1.5">
                      <div className="flex items-center gap-3 pt-2">
                        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink2/70">
                          {KO_ROUND_LABEL[round]}
                        </p>
                        {!scoresShown && (
                          <span className="rounded bg-celeste/20 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide text-celeste">
                            Cruces confirmados
                          </span>
                        )}
                      </div>
                      {roundMatches.map((m) => {
                        const homeIsHuman = overview.humans.some((h) => h.entryId === m.homeEntryId)
                        const awayIsHuman = overview.humans.some((h) => h.entryId === m.awayEntryId)
                        const homeWon = m.showScores && m.winnerId === m.homeEntryId
                        const awayWon = m.showScores && m.winnerId === m.awayEntryId
                        const isMyMatch = overview.myEntryId != null && (
                          m.homeEntryId === overview.myEntryId || m.awayEntryId === overview.myEntryId
                        )
                        const borderClass = isMyMatch
                          ? 'border-violeta'
                          : homeIsHuman || awayIsHuman
                          ? 'border-celeste'
                          : 'border-ink'

                        return (
                          <div
                            key={m.id}
                            className={`rounded-lg border-2 px-3 py-2 shadow-hardsm bg-bone ${borderClass}`}
                          >
                            {/* Fila principal: nombre · marcador · nombre */}
                            <div className="flex items-center gap-2 text-sm">
                              {m.isHumanDerby && (
                                <span className="shrink-0 rounded bg-gradient-to-r from-celeste to-violeta px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-white">
                                  Derby
                                </span>
                              )}
                              <span
                                className={`flex-1 truncate font-medium ${
                                  !m.showScores
                                    ? homeIsHuman ? 'font-bold text-violeta' : 'text-ink'
                                    : homeWon
                                    ? homeIsHuman ? 'font-bold text-violeta' : 'font-bold text-ink'
                                    : 'text-ink2/40'
                                }`}
                              >
                                {m.homeName}
                              </span>

                              {/* Marcador central */}
                              <div className="shrink-0 text-center">
                                {m.showScores ? (
                                  <>
                                    <span className="font-slab text-ink">
                                      {m.homeScore} – {m.awayScore}
                                    </span>
                                    {m.wentToPenalties && (
                                      <div className="mt-0.5 font-mono text-[10px] font-semibold text-ink2">
                                        pen. {m.homePenalties}–{m.awayPenalties}
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <span className="font-mono text-[11px] uppercase tracking-wide text-ink2/50">vs</span>
                                )}
                              </div>

                              <span
                                className={`flex-1 truncate text-right font-medium ${
                                  !m.showScores
                                    ? awayIsHuman ? 'font-bold text-violeta' : 'text-ink'
                                    : awayWon
                                    ? awayIsHuman ? 'font-bold text-violeta' : 'font-bold text-ink'
                                    : 'text-ink2/40'
                                }`}
                              >
                                {m.awayName}
                              </span>
                            </div>

                            {/* Detalle de penales: tanda de kicks */}
                            {m.showScores && m.wentToPenalties && (
                              <PenaltyDetail
                                homeName={m.homeName}
                                awayName={m.awayName}
                                homePenalties={m.homePenalties ?? 0}
                                awayPenalties={m.awayPenalties ?? 0}
                                homeWon={homeWon}
                                events={m.events}
                              />
                            )}
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

        {/* Confetti si el jugador actual ganó el torneo */}
        {isFinished && overview?.championEntryId && overview.championEntryId === overview.myEntryId && (
          <GoldenConfetti />
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
          {isHost && !isFinished && (
            <>
              <button
                onClick={advance}
                disabled={advancing || revealingAll || ovLoading}
                className="w-full rounded-xl border-2 border-ink bg-gradient-to-r from-celeste to-violeta px-5 py-4 font-slab text-lg uppercase tracking-wide text-white shadow-hardsm transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {advancing ? 'Avanzando…' : nextStageLabel(revealIdx)}
              </button>
              <button
                onClick={revealAll}
                disabled={advancing || revealingAll || ovLoading}
                className="w-full rounded-xl border-2 border-ink bg-bone px-5 py-3 font-mono text-xs uppercase tracking-[0.2em] text-ink shadow-hardsm transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {revealingAll ? 'Revelando…' : '⏭ Simular todo el Mundial'}
              </button>
            </>
          )}
          {!isHost && !isFinished && (
            <p className="text-center font-mono text-[11px] uppercase tracking-[0.14em] text-ink2">
              Esperando al host para avanzar de fase…
            </p>
          )}

          {isFinished && overview?.myEntryId && overview.tournamentId && (
            <a
              href={`/tournament/${overview.tournamentId}/room-card?entry=${overview.myEntryId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full rounded-xl border-2 border-ink bg-bone px-5 py-3 text-center font-mono text-xs uppercase tracking-[0.2em] text-ink shadow-hardsm transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
            >
              Ver mi card
            </a>
          )}

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

// Componente que muestra el detalle de la tanda de penales
type PenaltyDetailProps = {
  homeName: string
  awayName: string
  homePenalties: number
  awayPenalties: number
  homeWon: boolean
  events: Array<{ minute: number; type: string; side: string; playerName: string | null }>
}

function PenaltyDetail({
  homeName,
  awayName,
  homePenalties,
  awayPenalties,
  homeWon,
  events,
}: PenaltyDetailProps) {
  // Extraer los tiros de penal de los eventos (solo PENALTY_GOAL; MISS no se simula como evento)
  const homeGoalEvents = events.filter((e) => e.type === 'PENALTY_GOAL' && e.side === 'HOME')
  const awayGoalEvents = events.filter((e) => e.type === 'PENALTY_GOAL' && e.side === 'AWAY')

  const total = Math.max(homePenalties, awayPenalties, 5)

  return (
    <div className="mt-2 rounded-lg border border-ink/10 bg-paper/60 px-3 py-2">
      <p className="mb-1.5 text-center font-mono text-[9px] uppercase tracking-[0.2em] text-ink2/60">
        Tanda de penales
      </p>
      <div className="flex items-center gap-3">
        {/* Local */}
        <div className="flex flex-1 flex-col items-start gap-1">
          <span className={`truncate font-mono text-[10px] uppercase tracking-wide ${homeWon ? 'text-grass font-bold' : 'text-ink2/50'}`}>
            {homeName}
          </span>
          <div className="flex gap-1">
            {Array.from({ length: total }).map((_, i) => {
              const scored = i < homePenalties
              return (
                <span
                  key={i}
                  className={`h-3 w-3 rounded-full border ${
                    scored
                      ? homeWon
                        ? 'border-grass bg-grass'
                        : 'border-ink2/50 bg-ink2/30'
                      : 'border-vermillion/60 bg-vermillion/15'
                  }`}
                />
              )
            })}
          </div>
        </div>

        {/* Marcador de penales */}
        <div className="shrink-0 text-center">
          <span className={`font-slab text-xl ${homeWon ? 'text-grass' : 'text-vermillion'}`}>
            {homePenalties}
          </span>
          <span className="font-slab text-ink2/50"> – </span>
          <span className={`font-slab text-xl ${!homeWon ? 'text-grass' : 'text-vermillion'}`}>
            {awayPenalties}
          </span>
        </div>

        {/* Visitante */}
        <div className="flex flex-1 flex-col items-end gap-1">
          <span className={`truncate font-mono text-[10px] uppercase tracking-wide ${!homeWon ? 'text-grass font-bold' : 'text-ink2/50'}`}>
            {awayName}
          </span>
          <div className="flex gap-1">
            {Array.from({ length: total }).map((_, i) => {
              const scored = i < awayPenalties
              return (
                <span
                  key={i}
                  className={`h-3 w-3 rounded-full border ${
                    scored
                      ? !homeWon
                        ? 'border-grass bg-grass'
                        : 'border-ink2/50 bg-ink2/30'
                      : 'border-vermillion/60 bg-vermillion/15'
                  }`}
                />
              )
            })}
          </div>
        </div>
      </div>

      {/* Goleadores de penales si hay eventos */}
      {(homeGoalEvents.length > 0 || awayGoalEvents.length > 0) && (
        <div className="mt-2 grid grid-cols-2 gap-2 border-t border-ink/10 pt-2">
          <div className="space-y-0.5">
            {homeGoalEvents.map((e, i) => (
              <p key={i} className="font-mono text-[9px] text-ink2/60">
                {e.playerName ?? '—'}
              </p>
            ))}
          </div>
          <div className="space-y-0.5 text-right">
            {awayGoalEvents.map((e, i) => (
              <p key={i} className="font-mono text-[9px] text-ink2/60">
                {e.playerName ?? '—'}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
