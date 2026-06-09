'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { TournamentOverview } from '@/lib/tournaments/overview'

const ROUND_LABELS: Record<string, string> = {
  ROUND_OF_32: 'Dieciseisavos de final',
  ROUND_OF_16: 'Octavos de final',
  QUARTER_FINAL: 'Cuartos de final',
  SEMI_FINAL: 'Semifinal',
  FINAL: 'Final',
}

const KO_ROUNDS = ['ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL'] as const

// Parsea la respuesta como JSON de forma segura. Si el server devuelve HTML
// (404/500), evita el error cripto "Unexpected token '<'" y retorna null.
async function readJsonSafe<T>(res: Response): Promise<T | null> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Vista normalizada de un partido (unifica fixtures de grupo y cruces KO).
// ---------------------------------------------------------------------------
type MatchEvent = { minute: number; type: string; side: string; playerName: string | null }

type MatchView = {
  id: string
  homeName: string
  awayName: string
  homeScore: number
  awayScore: number
  homePenalties?: number | null
  awayPenalties?: number | null
  wentToPenalties?: boolean
  homeEntryId: string
  awayEntryId: string
  winnerEntryId: string | null
  events: MatchEvent[]
}

type Fixture = TournamentOverview['groups'][number]['fixtures'][number]
type KoMatch = TournamentOverview['knockoutMatches'][number]

function fixtureToView(m: Fixture): MatchView {
  return {
    id: m.id,
    homeName: m.homeName,
    awayName: m.awayName,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    homePenalties: m.homePenalties,
    awayPenalties: m.awayPenalties,
    wentToPenalties: m.wentToPenalties,
    homeEntryId: m.homeEntryId,
    awayEntryId: m.awayEntryId,
    winnerEntryId: m.winnerEntryId,
    events: m.events ?? [],
  }
}

function koToView(m: KoMatch): MatchView {
  return {
    id: m.id,
    homeName: m.homeName,
    awayName: m.awayName,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    homePenalties: m.homePenalties,
    awayPenalties: m.awayPenalties,
    wentToPenalties: m.wentToPenalties,
    homeEntryId: m.homeEntryId,
    awayEntryId: m.awayEntryId,
    winnerEntryId: m.winnerId,
    events: [],
  }
}

function isHumanStrong(match: MatchView, side: 'home' | 'away') {
  const entryId = side === 'home' ? match.homeEntryId : match.awayEntryId
  if (match.winnerEntryId) return match.winnerEntryId === entryId
  return side === 'home' ? match.homeScore > match.awayScore : match.awayScore > match.homeScore
}

// ---------------------------------------------------------------------------
// Piezas visuales
// ---------------------------------------------------------------------------
function ScoreBlock({ home, away, homePenalties, awayPenalties, wentToPenalties, big }: {
  home: number; away: number; homePenalties?: number | null; awayPenalties?: number | null
  wentToPenalties?: boolean; big?: boolean
}) {
  const size = big ? 'text-4xl' : 'text-2xl'
  return (
    <span className="inline-flex flex-col items-center gap-0.5">
      <span className="inline-flex items-center gap-2 font-mono tabular-nums">
        <span className={`${size} font-extrabold ${home >= away ? 'text-sand' : 'text-sand/45'}`}>{home}</span>
        <span className="text-lg text-sand/30">–</span>
        <span className={`${size} font-extrabold ${away >= home ? 'text-sand' : 'text-sand/45'}`}>{away}</span>
      </span>
      {wentToPenalties && homePenalties != null && awayPenalties != null && (
        <span className="text-xs text-sand/45">Penales {homePenalties}–{awayPenalties}</span>
      )}
    </span>
  )
}

// Fila de partido para resúmenes: nombres completos, sin recortar.
function SummaryMatch({ match }: { match: MatchView }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <p className={`flex-1 text-right text-sm leading-tight ${isHumanStrong(match, 'home') ? 'font-bold text-sand' : 'text-sand/60'}`}>
        {match.homeName}
      </p>
      <ScoreBlock
        home={match.homeScore} away={match.awayScore}
        homePenalties={match.homePenalties} awayPenalties={match.awayPenalties}
        wentToPenalties={match.wentToPenalties}
      />
      <p className={`flex-1 text-left text-sm leading-tight ${isHumanStrong(match, 'away') ? 'font-bold text-sand' : 'text-sand/60'}`}>
        {match.awayName}
      </p>
    </div>
  )
}

