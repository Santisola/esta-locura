'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { RoomState, ParticipantState } from '@/lib/rooms/queries'
import type { RoomTournamentOverview, HumanRunEntry } from '@/lib/tournaments/room-overview'
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

const KO_ROUNDS = ['ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL'] as const

// Las 6 fases del Mundial para el stepper de progreso. startIdx = revealStageIndex
// en el que la fase empieza a mostrarse (cruces).
const PHASES: Array<{ label: string; short: string; startIdx: number }> = [
  { label: 'Grupos', short: 'GR', startIdx: 0 },
  { label: '16avos', short: '32', startIdx: 1 },
  { label: 'Octavos', short: '16', startIdx: 3 },
  { label: 'Cuartos', short: 'QF', startIdx: 5 },
  { label: 'Semis', short: 'SF', startIdx: 7 },
  { label: 'Final', short: 'FN', startIdx: 9 },
]

// Orden de rondas para rankear el recorrido de cada participante.
const ROUND_ORDER: Record<string, number> = {
  PENDING: -1,
  GROUP: 0,
  ROUND_OF_32: 1,
  ROUND_OF_16: 2,
  QUARTER_FINAL: 3,
  SEMI_FINAL: 4,
  FINAL: 5,
}

type MyLastResult = {
  roundLabel: string
  myScore: number
  oppScore: number
  oppName: string
  won: boolean
  draw: boolean
  penalties: { mine: number; theirs: number } | null
}

// Nombre de la ronda "actual" del Mundial según el índice revelado.
function currentRoundName(idx: number): string {
  if (idx <= 0) return 'fase de grupos'
  if (idx <= 2) return '16avos'
  if (idx <= 4) return 'octavos'
  if (idx <= 6) return 'cuartos'
  if (idx <= 8) return 'semis'
  return 'la final'
}

