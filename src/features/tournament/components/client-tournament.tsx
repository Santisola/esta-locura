'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { TournamentOverview } from '@/lib/tournaments/overview'

const KO_ORDER: Record<string, number> = {
  GROUP: 0,
  ROUND_OF_32: 1,
  ROUND_OF_16: 2,
  QUARTER_FINAL: 3,
  SEMI_FINAL: 4,
  FINAL: 5,
}

const STAGE_LABEL: Record<string, string> = {
  GROUP: 'Grupos',
  ROUND_OF_32: 'Dieciseisavos',
  ROUND_OF_16: 'Octavos',
  QUARTER_FINAL: 'Cuartos',
  SEMI_FINAL: 'Semis',
  FINAL: 'Final',
}

async function readJsonSafe<T>(res: Response): Promise<T | null> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

type CampMatch = {
  id: string
  stage: string
  opponent: string
  us: number
  them: number
  result: 'W' | 'D' | 'L'
  wentToPenalties: boolean
  pen: string | null
  scorers: string[]
  conceded: string[]
}

function buildHumanMatches(tournament: TournamentOverview): CampMatch[] {
  const id = tournament.humanEntryId
  if (!id) return []

  const list: CampMatch[] = []

  const userGroup = tournament.groups.find((g) => g.entries.some((e) => e.id === id))
  const groupFixtures = (userGroup?.fixtures ?? [])
    .filter((m) => m.homeEntryId === id || m.awayEntryId === id)
    .sort((a, b) => a.stageOrder - b.stageOrder)

  const toMatch = (m: {
    id: string
    round: string
    homeEntryId: string
    awayEntryId: string
    homeName: string
    awayName: string
    homeScore: number
    awayScore: number
    homePenalties?: number | null
    awayPenalties?: number | null
    wentToPenalties?: boolean
    winnerId?: string | null
    winnerEntryId?: string | null
    events: Array<{ type: string; side: string; playerName: string | null }>
  }): CampMatch => {
    const humanIsHome = m.homeEntryId === id
    const us = humanIsHome ? m.homeScore : m.awayScore
    const them = humanIsHome ? m.awayScore : m.homeScore
    const oursSide = humanIsHome ? 'HOME' : 'AWAY'
    const goals = m.events.filter((e) => e.type === 'GOAL' || e.type === 'PENALTY_GOAL')
    const scorers = goals.filter((e) => e.side === oursSide).map((e) => e.playerName).filter((n): n is string => Boolean(n))
    const conceded = goals.filter((e) => e.side !== oursSide && e.side !== 'NEUTRAL').map((e) => e.playerName).filter((n): n is string => Boolean(n))
    const winner = m.winnerId ?? m.winnerEntryId ?? null
    let result: 'W' | 'D' | 'L'
    if (winner) result = winner === id ? 'W' : 'L'
    else result = us > them ? 'W' : us === them ? 'D' : 'L'
    const pen =
      m.wentToPenalties && m.homePenalties != null && m.awayPenalties != null
        ? `${humanIsHome ? m.homePenalties : m.awayPenalties}-${humanIsHome ? m.awayPenalties : m.homePenalties}`
        : null
    return {
      id: m.id,
      stage: STAGE_LABEL[m.round] ?? m.round,
      opponent: humanIsHome ? m.awayName : m.homeName,
      us,
      them,
      result,
      wentToPenalties: Boolean(m.wentToPenalties),
      pen,
      scorers,
      conceded,
    }
  }

  for (const f of groupFixtures) list.push(toMatch(f))

  const koRounds = ['ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL']
  const koHuman = tournament.knockoutMatches
    .filter((m) => m.homeEntryId === id || m.awayEntryId === id)
    .sort((a, b) => (KO_ORDER[a.round] ?? 0) - (KO_ORDER[b.round] ?? 0))
  for (const m of koHuman) {
    if (koRounds.includes(m.round)) list.push(toMatch(m))
  }

  return list
}

