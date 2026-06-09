import Link from 'next/link'

import { getOrCreateSessionToken } from '@/lib/draft/session-token'
import { getSingleplayerTournamentOverview } from '@/lib/tournaments/overview'
import { ClientTournament } from '@/features/tournament/components/client-tournament'

export default async function TournamentPage() {
  const sessionToken = await getOrCreateSessionToken()
  const tournament = await getSingleplayerTournamentOverview(sessionToken)

  return (
    <main className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 -z-10 h-[28rem] bg-pitch blur-3xl" />

      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-8 sm:px-8 lg:px-10">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-card backdrop-blur">
            <p className="font-mono text-xs uppercase tracking-[0.32em] text-cyan/90">Centro del torneo</p>
            <h1 className="mt-4 text-5xl font-semibold leading-none">Tu camino al titulo empieza aca.</h1>
            <p className="mt-6 max-w-3xl text-base leading-7 text-sand/75">
              Cuando cerras tu draft, tu seleccion entra a un Mundial de 48 equipos: 12 grupos de 4,
              noches de tension y cruces directos desde dieciseisavos. Esta sala va a ser el lugar
              donde sigas cada paso rumbo a la final.
            </p>

            {tournament && (
              <ClientTournament tournament={tournament} />
            )}

            {!tournament && (
              <div className="mt-8 rounded-3xl border border-dashed border-white/15 bg-white/5 p-6 text-sm leading-7 text-sand/65">
                Termina una seleccion en el draft para ver tus grupos y el calendario del Mundial.
              </div>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/draft"
                className="rounded-full bg-sand px-5 py-3 font-mono text-xs uppercase tracking-[0.28em] text-night transition hover:bg-white"
              >
                Volver al draft
              </Link>
            </div>
          </section>

          <aside className="rounded-[2rem] border border-white/10 bg-[#0d1728]/88 p-8 shadow-card backdrop-blur">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-ember">Que vas a vivir</p>
            <div className="mt-6 space-y-4">
              <article className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <h2 className="text-xl font-semibold">Tabla viva</h2>
                <p className="mt-2 text-sm leading-6 text-sand/70">
                  Seguis posiciones, diferencia de gol y el pulso de cada grupo en tiempo real.
                </p>
              </article>
              <article className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <h2 className="text-xl font-semibold">Cruces directos</h2>
                <p className="mt-2 text-sm leading-6 text-sand/70">
                  Despues de grupos, cada noche se convierte en una final sin vuelta atras.
                </p>
              </article>
              <article className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <h2 className="text-xl font-semibold">Relato de campana</h2>
                <p className="mt-2 text-sm leading-6 text-sand/70">
                  Tu equipo no es solo una lista: es una historia que se construye partido a partido.
                </p>
              </article>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
