import Link from 'next/link'

import { getOrCreateSessionToken } from '@/lib/draft/session-token'
import { getSingleplayerTournamentOverview } from '@/lib/tournaments/overview'

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
            <h1 className="mt-4 text-5xl font-semibold leading-none">Tu camino al título empieza acá.</h1>
            <p className="mt-6 max-w-3xl text-base leading-7 text-sand/75">
              Cuando cerrás tu draft, tu selección entra a un Mundial de 48 equipos: 12 grupos de 4,
              noches de tensión y cruces directos desde dieciseisavos. Esta sala va a ser el lugar
              donde sigas cada paso rumbo a la final.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <article className="rounded-3xl border border-white/10 bg-night/60 p-5">
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-cyan/85">Fase de grupos</p>
                <p className="mt-3 text-2xl font-semibold">12 grupos</p>
                <p className="mt-2 text-sm leading-6 text-sand/65">Cada punto vale oro desde el primer partido.</p>
              </article>
              <article className="rounded-3xl border border-white/10 bg-night/60 p-5">
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-cyan/85">Mata-mata</p>
                <p className="mt-3 text-2xl font-semibold">Dieciseisavos</p>
                <p className="mt-2 text-sm leading-6 text-sand/65">No hay margen: seguís o te volvés a casa.</p>
              </article>
              <article className="rounded-3xl border border-white/10 bg-night/60 p-5">
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-cyan/85">Objetivo</p>
                <p className="mt-3 text-2xl font-semibold">Levantar la copa</p>
                <p className="mt-2 text-sm leading-6 text-sand/65">Tu once ideal se mide contra todo el planeta.</p>
              </article>
            </div>

            {tournament ? (
              <div className="mt-8 space-y-6">
                <div className="rounded-3xl border border-white/10 bg-night/60 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.22em] text-cyan/85">Tu Mundial</p>
                      <h2 className="mt-2 text-2xl font-semibold">Fase de grupos en marcha</h2>
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm text-sand/65">
                      <span className="rounded-full border border-white/10 px-3 py-1">{tournament.groups.length} grupos</span>
                      <span className="rounded-full border border-white/10 px-3 py-1">Ronda actual: {tournament.currentRound ?? 'GROUP'}</span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  {tournament.groups.map((group) => (
                    <article key={group.code} className="rounded-3xl border border-white/10 bg-night/60 p-5">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-2xl font-semibold">Grupo {group.code}</h3>
                        <span className="font-mono text-xs uppercase tracking-[0.22em] text-cyan/85">
                          {group.entries.length} selecciones
                        </span>
                      </div>

                      <div className="mt-4 space-y-3">
                        {group.entries.map((entry, index) => (
                          <div key={entry.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-xs uppercase tracking-[0.2em] text-sand/45">{index + 1}</span>
                              <div>
                                <p className="text-base font-semibold">{entry.name}</p>
                                <p className="text-xs text-sand/55">
                                  {entry.type === 'HUMAN_DRAFTED' ? 'Tu selección' : 'Rival del Mundial'}
                                </p>
                              </div>
                            </div>
                            <span className="rounded-full border border-cyan/20 px-3 py-1 font-mono text-xs uppercase tracking-[0.2em] text-cyan/85">
                              OVR {entry.ovr}
                            </span>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>

                <div className="rounded-3xl border border-white/10 bg-night/60 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-2xl font-semibold">Primeros cruces de grupos</h2>
                    <span className="font-mono text-xs uppercase tracking-[0.2em] text-sand/55">Fixture inicial</span>
                  </div>

                  <div className="mt-5 grid gap-4 xl:grid-cols-2">
                    {tournament.fixturesByGroup.map((group) => (
                      <article key={group.code} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                        <p className="font-mono text-xs uppercase tracking-[0.22em] text-ember/85">Grupo {group.code}</p>
                        <div className="mt-3 space-y-3">
                          {group.fixtures.map((fixture) => (
                            <div key={fixture.id} className="rounded-2xl border border-white/10 bg-night/60 px-4 py-3">
                              <div className="flex items-center justify-between gap-3 text-sm text-sand/65">
                                <span>Fecha {fixture.stageOrder}</span>
                                <span>{fixture.status === 'PENDING' ? 'Pendiente' : fixture.status}</span>
                              </div>
                              <p className="mt-2 text-base font-semibold">
                                {fixture.homeName} vs {fixture.awayName}
                              </p>
                            </div>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-8 rounded-3xl border border-dashed border-white/15 bg-white/5 p-6 text-sm leading-7 text-sand/65">
                Terminá una selección en el draft para ver tus grupos y el calendario del Mundial.
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
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-ember">Qué vas a vivir</p>
            <div className="mt-6 space-y-4">
              <article className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <h2 className="text-xl font-semibold">Tabla viva</h2>
                <p className="mt-2 text-sm leading-6 text-sand/70">
                  Vas a seguir posiciones, diferencia de gol y el pulso de cada grupo en tiempo real.
                </p>
              </article>
              <article className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <h2 className="text-xl font-semibold">Cruces directos</h2>
                <p className="mt-2 text-sm leading-6 text-sand/70">
                  Después de grupos, cada noche se convierte en una final sin vuelta atrás.
                </p>
              </article>
              <article className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <h2 className="text-xl font-semibold">Relato de campaña</h2>
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