// Partido destacado (los del usuario): grande, con veredicto y goleadores.
function FeaturedMatch({ match, humanEntryId, headline, sub, isKnockout }: {
  match: MatchView; humanEntryId: string; headline: string; sub?: string; isKnockout: boolean
}) {
  const humanHome = match.homeEntryId === humanEntryId
  const us = humanHome ? match.homeScore : match.awayScore
  const them = humanHome ? match.awayScore : match.homeScore

  let verdict: { label: string; cls: string }
  if (isKnockout) {
    verdict = match.winnerEntryId === humanEntryId
      ? { label: 'Avanzás de ronda', cls: 'border-emerald/40 bg-emerald/10 text-emerald' }
      : { label: 'Tu camino termina acá', cls: 'border-red/40 bg-red/10 text-red' }
  } else if (us > them) {
    verdict = { label: 'Victoria', cls: 'border-emerald/40 bg-emerald/10 text-emerald' }
  } else if (us === them) {
    verdict = { label: 'Empate', cls: 'border-amber/40 bg-amber/10 text-amber' }
  } else {
    verdict = { label: 'Derrota', cls: 'border-red/40 bg-red/10 text-red' }
  }

  const goals = match.events.filter((e) => e.type === 'GOAL' || e.type === 'PENALTY_GOAL')

  return (
    <div className="rounded-3xl border border-cyan/40 bg-cyan/8 p-6 shadow-[0_0_30px_-12px_rgba(0,200,200,0.18)]">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-cyan/85">{headline}</p>
        {sub && <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-sand/40">{sub}</span>}
      </div>

      <div className="mt-5 flex items-center justify-between gap-4">
        <p className={`flex-1 text-right text-lg font-semibold leading-tight ${isHumanStrong(match, 'home') ? 'text-sand' : 'text-sand/55'}`}>
          {match.homeName}
        </p>
        <ScoreBlock
          home={match.homeScore} away={match.awayScore}
          homePenalties={match.homePenalties} awayPenalties={match.awayPenalties}
          wentToPenalties={match.wentToPenalties} big
        />
        <p className={`flex-1 text-left text-lg font-semibold leading-tight ${isHumanStrong(match, 'away') ? 'text-sand' : 'text-sand/55'}`}>
          {match.awayName}
        </p>
      </div>

      <div className="mt-5 flex items-center justify-center">
        <span className={`rounded-full border px-4 py-1 font-mono text-xs uppercase tracking-[0.2em] ${verdict.cls}`}>
          {verdict.label}
        </span>
      </div>

      {goals.length > 0 && (
        <div className="mt-5 grid gap-1.5 border-t border-white/10 pt-4 text-sm">
          {goals
            .slice()
            .sort((a, b) => a.minute - b.minute)
            .map((g, i) => (
              <div key={`${g.minute}-${i}`} className="flex items-center gap-2 text-sand/70">
                <span className="w-9 font-mono text-xs text-sand/45">{g.minute}'</span>
                <span>⚽</span>
                <span>{g.playerName ?? 'Gol'}</span>
                <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-sand/35">
                  {g.side === 'HOME' ? match.homeName : g.side === 'AWAY' ? match.awayName : ''}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

function StandingsTable({ standings, humanEntryId, dense }: {
  standings: TournamentOverview['groups'][number]['standings']
  humanEntryId: string | null
  dense?: boolean
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 font-mono text-xs uppercase tracking-[0.15em] text-sand/40">
            <th className="px-2 py-2 w-8">#</th>
            <th className="px-2 py-2">Equipo</th>
            {!dense && <>
              <th className="px-2 py-2 text-center w-8">PJ</th>
              <th className="px-2 py-2 text-center w-8">G</th>
              <th className="px-2 py-2 text-center w-8">E</th>
              <th className="px-2 py-2 text-center w-8">P</th>
              <th className="px-2 py-2 text-center w-10">DG</th>
            </>}
            <th className="px-2 py-2 text-right w-10 font-bold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s) => {
            const advances = s.rank <= 2
            return (
              <tr key={s.entryId}
                className={`border-b border-white/5 ${
                  s.entryId === humanEntryId ? 'bg-cyan/10' : advances ? 'bg-emerald/5' : ''
                }`}>
                <td className="px-2 py-2 font-mono text-xs text-sand/40">{s.rank}</td>
                <td className="px-2 py-2 font-medium">
                  {s.name}
                  {s.entryId === humanEntryId && <span className="ml-2 text-xs text-cyan/80">Tu equipo</span>}
                </td>
                {!dense && <>
                  <td className="px-2 py-2 text-center font-mono text-xs">{s.played}</td>
                  <td className="px-2 py-2 text-center font-mono text-xs">{s.wins}</td>
                  <td className="px-2 py-2 text-center font-mono text-xs">{s.draws}</td>
                  <td className="px-2 py-2 text-center font-mono text-xs">{s.losses}</td>
                  <td className={`px-2 py-2 text-center font-mono text-xs ${s.goalDifference > 0 ? 'text-emerald' : s.goalDifference < 0 ? 'text-red' : ''}`}>
                    {s.goalDifference > 0 ? `+${s.goalDifference}` : s.goalDifference}
                  </td>
                </>}
                <td className="px-2 py-2 text-right font-mono text-sm font-bold">{s.points}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SceneDivider({ label, tone = 'cyan' }: { label: string; tone?: 'cyan' | 'ember' | 'amber' }) {
  const color = tone === 'ember' ? 'text-ember/85' : tone === 'amber' ? 'text-amber/80' : 'text-cyan/80'
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-white/10" />
      <span className={`font-mono text-xs uppercase tracking-[0.28em] ${color}`}>{label}</span>
      <span className="h-px flex-1 bg-white/10" />
    </div>
  )
}

const KO_ORDER: Record<string, number> = {
  ROUND_OF_32: 1,
  ROUND_OF_16: 2,
  QUARTER_FINAL: 3,
  SEMI_FINAL: 4,
  FINAL: 5,
}

// Calcula el desenlace del equipo del usuario y sus goles a lo largo del Mundial.
function computeHumanRun(tournament: TournamentOverview) {
  const id = tournament.humanEntryId
  if (!id) return null

  const isChampion = tournament.championEntryId === id
  const humanMatches = [
    ...tournament.groups.flatMap((g) => g.fixtures),
    ...tournament.knockoutMatches,
  ].filter((m) => m.homeEntryId === id || m.awayEntryId === id)

  let goalsFor = 0
  let goalsAgainst = 0
  for (const m of humanMatches) {
    const home = m.homeEntryId === id
    goalsFor += home ? m.homeScore : m.awayScore
    goalsAgainst += home ? m.awayScore : m.homeScore
  }

  let outcomeLabel = 'Eliminado en fase de grupos'
  if (isChampion) {
    outcomeLabel = 'Campeón del mundo'
  } else {
    const ko = tournament.knockoutMatches.filter((m) => m.homeEntryId === id || m.awayEntryId === id)
    if (ko.length > 0) {
      const furthest = ko.reduce((best, m) =>
        (KO_ORDER[m.round] ?? 0) > (KO_ORDER[best.round] ?? 0) ? m : best,
      )
      outcomeLabel = `Eliminado en ${ROUND_LABELS[furthest.round] ?? furthest.round}`
    }
  }

  return { isChampion, outcomeLabel, goalsFor, goalsAgainst }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-4">
      <p className="truncate text-lg font-bold text-sand">{value}</p>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.15em] text-sand/45">{label}</p>
    </div>
  )
}

function ResultCard({ tournament }: { tournament: TournamentOverview }) {
  const [copied, setCopied] = useState(false)
  const run = computeHumanRun(tournament)
  if (!run) return null

  const humanName =
    tournament.groups.flatMap((g) => g.entries).find((e) => e.id === tournament.humanEntryId)?.name ??
    'Tu Selección'
  const cardUrl = `/tournament/${tournament.tournamentId}/card`

  async function share() {
    const text = run!.isChampion
      ? `¡Salí campeón del mundo con ${humanName} en Esta Locura!`
      : `${run!.outcomeLabel} con ${humanName} en Esta Locura.`
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

  const scorer = tournament.topScorer
  const scorerShort = scorer ? `${scorer.name.split(' ').slice(-1)[0]} ${scorer.goals}` : '—'

  return (
    <div
      className={`overflow-hidden rounded-[2rem] border p-8 text-center ${
        run.isChampion
          ? 'border-amber/30 bg-gradient-to-br from-amber/10 via-night to-amber/5 shadow-[0_0_60px_-20px_rgba(255,200,50,0.15)]'
          : 'border-white/10 bg-night/60'
      }`}
    >
      <p
        className={`font-mono text-xs uppercase tracking-[0.4em] ${
          run.isChampion ? 'text-amber/70' : 'text-cyan/80'
        }`}
      >
        Final del Mundial
      </p>
      <h2
        className={`mt-4 text-4xl font-bold tracking-tight sm:text-5xl ${
          run.isChampion ? 'text-amber' : 'text-sand'
        }`}
      >
        {run.isChampion ? '🏆 Campeón del mundo' : run.outcomeLabel}
      </h2>
      <p className="mt-2 text-lg font-semibold text-sand/80">{humanName}</p>
      {!run.isChampion && tournament.championName && (
        <p className="mt-1 text-sm text-sand/55">Campeón del torneo: {tournament.championName}</p>
      )}

      <div className="mx-auto mt-7 grid max-w-md grid-cols-3 gap-3">
        <Stat label="A favor" value={String(run.goalsFor)} />
        <Stat label="En contra" value={String(run.goalsAgainst)} />
        <Stat label="Goleador" value={scorerShort} />
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          onClick={share}
          className="rounded-full bg-gradient-to-r from-cyan to-emerald px-6 py-3 font-mono text-xs font-semibold uppercase tracking-[0.22em] text-night transition hover:scale-[1.02]"
        >
          {copied ? '¡Link copiado!' : 'Compartir'}
        </button>
        <a
          href={cardUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-white/15 px-6 py-3 font-mono text-xs uppercase tracking-[0.22em] text-sand/70 transition hover:border-white/30"
        >
          Ver imagen
        </a>
        <Link
          href="/historial"
          className="rounded-full border border-white/15 px-6 py-3 font-mono text-xs uppercase tracking-[0.22em] text-sand/70 transition hover:border-white/30"
        >
          Historial
        </Link>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Construcción de escenas (reproducción partido a partido)
// ---------------------------------------------------------------------------
type Scene =
  | { key: string; kind: 'group-match'; match: MatchView; ordinal: number }
  | { key: string; kind: 'group-summary' }
  | { key: string; kind: 'ko-match'; round: string; match: MatchView }
  | { key: string; kind: 'ko-summary'; round: string }
  | { key: string; kind: 'champion'; name: string }

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export function ClientTournament({ tournament }: { tournament: TournamentOverview }) {
  const router = useRouter()
  const humanId = tournament.humanEntryId

  const userGroup = useMemo(
    () => tournament.groups.find((g) => g.entries.some((e) => e.id === humanId)) ?? null,
    [tournament.groups, humanId],
  )
  const otherGroups = useMemo(
    () => tournament.groups.filter((g) => g !== userGroup),
    [tournament.groups, userGroup],
  )

  const scenes = useMemo<Scene[]>(() => {
    const list: Scene[] = []
    if (!humanId) return list

    const userGroupMatches = (userGroup?.fixtures ?? [])
      .filter((m) => m.homeEntryId === humanId || m.awayEntryId === humanId)
      .sort((a, b) => a.stageOrder - b.stageOrder)
      .map(fixtureToView)

    userGroupMatches.forEach((match, i) =>
      list.push({ key: `gm-${match.id}`, kind: 'group-match', match, ordinal: i + 1 }),
    )
    list.push({ key: 'group-summary', kind: 'group-summary' })

    for (const round of KO_ROUNDS) {
      const roundMatches = tournament.knockoutMatches.filter((m) => m.round === round)
      if (roundMatches.length === 0) continue
      const userMatch = roundMatches.find((m) => m.homeEntryId === humanId || m.awayEntryId === humanId)
      if (userMatch) list.push({ key: `kom-${userMatch.id}`, kind: 'ko-match', round, match: koToView(userMatch) })
      list.push({ key: `kos-${round}`, kind: 'ko-summary', round })
    }

    if (tournament.championName) {
      list.push({ key: 'champion', kind: 'champion', name: tournament.championName })
    }
    return list
  }, [tournament, userGroup, humanId])

  const storageKey = `esta-locura.tournament-playback.${tournament.tournamentId}`
  const [revealed, setRevealed] = useState(0)
  const [hydrated, setHydrated] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const feedEndRef = useRef<HTMLDivElement | null>(null)

  // Hidrata el progreso de reproducción una sola vez. Sin registro previo →
  // 0 (muestra el preview "Tu grupo"). Con registro → retoma donde quedó.
  useEffect(() => {
    if (hydrated) return
    const saved = window.localStorage.getItem(storageKey)
    setRevealed(saved ? Math.min(Math.max(Number(saved) || 0, 0), scenes.length) : 0)
    setHydrated(true)
  }, [hydrated, storageKey, scenes.length])

  // Persiste el progreso.
  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(storageKey, String(revealed))
  }, [revealed, hydrated, storageKey])

  // Auto-scroll al último contenido revelado.
  useEffect(() => {
    if (revealed > 0) feedEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [revealed])

  async function startTournament() {
    // Torneos nuevos ya vienen simulados: iniciar la reproducción es instantáneo.
    if (tournament.isSimulated) {
      window.localStorage.setItem(storageKey, '1')
      setRevealed(1)
      return
    }

    // Fallback para torneos viejos (creados antes de simular en la creación).
    setStarting(true)
    setError(null)
    try {
      const res = await fetch('/api/tournaments/simulate', { method: 'POST' })
      const data = await readJsonSafe<{ error?: string }>(res)
      if (!res.ok || !data) {
        setError(data?.error ?? `No se pudo iniciar el Mundial (error ${res.status}).`)
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

  // Evita el flash de preview antes de leer el progreso guardado.
  if (!hydrated) {
    return <div className="mt-8 flex justify-center"><p className="text-sm text-sand/50">Cargando tu Mundial...</p></div>
  }

  // -------- Estado previo: el usuario todavía no arrancó la reproducción --------
  if (revealed === 0) {
    return (
      <div className="mt-8 space-y-6">
        <SceneDivider label="Tu grupo" />
        {userGroup ? (
          <article className="rounded-3xl border border-cyan/20 bg-cyan/5 p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-xl font-semibold">Grupo {userGroup.code}</h3>
              <span className="rounded-full border border-white/10 px-3 py-1 font-mono text-xs text-sand/50">
                {userGroup.entries.length} equipos
              </span>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {userGroup.entries.map((e) => (
                <li key={e.id}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                    e.id === humanId ? 'border-cyan/40 bg-cyan/10' : 'border-white/10 bg-white/5'
                  }`}>
                  <span className="font-medium">
                    {e.name}
                    {e.id === humanId && <span className="ml-2 text-xs text-cyan/80">Tu equipo</span>}
                  </span>
                  <span className="font-mono text-xs text-sand/50">OVR {e.ovr}</span>
                </li>
              ))}
            </ul>
          </article>
        ) : (
          <p className="text-sm text-sand/60">Termina tu draft para ver tu grupo.</p>
        )}

        <div className="text-center">
          <p className="mx-auto max-w-lg text-sm leading-6 text-sand/60">
            Cuando estés listo, arranca el Mundial y seguí tu camino partido a partido:
            primero tus partidos de grupo, después cada ronda eliminatoria.
          </p>
          <button onClick={startTournament} disabled={starting}
            className="mt-6 rounded-full bg-gradient-to-r from-cyan to-emerald px-10 py-4 font-mono text-sm font-semibold uppercase tracking-[0.28em] text-night transition hover:scale-[1.02] disabled:opacity-50">
            {starting ? 'Preparando...' : 'Iniciar el Mundial'}
          </button>
          {error && <p className="mt-3 text-sm text-red/80">{error}</p>}
        </div>
      </div>
    )
  }

  // -------- Reproducción partido a partido --------
  const visible = scenes.slice(0, revealed)
  const allRevealed = revealed >= scenes.length

  return (
    <div className="mt-8 space-y-6">
      {visible.map((scene) => {
        if (scene.kind === 'group-match') {
          return (
            <FeaturedMatch key={scene.key}
              match={scene.match} humanEntryId={humanId ?? ''}
              headline={`Fase de grupos · Partido ${scene.ordinal}`}
              sub={userGroup ? `Grupo ${userGroup.code}` : undefined}
              isKnockout={false}
            />
          )
        }

        if (scene.kind === 'group-summary') {
          return (
            <div key={scene.key} className="space-y-6">
              <SceneDivider label="Resumen · Fase de grupos" />
              {userGroup && (
                <article className="rounded-3xl border border-cyan/20 bg-cyan/5 p-6">
                  <h3 className="mb-4 text-xl font-semibold">
                    Tu grupo {userGroup.code}
                    <span className="ml-3 font-mono text-xs uppercase tracking-[0.18em] text-cyan/70">Posiciones finales</span>
                  </h3>
                  <StandingsTable standings={userGroup.standings} humanEntryId={humanId} />
                </article>
              )}
              {otherGroups.length > 0 && (
                <div>
                  <p className="mb-3 font-mono text-xs uppercase tracking-[0.22em] text-sand/45">El resto del Mundial</p>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {otherGroups.map((g) => (
                      <article key={g.code} className="rounded-2xl border border-white/10 bg-night/60 p-4">
                        <h4 className="mb-2 text-sm font-semibold text-sand/80">Grupo {g.code}</h4>
                        <StandingsTable standings={g.standings} humanEntryId={humanId} dense />
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        }

        if (scene.kind === 'ko-match') {
          return (
            <FeaturedMatch key={scene.key}
              match={scene.match} humanEntryId={humanId ?? ''}
              headline={`Tu cruce · ${ROUND_LABELS[scene.round] ?? scene.round}`}
              isKnockout
            />
          )
        }

        if (scene.kind === 'ko-summary') {
          const roundMatches = tournament.knockoutMatches
            .filter((m) => m.round === scene.round)
            .sort((a, b) => a.order - b.order)
            .map(koToView)
          return (
            <div key={scene.key} className="space-y-4">
              <SceneDivider label={`Resumen · ${ROUND_LABELS[scene.round] ?? scene.round}`} tone="ember" />
              <div className="grid gap-2 md:grid-cols-2">
                {roundMatches.map((m) => (
                  <SummaryMatch key={m.id} match={m} />
                ))}
              </div>
            </div>
          )
        }

        if (scene.kind === 'champion') {
          return <ResultCard key={scene.key} tournament={tournament} />
        }

        return null
      })}

      <div ref={feedEndRef} />

      {/* Controles */}
      <div className="flex flex-col items-center gap-3 pt-2">
        {!allRevealed ? (
          <button onClick={() => setRevealed((r) => Math.min(r + 1, scenes.length))}
            className="rounded-full bg-gradient-to-r from-cyan to-emerald px-10 py-4 font-mono text-sm font-semibold uppercase tracking-[0.28em] text-night transition hover:scale-[1.02]">
            Continuar
          </button>
        ) : (
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/draft"
              className="rounded-full border border-white/15 px-6 py-3 font-mono text-xs uppercase tracking-[0.25em] text-sand/60 transition hover:border-white/30">
              Volver al draft
            </Link>
          </div>
        )}
        {!allRevealed && (
          <button onClick={() => setRevealed(scenes.length)}
            className="font-mono text-[11px] uppercase tracking-[0.2em] text-sand/40 transition hover:text-sand/70">
            Ver todo el resumen
          </button>
        )}
      </div>
    </div>
  )
}
