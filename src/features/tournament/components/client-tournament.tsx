'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import type { TournamentOverview } from '@/lib/tournaments/overview'

const ROUND_LABELS: Record<string, string> = {
  ROUND_OF_32: 'Dieciseisavos de final',
  ROUND_OF_16: 'Octavos de final',
  QUARTER_FINAL: 'Cuartos de final',
  SEMI_FINAL: 'Semifinal',
  FINAL: 'Final',
}

function ScoreBlock({ home, away, homePenalties, awayPenalties, wentToPenalties }: {
  home: number; away: number; homePenalties?: number | null; awayPenalties?: number | null; wentToPenalties?: boolean
}) {
  const isDraw = home === away
  return (
    <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
      <span className={`text-2xl font-extrabold ${home > away ? 'text-sand' : isDraw && home > 0 ? 'text-sand' : home === 0 && away === 0 ? 'text-sand/50' : 'text-sand/50'}`}>{home}</span>
      <span className="text-lg text-sand/30">–</span>
      <span className={`text-2xl font-extrabold ${away > home ? 'text-sand' : isDraw && away > 0 ? 'text-sand' : away === 0 && home === 0 ? 'text-sand/50' : 'text-sand/50'}`}>{away}</span>
      {wentToPenalties && homePenalties != null && awayPenalties != null && (
        <span className="ml-1 text-xs text-sand/45">({homePenalties}–{awayPenalties}) p</span>
      )}
    </span>
  )
}

function SimulateButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handle() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/tournaments/simulate', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error.'); setLoading(false); return }
      router.refresh()
    } catch { setError('Error de conexion.'); setLoading(false) }
  }

  return (
    <div className="text-center">
      <div className="mx-auto max-w-lg space-y-4">
        <p className="text-lg font-semibold">Todo listo para el pitido inicial</p>
        <p className="text-sm leading-6 text-sand/60">
          Los 48 equipos estan en sus grupos. Cuando quieras, el simulador resuelve cada partido
          con los datos reales de tu armado. No hay marcha atras: esto es lo que construiste.
        </p>
      </div>
      <button onClick={handle} disabled={loading}
        className="mt-6 rounded-full bg-gradient-to-r from-cyan to-emerald px-10 py-4 font-mono text-sm font-semibold uppercase tracking-[0.28em] text-night transition hover:scale-[1.02] disabled:opacity-50">
        {loading ? 'Simulando...' : 'Pitar el inicio'}
      </button>
      {error && <p className="mt-3 text-sm text-red/80">{error}</p>}
    </div>
  )
}

