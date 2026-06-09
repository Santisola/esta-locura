import Link from 'next/link'

import { getOrCreateSessionToken } from '@/lib/draft/session-token'
import { getUserTournamentHistory } from '@/lib/tournaments/history'

function formatDate(iso: string | null) {
  if (!iso) return ''
  try {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return ''
  }
}

export default async function HistorialPage() {
  const sessionToken = await getOrCreateSessionToken()
  const history = await getUserTournamentHistory(sessionToken)

  const titles = history.filter((h) => h.isChampion).length

  return (
    <main className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 -z-10 h-[28rem] bg-pitch blur-3xl" />

      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-5 py-10 sm:px-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.32em] text-cyan/90">Historial</p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">Tus campañas</h1>
          </div>
          <Link
            href="/draft"
            className="rounded-full bg-sand px-5 py-3 font-mono text-xs uppercase tracking-[0.25em] text-night transition hover:bg-white"
          >
            Jugar
          </Link>
        </div>

        {history.length > 0 && (
          <p className="mt-4 text-sm text-sand/60">
            {history.length} {history.length === 1 ? 'Mundial jugado' : 'Mundiales jugados'}
            {titles > 0 && <> · <span className="text-amber">{titles} {titles === 1 ? 'título' : 'títulos'}</span></>}
          </p>
        )}

        <div className="mt-8 space-y-3">
          {history.length === 0 && (
            <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-8 text-center text-sm leading-7 text-sand/65">
              Todavía no jugaste ningún Mundial. Armá tu seleccion en el draft y llegá hasta la final.
              <div className="mt-5">
                <Link
                  href="/draft"
                  className="rounded-full bg-gradient-to-r from-cyan to-emerald px-6 py-3 font-mono text-xs font-semibold uppercase tracking-[0.25em] text-night"
                >
                  Empezar
                </Link>
              </div>
            </div>
          )}

          {history.map((item) => (
            <article
              key={item.tournamentId}
              className={`flex items-center justify-between gap-4 rounded-2xl border px-5 py-4 ${
                item.isChampion ? 'border-amber/30 bg-amber/5' : 'border-white/10 bg-night/60'
              }`}
            >
              <div className="min-w-0">
                <p className={`font-semibold ${item.isChampion ? 'text-amber' : 'text-sand'}`}>
                  {item.outcomeLabel}
                </p>
                <p className="mt-1 text-sm text-sand/55">
                  {item.isChampion ? (
                    'Levantaste la copa'
                  ) : (
                    <>Campeón: <span className="text-sand/80">{item.championName ?? '—'}</span></>
                  )}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-sand/45">
                  {formatDate(item.playedAt)}
                </p>
                {item.isChampion && <p className="mt-1 text-lg">🏆</p>}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <Link
            href="/"
            className="rounded-full border border-white/15 px-6 py-3 font-mono text-xs uppercase tracking-[0.25em] text-sand/60 transition hover:border-white/30"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  )
}