// Avanzar desde -1: el botón dice "Arrancar"
// Desde 0 en adelante el botón anuncia la siguiente fase
function nextStageLabel(currentIdx: number): string {
  if (currentIdx === -1) return 'Arrancar el Mundial'
  const next = currentIdx + 1
  const label = STAGE_LABELS[next]
  if (!label) return 'Siguiente fase'
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
  const [activeTab, setActiveTab] = useState<'GROUPS' | 'BRACKET'>('GROUPS')
  const [onlyHumanGroups, setOnlyHumanGroups] = useState(false)
  const [flashId, setFlashId] = useState<string | null>(null)

  const isHost = me?.isHost ?? false
  const revealIdx = state.revealStageIndex
  const isFinished = state.status === 'FINISHED'

  const mainRef = useRef<HTMLDivElement | null>(null)
  const prevRevealRef = useRef<number>(revealIdx)

  useEffect(() => {
    if (revealIdx < 0) return
    setOvLoading(true)
    fetch(`/api/rooms/${state.code}/tournament`)
      .then((r) => r.json())
      .then((d) => setOverview(d))
      .catch(() => {})
      .finally(() => setOvLoading(false))
  }, [state.code, revealIdx])

  // Cuando se revela una fase nueva, llevar al usuario a la sección relevante
  // (grupos si recién arrancó, llave si ya hay eliminatorias) y subir el scroll.
  useEffect(() => {
    if (!overview) return
    if (overview.revealStageIndex !== revealIdx) return
    if (revealIdx === prevRevealRef.current) return
    prevRevealRef.current = revealIdx
    setActiveTab(revealIdx >= 1 ? 'BRACKET' : 'GROUPS')
    setTimeout(() => {
      mainRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
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

  // Mapa entryId → nombre para resolver eliminadores.
  const nameByEntry = useMemo(() => {
    const map = new Map<string, string>()
    if (overview) {
      for (const g of overview.groups) for (const s of g.standings) map.set(s.entryId, s.name)
      for (const m of overview.knockoutMatches) {
        map.set(m.homeEntryId, m.homeName)
        map.set(m.awayEntryId, m.awayName)
      }
      for (const h of overview.humans) map.set(h.entryId, h.nickname)
    }
    return map
  }, [overview])

  // Participantes ordenados por recorrido: campeón → en carrera → eliminados (más lejos primero).
  const rankedHumans = useMemo(() => {
    if (!overview) return []
    const statusRank: Record<HumanRunEntry['status'], number> = { CHAMPION: 0, ALIVE: 1, ELIMINATED: 2 }
    return [...overview.humans].sort((a, b) => {
      if (statusRank[a.status] !== statusRank[b.status]) return statusRank[a.status] - statusRank[b.status]
      if (a.status === 'ELIMINATED' && b.status === 'ELIMINATED') {
        const ra = ROUND_ORDER[a.reachedRound] ?? 0
        const rb = ROUND_ORDER[b.reachedRound] ?? 0
        if (ra !== rb) return rb - ra
      }
      return a.nickname.localeCompare(b.nickname)
    })
  }, [overview])

  const aliveCount = overview ? overview.humans.filter((h) => h.status !== 'ELIMINATED').length : 0
  const totalHumans = overview?.humans.length ?? 0
  const myRun = overview?.humans.find((h) => h.isMe) ?? null
  const hasBracket = (overview?.knockoutMatches.length ?? 0) > 0

  // Último "partido disponible" del usuario: su cruce KO más avanzado entre los
  // revelados; si todavía no tiene cruce, su grupo. Sirve para el botón "Ver mi cruce".
  const myTarget = useMemo<{ tab: 'GROUPS' | 'BRACKET'; elementId: string } | null>(() => {
    if (!overview?.myEntryId) return null
    const id = overview.myEntryId
    const mine = overview.knockoutMatches.filter((m) => m.homeEntryId === id || m.awayEntryId === id)
    if (mine.length > 0) {
      const last = [...mine].sort((a, b) => (ROUND_ORDER[a.round] ?? 0) - (ROUND_ORDER[b.round] ?? 0)).pop()!
      return { tab: 'BRACKET', elementId: `match-${last.id}` }
    }
    const grp = overview.groups.find((g) => g.entries.some((e) => e.id === id))
    if (grp) return { tab: 'GROUPS', elementId: `group-${grp.code}` }
    return null
  }, [overview])

  function goToMyMatch() {
    if (!myTarget) return
    setActiveTab(myTarget.tab)
    // Reset previo para que el pulso se reinicie aunque sea el mismo target.
    setFlashId(null)
    setTimeout(() => {
      setFlashId(myTarget.elementId)
      document.getElementById(myTarget.elementId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 90)
    setTimeout(() => setFlashId(null), 1700)
  }

  const visibleGroups = useMemo(() => {
    if (!overview) return []
    if (!onlyHumanGroups) return overview.groups
    return overview.groups.filter((g) => g.entries.some((e) => e.type === 'HUMAN_DRAFTED'))
  }, [overview, onlyHumanGroups])

  // Resultado del último partido jugado del usuario (KO con resultado revelado o,
  // en su defecto, el último de fase de grupos). Visto desde su perspectiva.
  const myLastResult = useMemo<MyLastResult | null>(() => {
    if (!overview?.myEntryId) return null
    const id = overview.myEntryId
    type Cand = {
      recency: number; isHome: boolean; homeScore: number; awayScore: number
      homeName: string; awayName: string; wentToPenalties: boolean
      homePenalties: number | null; awayPenalties: number | null; winnerId: string | null; roundLabel: string
    }
    const cands: Cand[] = []
    for (const m of overview.knockoutMatches) {
      if (!m.showScores) continue
      if (m.homeEntryId !== id && m.awayEntryId !== id) continue
      cands.push({
        recency: 100 + (ROUND_ORDER[m.round] ?? 0), isHome: m.homeEntryId === id,
        homeScore: m.homeScore, awayScore: m.awayScore, homeName: m.homeName, awayName: m.awayName,
        wentToPenalties: m.wentToPenalties, homePenalties: m.homePenalties, awayPenalties: m.awayPenalties,
        winnerId: m.winnerId, roundLabel: KO_ROUND_LABEL[m.round] ?? 'Eliminatorias',
      })
    }
    for (const g of overview.groups) {
      for (const f of g.fixtures) {
        if (f.status !== 'FINISHED') continue
        if (f.homeEntryId !== id && f.awayEntryId !== id) continue
        cands.push({
          recency: f.stageOrder ?? 0, isHome: f.homeEntryId === id,
          homeScore: f.homeScore, awayScore: f.awayScore, homeName: f.homeName, awayName: f.awayName,
          wentToPenalties: f.wentToPenalties, homePenalties: f.homePenalties, awayPenalties: f.awayPenalties,
          winnerId: f.winnerEntryId, roundLabel: 'Grupos',
        })
      }
    }
    if (cands.length === 0) return null
    const m = [...cands].sort((a, b) => a.recency - b.recency).pop()!
    const myScore = m.isHome ? m.homeScore : m.awayScore
    const oppScore = m.isHome ? m.awayScore : m.homeScore
    const oppName = m.isHome ? m.awayName : m.homeName
    const won = m.winnerId ? m.winnerId === id : myScore > oppScore
    const draw = !m.wentToPenalties && !m.winnerId && myScore === oppScore
    const penalties = m.wentToPenalties
      ? { mine: (m.isHome ? m.homePenalties : m.awayPenalties) ?? 0, theirs: (m.isHome ? m.awayPenalties : m.homePenalties) ?? 0 }
      : null
    return { roundLabel: m.roundLabel, myScore, oppScore, oppName, won, draw, penalties }
  }, [overview])

  return (
    <main className="min-h-screen bg-paper text-ink">
      {/* ===== Header sticky: identidad de fase + stepper (resumen siempre visible) ===== */}
      <div className="sticky top-0 z-30 border-b-2 border-ink/80 bg-paper/95 backdrop-blur">
        <div className="mx-auto w-full max-w-6xl px-5 py-3 sm:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink2">Sala {state.code}</p>
              <h1 className="truncate font-slab text-xl uppercase tracking-wide text-ink sm:text-2xl">
                {STAGE_LABELS[revealIdx] ?? 'El Mundial'}
              </h1>
            </div>
            {revealIdx >= 0 && (
              <MyStatusChip run={myRun} revealIdx={revealIdx} isFinished={isFinished} />
            )}
          </div>
          <div className="mt-3">
            <StageStepper revealIdx={revealIdx} isFinished={isFinished} />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-8">
        {/* ===== Estado "esperando" ===== */}
        {revealIdx === -1 ? (
          <div className="mt-2 rounded-2xl border-2 border-ink bg-bone p-8 text-center shadow-hardsm">
            <p className="font-slab text-2xl uppercase tracking-wide text-ink">El Mundial fue generado</p>
            <p className="mt-2 text-sm text-ink2">
              {isHost ? 'Tocá "Arrancar" para revelar la fase de grupos.' : 'Esperando al host para arrancar…'}
            </p>
            {overview && overview.humans.length > 0 && (
              <div className="mx-auto mt-6 max-w-md">
                <ParticipantBoard humans={rankedHumans} nameByEntry={nameByEntry} compact />
              </div>
            )}
            <div className="mt-6">
              <Controls
                isHost={isHost}
                isFinished={isFinished}
                revealIdx={revealIdx}
                advancing={advancing}
                revealingAll={revealingAll}
                restarting={restarting}
                ovLoading={ovLoading}
                overview={overview}
                onAdvance={advance}
                onRevealAll={revealAll}
                onRestart={restart}
              />
            </div>
          </div>
        ) : (
          <div className="lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-6">
            {/* ===== Rail izquierdo: situación + participantes + controles ===== */}
            <aside className="order-2 mt-6 space-y-4 lg:order-1 lg:mt-0 lg:sticky lg:top-[120px] lg:self-start">
              <MySituationCard run={myRun} revealIdx={revealIdx} aliveCount={aliveCount} totalHumans={totalHumans} topScorer={overview?.topScorer ?? null} lastResult={myLastResult} />
              {overview && overview.humans.length > 0 && (
                <div className="rounded-2xl border-2 border-ink bg-bone p-4 shadow-hardsm">
                  <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink2">Participantes</p>
                  <div className="mt-3">
                    <ParticipantBoard humans={rankedHumans} nameByEntry={nameByEntry} />
                  </div>
                </div>
              )}
              {/* Controles (desktop) */}
              <div className="hidden lg:block">
                <Controls
                  isHost={isHost}
                  isFinished={isFinished}
                  revealIdx={revealIdx}
                  advancing={advancing}
                  revealingAll={revealingAll}
                  restarting={restarting}
                  ovLoading={ovLoading}
                  overview={overview}
                  onAdvance={advance}
                  onRevealAll={revealAll}
                  onRestart={restart}
                />
              </div>
            </aside>

            {/* ===== Columna principal: tabs + contenido ===== */}
            <section ref={mainRef} className="order-1 lg:order-2 lg:scroll-mt-[130px]">
              {/* Tira de chips de jugadores — solo mobile, resumen rápido */}
              {overview && overview.humans.length > 0 && (
                <div className="my-4 flex flex-wrap items-center gap-1.5 lg:hidden">
                  {rankedHumans.map((h) => {
                    const isChamp = h.status === 'CHAMPION'
                    const isOut = h.status === 'ELIMINATED'
                    const colorClass = isChamp
                      ? 'border-gold bg-gold/10 text-gold'
                      : h.isMe
                      ? 'border-violeta bg-violeta/10 text-violeta'
                      : isOut
                      ? 'border-line bg-paper2 text-ink2/55'
                      : 'border-grass bg-grass/10 text-grassdark'
                    return (
                      <span
                        key={h.entryId}
                        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase leading-none tracking-[0.04em] ${colorClass}`}
                      >
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isChamp ? 'bg-gold' : isOut ? 'bg-ink2/30' : 'bg-grass'}`} />
                        {isChamp ? '🏆 ' : ''}{h.nickname}
                      </span>
                    )
                  })}
                </div>
              )}

              {/* Selector de sección */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('GROUPS')}
                  className={`flex-1 rounded-lg border-2 px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] transition ${
                    activeTab === 'GROUPS' ? 'border-ink bg-ink text-paper' : 'border-line bg-bone text-ink hover:border-ink/50'
                  }`}
                >
                  Grupos
                </button>
                <button
                  onClick={() => setActiveTab('BRACKET')}
                  disabled={!hasBracket}
                  className={`flex-1 rounded-lg border-2 px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    activeTab === 'BRACKET' ? 'border-ink bg-ink text-paper' : 'border-line bg-bone text-ink hover:border-ink/50'
                  }`}
                >
                  Llave
                </button>
              </div>

              {/* Atajo al cruce/grupo propio */}
              {myTarget && (
                <button
                  onClick={goToMyMatch}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-violeta bg-violeta/5 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-violeta transition hover:bg-violeta/10 active:scale-[0.99]"
                >
                  📍 {myTarget.tab === 'BRACKET' ? 'Ver mi cruce' : 'Ver mi grupo'}
                </button>
              )}

              {/* Carga entre fases */}
              {ovLoading && (
                <div className="mt-6 flex items-center justify-center gap-3 rounded-2xl border-2 border-ink/20 bg-bone py-6 shadow-hardsm">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-ink border-t-transparent" />
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink2">Cargando siguiente fase…</p>
                </div>
              )}

              {/* ===== Campeón ===== */}
              {!ovLoading && isFinished && overview?.championName && (
                <div className="mt-4 rounded-2xl border-2 border-gold bg-gold/10 p-6 text-center shadow-hardsm">
                  <p className="font-slab text-3xl text-gold sm:text-4xl">🏆 {overview.championName}</p>
                  <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.24em] text-ink2">Campeón del Mundo</p>
                </div>
              )}

              {/* ===== Grupos ===== */}
              {!ovLoading && overview && activeTab === 'GROUPS' && overview.groups.length > 0 && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-slab text-lg uppercase tracking-wide text-ink">Fase de grupos</h2>
                    <button
                      onClick={() => setOnlyHumanGroups((v) => !v)}
                      className={`rounded-full border-2 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition ${
                        onlyHumanGroups ? 'border-violeta bg-violeta/10 text-violeta' : 'border-line bg-bone text-ink2 hover:border-ink/40'
                      }`}
                    >
                      {onlyHumanGroups ? '✓ Con jugadores' : 'Solo con jugadores'}
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {visibleGroups.map((group) => {
                      const hasHuman = group.entries.some((e) => e.type === 'HUMAN_DRAFTED')
                      return (
                        <div
                          key={group.code}
                          id={`group-${group.code}`}
                          className={`scroll-mt-32 space-y-1.5 rounded-2xl border-2 p-3 shadow-hardsm bg-bone ${
                            hasHuman ? 'border-violeta' : 'border-ink'
                          } ${flashId === `group-${group.code}` ? 'animate-flashPulse' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink2">Grupo {group.code}</p>
                            {hasHuman && (
                              <span className="rounded bg-violeta/15 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wide text-violeta">Jugador</span>
                            )}
                          </div>
                          {group.standings.map((s) => {
                            const isHuman = group.entries.find((e) => e.id === s.entryId)?.type === 'HUMAN_DRAFTED'
                            const qualifies = s.rank <= 2
                            return (
                              <div key={s.entryId} className="flex items-center gap-2 text-sm">
                                <span
                                  className={`grid h-4 w-4 shrink-0 place-items-center rounded text-[10px] font-bold ${
                                    qualifies ? 'bg-grass/20 text-grassdark' : 'text-ink2/50'
                                  }`}
                                >
                                  {s.rank}
                                </span>
                                <span className={`flex-1 truncate ${isHuman ? 'font-bold text-violeta' : 'text-ink'}`}>
                                  {s.name}
                                </span>
                                <span className="font-mono text-[11px] font-semibold text-ink">{s.points}</span>
                                <span className="w-9 text-right font-mono text-[10px] text-ink2/60">{s.goalsFor}:{s.goalsAgainst}</span>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ===== Llave (bracket en columnas por ronda) ===== */}
              {!ovLoading && overview && activeTab === 'BRACKET' && (
                hasBracket ? (
                  (() => {
                    const presentRounds = KO_ROUNDS.filter((r) => overview.knockoutMatches.some((m) => m.round === r))
                    const mostRecent = presentRounds[presentRounds.length - 1]
                    const orderedRounds = [...presentRounds].reverse() // más reciente arriba
                    const humanEntryIds = overview.humans.map((h) => h.entryId)
                    return (
                      <div className="mt-4 space-y-3">
                        <h2 className="font-slab text-lg uppercase tracking-wide text-ink">Eliminatorias</h2>
                        <div className="space-y-4">
                          {orderedRounds.map((round) => {
                            const roundMatches = overview.knockoutMatches.filter((m) => m.round === round)
                            const scoresShown = roundMatches[0].showScores
                            const isCurrent = round === mostRecent
                            return (
                              <div
                                key={round}
                                className={`rounded-2xl border-2 p-3 ${isCurrent ? 'border-violeta bg-violeta/[0.04] shadow-hardsm' : 'border-ink/15 bg-bone/50'}`}
                              >
                                <div className="mb-2 flex items-center gap-2">
                                  <p className={`font-slab text-sm uppercase tracking-wide ${isCurrent ? 'text-violeta' : 'text-ink'}`}>
                                    {KO_ROUND_LABEL[round]}
                                  </p>
                                  {!scoresShown && (
                                    <span className="rounded bg-celeste/20 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wide text-celeste">Cruces</span>
                                  )}
                                  {isCurrent && scoresShown && (
                                    <span className="rounded bg-violeta/15 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wide text-violeta">Última ronda</span>
                                  )}
                                  <span className="ml-auto font-mono text-[9px] uppercase tracking-wide text-ink2/40">
                                    {roundMatches.length} {roundMatches.length === 1 ? 'partido' : 'partidos'}
                                  </span>
                                </div>
                                <div className="space-y-2">
                                  {roundMatches.map((m) => (
                                    <BracketMatch key={m.id} match={m} myEntryId={overview.myEntryId} humanEntryIds={humanEntryIds} flash={flashId === `match-${m.id}`} />
                                  ))}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()
                ) : (
                  <div className="mt-4 rounded-2xl border-2 border-dashed border-ink/30 bg-bone/60 p-8 text-center">
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink2">
                      Las eliminatorias arrancan cuando termine la fase de grupos.
                    </p>
                  </div>
                )
              )}

              {ovError && <p className="mt-4 text-center text-sm font-semibold text-vermillion">{ovError}</p>}
            </section>
          </div>
        )}
      </div>

      {/* ===== Barra de acción inferior sticky (mobile) ===== */}
      {revealIdx >= 0 && (
        <div className="sticky bottom-0 z-30 border-t-2 border-ink/80 bg-paper/95 px-5 py-3 backdrop-blur lg:hidden">
          <Controls
            isHost={isHost}
            isFinished={isFinished}
            revealIdx={revealIdx}
            advancing={advancing}
            revealingAll={revealingAll}
            restarting={restarting}
            ovLoading={ovLoading}
            overview={overview}
            onAdvance={advance}
            onRevealAll={revealAll}
            onRestart={restart}
            compact
          />
        </div>
      )}

      {/* Confetti dorado al revelarse el campeón (para todos los participantes) */}
      {isFinished && overview?.championName && (
        <GoldenConfetti />
      )}
    </main>
  )
}

// ===== Chip de estado propio (header) =====
function MyStatusChip({ run, revealIdx, isFinished }: { run: HumanRunEntry | null; revealIdx: number; isFinished: boolean }) {
  if (!run) return null
  if (run.status === 'CHAMPION') {
    return <span className="shrink-0 rounded-full border-2 border-gold bg-gold/10 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-gold">🏆 Campeón</span>
  }
  if (run.status === 'ELIMINATED') {
    return <span className="shrink-0 rounded-full border-2 border-line bg-paper2 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-ink2/70">Eliminado · {KO_ROUND_FULL[run.reachedRound] ?? run.reachedRound.toLowerCase()}</span>
  }
  return <span className="shrink-0 rounded-full border-2 border-grass bg-grass/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-grassdark">{isFinished ? 'En carrera' : `Seguís · ${currentRoundName(revealIdx)}`}</span>
}

// ===== Stepper de las 6 fases =====
function StageStepper({ revealIdx, isFinished }: { revealIdx: number; isFinished: boolean }) {
  // Fase "actual" = la última cuyo startIdx ya fue alcanzado.
  let currentPhase = -1
  PHASES.forEach((p, i) => { if (revealIdx >= p.startIdx) currentPhase = i })

  return (
    <div className="flex items-center gap-1 sm:gap-1.5">
      {PHASES.map((p, i) => {
        const isLast = i === PHASES.length - 1
        let stStatus: 'done' | 'current' | 'locked'
        if (currentPhase < 0 || i > currentPhase) stStatus = 'locked'
        else if (i < currentPhase) stStatus = 'done'
        else stStatus = isLast && isFinished ? 'done' : 'current'

        return (
          <div key={p.label} className="flex flex-1 items-center gap-1 sm:gap-1.5">
            <div className="flex min-w-0 flex-col items-center gap-1">
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 font-mono text-[9px] font-bold transition ${
                  stStatus === 'done'
                    ? 'border-grass bg-grass text-white'
                    : stStatus === 'current'
                    ? 'border-violeta bg-violeta text-white shadow-hardsm'
                    : 'border-line bg-bone text-ink2/40'
                }`}
              >
                {stStatus === 'done' ? '✓' : p.short}
              </span>
              <span
                className={`hidden truncate text-center font-mono text-[9px] uppercase tracking-[0.1em] sm:block ${
                  stStatus === 'current' ? 'font-bold text-violeta' : stStatus === 'done' ? 'text-grassdark' : 'text-ink2/40'
                }`}
              >
                {p.label}
              </span>
            </div>
            {!isLast && (
              <div className={`h-0.5 flex-1 rounded-full ${i < currentPhase ? 'bg-grass' : 'bg-line'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ===== Card "Tu situación" =====
function MySituationCard({
  run,
  revealIdx,
  aliveCount,
  totalHumans,
  topScorer,
  lastResult,
}: {
  run: HumanRunEntry | null
  revealIdx: number
  aliveCount: number
  totalHumans: number
  topScorer: { name: string; goals: number } | null
  lastResult: MyLastResult | null
}) {
  return (
    <div className="rounded-2xl border-2 border-ink bg-bone p-4 shadow-hardsm">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink2">Tu situación</p>
      {run ? (
        <div className="mt-2">
          {run.status === 'CHAMPION' && <p className="font-slab text-2xl text-gold">🏆 ¡Campeón!</p>}
          {run.status === 'ALIVE' && (
            <>
              <p className="font-slab text-2xl text-grassdark">En carrera</p>
              <p className="mt-0.5 text-xs text-ink2">Tu equipo sigue vivo en {currentRoundName(revealIdx)}.</p>
            </>
          )}
          {run.status === 'ELIMINATED' && (
            <>
              <p className="font-slab text-2xl text-ink2/70">Eliminado</p>
              <p className="mt-0.5 text-xs text-ink2">Quedaste afuera en {KO_ROUND_FULL[run.reachedRound] ?? run.reachedRound.toLowerCase()}.</p>
            </>
          )}
        </div>
      ) : (
        <p className="mt-2 text-xs text-ink2">No estás participando con un equipo en este Mundial.</p>
      )}

      {lastResult && (
        <div className="mt-3 border-t-2 border-ink/10 pt-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink2">
            Tu último partido · {lastResult.roundLabel}
          </p>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span
              className={`shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.06em] ${
                lastResult.won ? 'text-grassdark' : lastResult.draw ? 'text-ink2' : 'text-vermillion'
              }`}
            >
              {lastResult.won ? 'Ganó' : lastResult.draw ? 'Empató' : 'Perdió'}
            </span>
            <span className="font-slab text-lg leading-none text-ink">
              {lastResult.myScore} – {lastResult.oppScore}
              {lastResult.penalties && (
                <span className="ml-1 font-mono text-[11px] font-semibold text-ink2">
                  (pen. {lastResult.penalties.mine}–{lastResult.penalties.theirs})
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1 truncate text-right text-xs text-ink2">vs {lastResult.oppName}</span>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2 border-t-2 border-ink/10 pt-3">
        <span className="rounded-full border border-line bg-paper2 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ink2">
          {aliveCount}/{totalHumans} en carrera
        </span>
        {topScorer && (
          <span className="rounded-full border border-line bg-paper2 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ink2">
            ⚽ {topScorer.name} ({topScorer.goals})
          </span>
        )}
      </div>
    </div>
  )
}

// ===== Tablero de participantes =====
function ParticipantBoard({
  humans,
  nameByEntry,
  compact,
}: {
  humans: HumanRunEntry[]
  nameByEntry: Map<string, string>
  compact?: boolean
}) {
  return (
    <ul className="space-y-1.5">
      {humans.map((h, i) => {
        const eliminator = h.eliminatedByEntryId ? nameByEntry.get(h.eliminatedByEntryId) : null
        return (
          <li
            key={h.entryId}
            className={`flex items-center gap-2 rounded-lg border-2 px-2.5 py-2 ${
              h.isMe ? 'border-violeta bg-violeta/5' : 'border-line bg-paper2'
            }`}
          >
            <span className="w-4 shrink-0 text-center font-mono text-[11px] text-ink2/50">{i + 1}</span>
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                h.status === 'CHAMPION' ? 'bg-gold' : h.status === 'ELIMINATED' ? 'bg-ink2/25' : 'bg-grass'
              }`}
            />
            <div className="min-w-0 flex-1">
              <p
                className={`truncate text-sm font-bold ${
                  h.status === 'CHAMPION' ? 'text-gold' : h.status === 'ELIMINATED' ? 'text-ink2/60' : 'text-ink'
                }`}
              >
                {h.nickname}
                {h.isMe && <span className="ml-1 font-mono text-[9px] uppercase tracking-[0.12em] text-violeta">vos</span>}
              </p>
              {!compact && h.status === 'ELIMINATED' && eliminator && (
                <p className="truncate font-mono text-[9px] text-ink2/50">vs {eliminator}</p>
              )}
            </div>
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em]">
              {h.status === 'CHAMPION' && <span className="font-bold text-gold">Campeón</span>}
              {h.status === 'ALIVE' && <span className="text-grassdark">En carrera</span>}
              {h.status === 'ELIMINATED' && (
                <span className="text-ink2/55">{KO_ROUND_FULL[h.reachedRound] ?? h.reachedRound.toLowerCase()}</span>
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

// ===== Controles (avanzar / simular todo / reiniciar / card / salir) =====
type ControlsProps = {
  isHost: boolean
  isFinished: boolean
  revealIdx: number
  advancing: boolean
  revealingAll: boolean
  restarting: boolean
  ovLoading: boolean
  overview: RoomTournamentOverview | null
  onAdvance: () => void
  onRevealAll: () => void
  onRestart: () => void
  compact?: boolean
}

function Controls({
  isHost,
  isFinished,
  revealIdx,
  advancing,
  revealingAll,
  restarting,
  ovLoading,
  overview,
  onAdvance,
  onRevealAll,
  onRestart,
  compact,
}: ControlsProps) {
  return (
    <div className="space-y-2.5">
      {isHost && !isFinished && (
        <>
          <button
            onClick={onAdvance}
            disabled={advancing || revealingAll || ovLoading}
            className="w-full rounded-xl border-2 border-ink bg-gradient-to-r from-celeste to-violeta px-5 py-3.5 font-slab text-base uppercase tracking-wide text-white shadow-hardsm transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {advancing ? 'Avanzando…' : nextStageLabel(revealIdx)}
          </button>
          {!compact && (
            <button
              onClick={onRevealAll}
              disabled={advancing || revealingAll || ovLoading}
              className="w-full rounded-xl border-2 border-ink bg-bone px-5 py-2.5 font-mono text-xs uppercase tracking-[0.18em] text-ink shadow-hardsm transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {revealingAll ? 'Revelando…' : '⏭ Simular todo el Mundial'}
            </button>
          )}
        </>
      )}
      {!isHost && !isFinished && !compact && (
        <p className="text-center font-mono text-[11px] uppercase tracking-[0.14em] text-ink2">
          Esperando al host para avanzar de fase…
        </p>
      )}

      {isFinished && overview?.myEntryId && overview.tournamentId && (
        <a
          href={`/tournament/${overview.tournamentId}/room-card?entry=${overview.myEntryId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full rounded-xl border-2 border-ink bg-bone px-5 py-2.5 text-center font-mono text-xs uppercase tracking-[0.18em] text-ink shadow-hardsm transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
        >
          Ver mi card
        </a>
      )}
      {isFinished && isHost && (
        <button
          onClick={onRestart}
          disabled={restarting}
          className="w-full rounded-xl border-2 border-ink bg-gradient-to-r from-celeste to-violeta px-5 py-3.5 font-slab text-base uppercase tracking-wide text-white shadow-hardsm transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {restarting ? 'Reiniciando…' : '↺ Jugar de nuevo'}
        </button>
      )}
      {isFinished && !isHost && !compact && (
        <p className="text-center font-mono text-[11px] uppercase tracking-[0.14em] text-ink2">
          Esperando que el host reinicie la sala…
        </p>
      )}

      {!compact && (
        <div className="pt-1 text-center">
          <a href="/multiplayer" className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink2 underline-offset-2 hover:underline">
            ← Salir de la sala
          </a>
        </div>
      )}
    </div>
  )
}

// ===== Tarjeta de partido en la llave =====
function BracketMatch({
  match: m,
  myEntryId,
  humanEntryIds,
  flash,
}: {
  match: RoomTournamentOverview['knockoutMatches'][number]
  myEntryId: string | null
  humanEntryIds: string[]
  flash?: boolean
}) {
  const humanSet = new Set(humanEntryIds)
  const homeIsHuman = humanSet.has(m.homeEntryId)
  const awayIsHuman = humanSet.has(m.awayEntryId)
  const homeWon = m.showScores && m.winnerId === m.homeEntryId
  const awayWon = m.showScores && m.winnerId === m.awayEntryId
  const isMyMatch = myEntryId != null && (m.homeEntryId === myEntryId || m.awayEntryId === myEntryId)
  const borderClass = isMyMatch ? 'border-violeta' : homeIsHuman || awayIsHuman ? 'border-celeste' : 'border-ink'

  return (
    <div
      id={`match-${m.id}`}
      className={`scroll-mt-32 rounded-lg border-2 px-3 py-2 shadow-hardsm bg-bone ${borderClass} ${flash ? 'animate-flashPulse' : ''}`}
    >
      {m.isHumanDerby && (
        <span className="mb-1 inline-block rounded bg-gradient-to-r from-celeste to-violeta px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wide text-white">
          Derby
        </span>
      )}
      <div className="flex items-center gap-2 text-sm">
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
        <div className="shrink-0 text-center">
          {m.showScores ? (
            <>
              <span className="font-slab text-ink">{m.homeScore} – {m.awayScore}</span>
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
  const homeGoalEvents = events.filter((e) => e.type === 'PENALTY_GOAL' && e.side === 'HOME')
  const awayGoalEvents = events.filter((e) => e.type === 'PENALTY_GOAL' && e.side === 'AWAY')

  const total = Math.max(homePenalties, awayPenalties, 5)

  return (
    <div className="mt-2 rounded-lg border border-ink/10 bg-paper/60 px-3 py-2">
      <p className="mb-1.5 text-center font-mono text-[9px] uppercase tracking-[0.2em] text-ink2/60">
        Tanda de penales
      </p>
      <div className="flex items-center gap-3">
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

        <div className="shrink-0 text-center">
          <span className={`font-slab text-xl ${homeWon ? 'text-grass' : 'text-vermillion'}`}>
            {homePenalties}
          </span>
          <span className="font-slab text-ink2/50"> – </span>
          <span className={`font-slab text-xl ${!homeWon ? 'text-grass' : 'text-vermillion'}`}>
            {awayPenalties}
          </span>
        </div>

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