function MatchCard({ homeName, awayName, homeScore, awayScore, homePenalties, awayPenalties, wentToPenalties, isHuman, label }: {
  homeName: string; awayName: string; homeScore: number; awayScore: number
  homePenalties?: number | null; awayPenalties?: number | null; wentToPenalties?: boolean
  isHuman?: boolean; label?: string
}) {
  return (
    <div className={`rounded-2xl border px-5 py-4 transition ${
      isHuman
        ? 'border-cyan/40 bg-cyan/8 shadow-[0_0_20px_-8px_rgba(0,200,200,0.15)]'
        : 'border-white/10 bg-white/5'
    }`}>
      {label && <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-sand/40">{label}</p>}
      <div className="flex items-center justify-between gap-4">
        <div className={`flex-1 min-w-0 ${isHuman ? 'text-left' : ''}`}>
          <p className={`truncate text-base ${homeScore > awayScore ? 'font-bold text-sand' : 'text-sand/60'}`}>{homeName}</p>
        </div>
        <ScoreBlock home={homeScore} away={awayScore} homePenalties={homePenalties} awayPenalties={awayPenalties} wentToPenalties={wentToPenalties} />
        <div className={`flex-1 min-w-0 ${isHuman ? 'text-right' : 'text-right'}`}>
          <p className={`truncate text-base ${awayScore > homeScore ? 'font-bold text-sand' : 'text-sand/60'}`}>{awayName}</p>
        </div>
      </div>
    </div>
  )
}

function GroupStandingsTable({ standings, humanEntryId }: {
  standings: TournamentOverview['groups'][number]['standings']
  humanEntryId: string | null
}) {
  const advancers = standings.filter((s) => s.rank <= 2)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 font-mono text-xs uppercase tracking-[0.15em] text-sand/40">
            <th className="px-2 py-2 w-8">#</th>
            <th className="px-2 py-2">Equipo</th>
            <th className="px-2 py-2 text-center w-8">PJ</th>
            <th className="px-2 py-2 text-center w-8">G</th>
            <th className="px-2 py-2 text-center w-8">E</th>
            <th className="px-2 py-2 text-center w-8">P</th>
            <th className="px-2 py-2 text-center w-8">GF</th>
            <th className="px-2 py-2 text-center w-8">GC</th>
            <th className="px-2 py-2 text-center w-10">DG</th>
            <th className="px-2 py-2 text-right w-10 font-bold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s) => (
            <tr key={s.entryId}
              className={`border-b border-white/5 transition ${
                s.entryId === humanEntryId ? 'bg-cyan/8' : advancers.find((a) => a.entryId === s.entryId) ? 'bg-emerald/5' : ''
              }`}>
              <td className="px-2 py-2.5 font-mono text-xs text-sand/40">{s.rank}</td>
              <td className="px-2 py-2.5 font-medium">
                {s.name}
                {s.entryId === humanEntryId && <span className="ml-2 text-xs text-cyan/80">Tu equipo</span>}
                {s.entryId !== humanEntryId && advancers.find((a) => a.entryId === s.entryId) && <span className="ml-2 text-xs text-emerald/60">Clasificado</span>}
              </td>
              <td className="px-2 py-2.5 text-center font-mono text-xs">{s.played}</td>
              <td className="px-2 py-2.5 text-center font-mono text-xs">{s.wins}</td>
              <td className="px-2 py-2.5 text-center font-mono text-xs">{s.draws}</td>
              <td className="px-2 py-2.5 text-center font-mono text-xs">{s.losses}</td>
              <td className="px-2 py-2.5 text-center font-mono text-xs">{s.goalsFor}</td>
              <td className="px-2 py-2.5 text-center font-mono text-xs">{s.goalsAgainst}</td>
              <td className={`px-2 py-2.5 text-center font-mono text-xs ${
                s.goalDifference > 0 ? 'text-emerald' : s.goalDifference < 0 ? 'text-red' : ''
              }`}>{s.goalDifference > 0 ? `+${s.goalDifference}` : s.goalDifference}</td>
              <td className="px-2 py-2.5 text-right font-mono text-sm font-bold">{s.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function HumanGroupMatches({ fixtures, humanEntryId }: {
  fixtures: TournamentOverview['groups'][number]['fixtures']
  humanEntryId: string
}) {
  const humanMatches = fixtures.filter((m) => m.homeEntryId === humanEntryId || m.awayEntryId === humanEntryId)

  const finished = humanMatches.filter((m) => m.status === 'FINISHED')
  if (finished.length === 0) return null

  return (
    <div className="space-y-3">
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-cyan/85">Tus resultados</p>
      {finished.map((m, i) => (
        <MatchCard key={m.id}
          homeName={m.homeName} awayName={m.awayName}
          homeScore={m.homeScore} awayScore={m.awayScore}
          homePenalties={m.homePenalties} awayPenalties={m.awayPenalties}
          wentToPenalties={m.wentToPenalties}
          isHuman
          label={`Partido ${i + 1}`}
        />
      ))}
    </div>
  )
}

function HumanKnockoutMatches({ knockoutMatches, humanEntryId }: {
  knockoutMatches: TournamentOverview['knockoutMatches']
  humanEntryId: string
}) {
  const rounds = ['ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL'] as const

  return (
    <div className="mt-10 space-y-10">
      {rounds.map((round) => {
        const roundMatches = knockoutMatches.filter((m) => m.round === round)
        if (roundMatches.length === 0) return null

        const humanMatch = roundMatches.find((m) => m.homeEntryId === humanEntryId || m.awayEntryId === humanEntryId)

        const label = ROUND_LABELS[round] ?? round

        return (
          <div key={round}>
            <div className="mb-4 flex items-center gap-3">
              <span className="h-px flex-1 bg-white/10" />
              <span className="font-mono text-xs uppercase tracking-[0.28em] text-ember/85">{label}</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            {humanMatch && (
              <div className="mb-4">
                <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-cyan/70">Tu cruce</p>
                <MatchCard
                  homeName={humanMatch.homeName} awayName={humanMatch.awayName}
                  homeScore={humanMatch.homeScore} awayScore={humanMatch.awayScore}
                  homePenalties={humanMatch.homePenalties} awayPenalties={humanMatch.awayPenalties}
                  wentToPenalties={humanMatch.wentToPenalties}
                  isHuman
                />
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {roundMatches
                .filter((m) => !(humanMatch && m.id === humanMatch.id))
                .map((m) => (
                  <MatchCard key={m.id}
                    homeName={m.homeName} awayName={m.awayName}
                    homeScore={m.homeScore} awayScore={m.awayScore}
                    homePenalties={m.homePenalties} awayPenalties={m.awayPenalties}
                    wentToPenalties={m.wentToPenalties}
                  />
                ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ChampionSection({ name }: { name: string }) {
  return (
    <div className="mt-10 overflow-hidden rounded-[2rem] border border-amber/30 bg-gradient-to-br from-amber/10 via-night to-amber/5 p-10 text-center shadow-[0_0_60px_-20px_rgba(255,200,50,0.15)]">
      <p className="font-mono text-xs uppercase tracking-[0.4em] text-amber/70">Campeon del mundo</p>
      <h2 className="mt-4 text-5xl font-bold tracking-tight text-amber">{name}</h2>
      <p className="mt-4 text-base text-sand/60">Esta locura quedo en la historia.</p>
    </div>
  )
}

export function ClientTournament({ tournament }: { tournament: TournamentOverview }) {
  const humanId = tournament.humanEntryId

  return (
    <>
      {tournament.championName && <ChampionSection name={tournament.championName} />}

      {!tournament.isSimulated && (
        <div className="mt-8">
          <SimulateButton />
        </div>
      )}

      {tournament.isSimulated && (
        <div className="mt-8 space-y-12">
          {/* Fase de grupos — resultados humanos */}
          <div>
            <div className="mb-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-white/10" />
              <span className="font-mono text-xs uppercase tracking-[0.32em] text-cyan/80">Fase de grupos</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <div className="grid gap-6">
              {tournament.groups.map((group) => {
                const isHumanGroup = group.entries.some((e) => e.id === humanId)
                return (
                  <article key={group.code}
                    className={`rounded-3xl border p-6 ${
                      isHumanGroup
                        ? 'border-cyan/20 bg-cyan/5 shadow-[0_0_30px_-12px_rgba(0,200,200,0.08)]'
                        : 'border-white/10 bg-night/60'
                    }`}>
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <h3 className="text-xl font-semibold">
                        Grupo {group.code}
                        {isHumanGroup && <span className="ml-3 font-mono text-xs uppercase tracking-[0.18em] text-cyan/70">Tu grupo</span>}
                      </h3>
                      <span className="rounded-full border border-white/10 px-3 py-1 font-mono text-xs text-sand/50">{group.entries.length} equipos</span>
                    </div>

                    {isHumanGroup && humanId && (
                      <div className="mb-5">
                        <HumanGroupMatches fixtures={group.fixtures} humanEntryId={humanId} />
                      </div>
                    )}

                    <GroupStandingsTable standings={group.standings} humanEntryId={humanId} />
                  </article>
                )
              })}
            </div>
          </div>

          {/* Fase eliminatoria */}
          {tournament.knockoutMatches.length > 0 && (
            <div>
              <div className="mb-6 flex items-center gap-3">
                <span className="h-px flex-1 bg-white/10" />
                <span className="font-mono text-xs uppercase tracking-[0.32em] text-ember/80">Fase eliminatoria</span>
                <span className="h-px flex-1 bg-white/10" />
              </div>

              <HumanKnockoutMatches knockoutMatches={tournament.knockoutMatches} humanEntryId={humanId ?? ''} />
            </div>
          )}

          <div className="flex justify-center gap-4">
            <Link href="/draft"
              className="rounded-full border border-white/15 px-6 py-3 font-mono text-xs uppercase tracking-[0.25em] text-sand/60 transition hover:border-white/30">
              Volver al draft
            </Link>
          </div>
        </div>
      )}
    </>
  )
}
