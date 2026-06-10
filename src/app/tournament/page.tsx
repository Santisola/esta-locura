import Link from 'next/link'

import { getSessionTokenReadOnly } from '@/lib/draft/session-token'
import { getSingleplayerTournamentOverview } from '@/lib/tournaments/overview'
import { ClientTournament } from '@/features/tournament/components/client-tournament'

export default async function TournamentPage() {
  const sessionToken = await getSessionTokenReadOnly()
  const tournament = sessionToken ? await getSingleplayerTournamentOverview(sessionToken) : null

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto w-full max-w-[760px] px-4 py-8 sm:px-6">
        <header className="border-b-2 border-ink/80 pb-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink2">La campaña · Mundial 2026</p>
              <h1 className="mt-2 font-slab text-5xl leading-none tracking-tight text-ink sm:text-6xl">La campaña</h1>
            </div>
            <Link
              href="/draft"
              className="rounded-full border-2 border-ink bg-bone px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink shadow-hardsm transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
            >
              Al draft
            </Link>
          </div>
        </header>

        <div className="mt-7">
          {tournament ? (
            <ClientTournament tournament={tournament} />
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-ink/30 bg-bone p-8 text-center text-sm leading-7 text-ink2">
              Terminá una selección en el draft para ver tu grupo y arrancar el Mundial.
              <div className="mt-5">
                <Link
                  href="/draft"
                  className="rounded-xl bg-vermillion px-6 py-3 font-slab text-base uppercase tracking-wide text-bone shadow-hardsm"
                >
                  Ir al draft →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