// ---------------------------------------------------------------------------
function MatchRow({ m, dim }: { m: CampMatch; dim?: boolean }) {
  const tone = m.result === 'W' ? 'text-grass' : m.result === 'L' ? 'text-vermillion' : 'text-ink'
  const mark = m.result === 'W' ? '✓' : m.result === 'L' ? '✗' : '–'
  return (
    <div className={`flex items-center gap-4 border-b-2 border-ink/10 bg-bone px-5 py-4 ${dim ? 'opacity-0' : ''}`}>
      <div className="w-20 shrink-0">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink2">{m.stage}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-slab text-lg leading-tight tracking-wide text-ink">{m.opponent}</p>
        <p className="mt-0.5 truncate text-xs text-ink2">
          {m.scorers.length > 0 && <><span className="font-mono uppercase tracking-wide text-ink2/70">Goles </span>{m.scorers.join(', ')}</>}
          {m.scorers.length > 0 && m.conceded.length > 0 && ' · '}
          {m.conceded.length > 0 && <><span className="font-mono uppercase tracking-wide text-ink2/70">Recibió </span>{m.conceded.join(', ')}</>}
          {m.scorers.length === 0 && m.conceded.length === 0 && 'Sin goles'}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={`font-slab text-2xl tracking-wide ${tone}`}>
          {m.us}<span className="mx-0.5 text-ink2">–</span>{m.them}
        </span>
        {m.pen && <span className="font-mono text-[10px] uppercase text-ink2">{m.pen} pen</span>}
        <span className={`w-4 text-center text-lg ${tone}`}>{mark}</span>
      </div>
    </div>
  )
}

function SummaryCard({ tournament, matches }: { tournament: TournamentOverview; matches: CampMatch[] }) {
  const [copied, setCopied] = useState(false)
  const wins = matches.filter((m) => m.result === 'W').length
  const losses = matches.filter((m) => m.result === 'L').length
  const gf = matches.reduce((s, m) => s + m.us, 0)
  const gc = matches.reduce((s, m) => s + m.them, 0)
  const isChampion = tournament.championEntryId === tournament.humanEntryId
  const cardUrl = `/tournament/${tournament.tournamentId}/card`

  async function share() {
    const text = isChampion
      ? '¡Salí campeón del mundo en Esta Locura!'
      : `Mi campaña en Esta Locura: ${wins}-${losses}.`
    const url = `${window.location.origin}${cardUrl}`
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: 'Esta Locura', text, url })
        return
      }
    } catch {
      return
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border-2 border-ink bg-ink p-7 text-paper shadow-hardsm">
        {isChampion && (
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.3em] text-gold">🏆 Campeón del mundo</p>
        )}
        <div className="flex items-center gap-7">
          <p className="font-slab text-7xl leading-none">
            {wins}<span className="text-vermillion">-</span>{losses}
          </p>
          <div className="grid grid-cols-3 gap-x-7 gap-y-1">
            <Metric value={gf} label="Goles a favor" />
            <Metric value={gc} label="En contra" />
            <Metric value={wins} label="Victorias" />
          </div>
        </div>
        {tournament.topScorer && (
          <p className="mt-4 border-t border-white/10 pt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-paper/60">
            Goleador del torneo · <span className="text-paper">{tournament.topScorer.name}</span> ({tournament.topScorer.goals})
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/draft"
          className="rounded-xl border-2 border-ink bg-bone px-5 py-3 font-mono text-xs uppercase tracking-[0.2em] text-ink shadow-hardsm transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
        >
          ↻ Repetir
        </Link>
        <button
          onClick={share}
          className="rounded-xl bg-vermillion px-6 py-3 font-slab text-base uppercase tracking-wide text-bone shadow-hardsm transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
        >
          {copied ? '¡Link copiado!' : 'Compartir →'}
        </button>
        <a
          href={cardUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border-2 border-ink bg-bone px-5 py-3 font-mono text-xs uppercase tracking-[0.2em] text-ink shadow-hardsm transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
        >
          Ver mi card
        </a>
      </div>
    </div>
  )
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="font-slab text-2xl leading-none text-gold">{value}</p>
      <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-paper/55">{label}</p>
    </div>
  )
}

