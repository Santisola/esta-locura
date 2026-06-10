import Link from 'next/link'

import { getSessionTokenReadOnly } from '@/lib/draft/session-token'
import { getUserTournamentHistory } from '@/lib/tournaments/history'

function formatDate(iso: string | null) {
  if (!iso) return ''
  try {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso))
  } catch {
    return ''
  }
}

export default async function HistorialPage() {
  const sessionToken = await getSessionTokenReadOnly()
  const history = sessionToken ? await getUserTournamentHistory(sessionToken) : []
  const titles = history.filter((h) => h.isChampion).length

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto w-full max-w-[720px] px-4 py-8 sm:px-6">
        <header className="flex items-end justify-between gap-4 border-b-2 border-ink/80 pb-5">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink2">Historial</p>
            <h1 className="mt-2 font-slab text-5xl leading-none tracking-tight text-ink sm:text-6xl">Tus campañas</h1>
            {history.length > 0 && (
              <p className="mt-3 font-mono text-xs uppercase tracking-[0.16em] text-ink2">
                {history.length} {history.length === 1 ? 'Mundial' : 'Mundiales'}
                {titles > 0 && <> · <span className="text-gold">{titles} {titles === 1 ? 'título' : 'títulos'}</span></>}
              </p>
            )}
          </div>
          <Link
            href="/draft"
            className="rounded-xl bg-vermillion px-5 py-3 font-slab text-base uppercase tracking-wide text-bone shadow-hardsm transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
          >
            Jugar
          </Link>
        </header>

        <div className="mt-7 space-y-3">
          {history.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-ink/30 bg-bone p-8 text-center text-sm leading-7 text-ink2">
              Todavía no jugaste ningún Mundial. Armá tu selección y llegá hasta la final.
              <div className="mt-5">
                <Link href="/draft" className="rounded-xl bg-vermillion px-6 py-3 font-slab text-base uppercase tracking-wide text-bone shadow-hardsm">
                  Empezar →
                </Link>
              </div>
            </div>
          )}

          {history.map((item) => (
            <article
              key={item.tournamentId}
              className={`flex items-center justify-between gap-4 rounded-2xl border-2 px-5 py-4 shadow-hardsm ${
                item.isChampion ? 'border-ink bg-ink text-paper' : 'border-ink bg-bone text-ink'
              }`}
            >
              <div className="min-w-0">
                <p className={`font-slab text-xl uppercase tracking-wide ${item.isChampion ? 'text-gold' : 'text-ink'}`}>
                  {item.outcomeLabel}
                </p>
                <p className={`mt-1 text-sm ${item.isChampion ? 'text-paper/70' : 'text-ink2'}`}>
                  {item.isChampion ? 'Levantaste la copa' : <>Campeón: {item.championName ?? '—'}</>}
                </p>
              </div>
              <p className={`shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] ${item.isChampion ? 'text-paper/60' : 'text-ink2'}`}>
                {formatDate(item.playedAt)}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-10">
          <Link href="/" className="font-mono text-xs uppercase tracking-[0.2em] text-ink2 underline-offset-4 hover:underline">
            ← Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  )
}