function WorldDetail({ tournament }: { tournament: TournamentOverview }) {
  const humanId = tournament.humanEntryId
  return (
    <details className="group rounded-2xl border-2 border-ink bg-bone shadow-hardsm">
      <summary className="cursor-pointer list-none px-5 py-4 font-slab text-lg uppercase tracking-wide text-ink">
        El resto del Mundial <span className="float-right font-mono text-sm text-ink2 group-open:rotate-180">▾</span>
      </summary>
      <div className="space-y-6 border-t-2 border-ink/10 px-5 py-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {tournament.groups.map((g) => (
            <div key={g.code} className="rounded-xl border border-line bg-paper2 p-3">
              <p className="mb-2 font-slab text-sm uppercase tracking-wide text-ink">Grupo {g.code}</p>
              <ul className="space-y-1">
                {g.standings.map((s) => (
                  <li
                    key={s.entryId}
                    className={`flex items-center justify-between text-xs ${s.entryId === humanId ? 'font-bold text-vermillion' : s.rank <= 2 ? 'text-ink' : 'text-ink2'}`}
                  >
                    <span className="truncate">{s.rank}. {s.name}</span>
                    <span className="ml-2 shrink-0 font-mono">{s.points} pts</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </details>
  )
}

// ---------------------------------------------------------------------------
export function ClientTournament({ tournament }: { tournament: TournamentOverview }) {
  const router = useRouter()
  const humanId = tournament.humanEntryId

  const userGroup = useMemo(
    () => tournament.groups.find((g) => g.entries.some((e) => e.id === humanId)) ?? null,
    [tournament.groups, humanId],
  )
  const humanMatches = useMemo(() => buildHumanMatches(tournament), [tournament])

  const storageKey = `esta-locura.campaign.${tournament.tournamentId}`
  const [revealed, setRevealed] = useState(0)
  const [hydrated, setHydrated] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const feedEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (hydrated) return
    const saved = window.localStorage.getItem(storageKey)
    setRevealed(saved ? Math.min(Math.max(Number(saved) || 0, 0), humanMatches.length) : 0)
    setHydrated(true)
  }, [hydrated, storageKey, humanMatches.length])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(storageKey, String(revealed))
  }, [revealed, hydrated, storageKey])

  useEffect(() => {
    if (revealed > 0) feedEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [revealed])

  async function start() {
    if (tournament.isSimulated) {
      window.localStorage.setItem(storageKey, '1')
      setRevealed(1)
      return
    }
    setStarting(true)
    setError(null)
    try {
      const res = await fetch('/api/tournaments/simulate', { method: 'POST' })
      const data = await readJsonSafe<{ error?: string }>(res)
      if (!res.ok || !data) {
        setError(data?.error ?? `No se pudo iniciar (error ${res.status}).`)
        setStarting(false)
        return
      }
      window.localStorage.setItem(storageKey, '1')
      setRevealed(1)
      setHydrated(true)
      router.refresh()
    } catch {
      setError('Error de conexión.')
      setStarting(false)
    }
  }

  if (!hydrated) {
    return <div className="py-16 text-center font-mono text-sm uppercase tracking-[0.3em] text-ink2">Cargando tu campaña...</div>
  }

  // -------- Preview: la campaña no arrancó --------
  if (revealed === 0) {
    return (
      <div className="space-y-6">
        {userGroup ? (
          <div className="rounded-2xl border-2 border-ink bg-bone p-6 shadow-hardsm">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink2">Tu grupo {userGroup.code}</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {userGroup.entries.map((e) => (
                <li
                  key={e.id}
                  className={`flex items-center justify-between rounded-lg border-2 px-4 py-3 ${e.id === humanId ? 'border-ink bg-ink text-paper' : 'border-line bg-paper2 text-ink'}`}
                >
                  <span className="font-slab tracking-wide">{e.name}</span>
                  <span className="font-mono text-xs opacity-70">OVR {e.ovr}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-ink2">Terminá tu draft para ver tu grupo.</p>
        )}

        <div className="text-center">
          <button
            onClick={start}
            disabled={starting}
            className="rounded-2xl border-2 border-ink bg-gradient-to-r from-celeste to-violeta px-12 py-5 font-slab text-2xl uppercase tracking-wide text-white shadow-hard transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none disabled:opacity-50"
          >
            {starting ? 'Preparando...' : 'Iniciar el Mundial →'}
          </button>
          {error && <p className="mt-3 font-mono text-sm text-vermillion">{error}</p>}
        </div>
      </div>
    )
  }

  // -------- Reproducción de la campaña --------
  const allRevealed = revealed >= humanMatches.length
  const visible = humanMatches.slice(0, revealed)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => setRevealed((r) => Math.min(r + 1, humanMatches.length))}
          disabled={allRevealed}
          className={`rounded-lg border-2 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] transition ${
            allRevealed ? 'border-line text-ink2/50' : 'border-ink bg-bone text-ink hover:bg-ink hover:text-paper'
          }`}
        >
          Partido a partido
        </button>
        <button
          onClick={() => setRevealed(humanMatches.length)}
          className={`rounded-lg border-2 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] transition ${
            allRevealed ? 'border-ink bg-ink text-paper' : 'border-ink bg-bone text-ink hover:bg-ink hover:text-paper'
          }`}
        >
          Automático
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border-2 border-ink shadow-hardsm">
        {visible.map((m) => (
          <MatchRow key={m.id} m={m} />
        ))}
      </div>

      <div ref={feedEndRef} />

      {!allRevealed ? (
        <div className="text-center">
          <button
            onClick={() => setRevealed((r) => Math.min(r + 1, humanMatches.length))}
            className="rounded-2xl border-2 border-ink bg-gradient-to-r from-celeste to-violeta px-12 py-5 font-slab text-xl uppercase tracking-wide text-white shadow-hard transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
          >
            Siguiente partido →
          </button>
        </div>
      ) : (
        <>
          <SummaryCard tournament={tournament} matches={humanMatches} />
          <WorldDetail tournament={tournament} />
        </>
      )}
    </div>
  )
}
