import Link from 'next/link'

import { getProjectOverview } from '@/lib/db/queries/overview'
import { getDraftOverview } from '@/lib/game/draft-bootstrap'

const roadmap = [
  {
    phase: 'Elegí tu plan',
    title: 'Entrá con una identidad clara',
    detail: 'Escogé la formación que mejor represente tu idea y arrancá a construir desde ahí.',
  },
  {
    phase: 'Viví el draft',
    title: 'Cada país aparece una sola vez',
    detail: 'Tenés que decidir rápido qué nombre vale la pena antes de que se cierre esa ventana.',
  },
  {
    phase: 'Jugá el Mundial',
    title: '48 selecciones, 12 grupos, un campeón',
    detail: 'Tu once entra a competir por el título y después se abre el camino de mata-mata.',
  },
  {
    phase: 'Seguí creciendo',
    title: 'Más modos y desafíos',
    detail: 'La base ya está pensada para expandirse con más partidos, más drama y más rivalidad.',
  },
]

export default async function HomePage() {
  const [overview, draftOverview] = await Promise.all([getProjectOverview(), getDraftOverview()])

  return (
    <main className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 -z-10 h-[28rem] bg-pitch blur-3xl" />

      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-8 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-8 border-b border-white/10 pb-10 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-5">
            <p className="font-mono text-xs uppercase tracking-[0.35em] text-cyan">
              Esta Locura / Draft de selecciones / Mundial 2026
            </p>
            <div className="space-y-4">
              <h1 className="max-w-2xl text-5xl font-semibold leading-none sm:text-6xl lg:text-7xl">
                Armá una selección imposible y jugá por la gloria en un Mundial de 48 equipos.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-sand/75 sm:text-lg">
                Elegís una formación, esperás la aparición de cada país y construís tu once con lo
                mejor que salga en el momento. Cuando tu equipo está listo, el torneo te empuja
                directo a la fase de grupos y al camino hacia dieciseisavos.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:w-[28rem]">
            <div className="rounded-3xl border border-cyan/20 bg-white/5 p-5 shadow-card backdrop-blur">
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-cyan/90">Modo principal</p>
              <p className="mt-3 text-2xl font-semibold">
                Draft singleplayer
              </p>
              <p className="mt-2 text-sm leading-6 text-sand/70">
                Empezás desde cero, levantás tu once jugador por jugador y salís a competir con una identidad propia.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#111f34]/80 p-5 shadow-card backdrop-blur">
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-ember">Meta</p>
              <p className="mt-3 text-2xl font-semibold">Sobreviví al caos</p>
              <p className="mt-2 text-sm leading-6 text-sand/70">
                Cada pick cambia tu equipo para siempre. Lo que dejás pasar puede terminar del otro lado del cuadro.
              </p>
            </div>
          </div>
        </header>

        <section className="grid gap-5 py-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-card backdrop-blur sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.3em] text-cyan/90">
                  Punto de partida
                </p>
                <h2 className="mt-3 text-3xl font-semibold">Todo lo que necesitás para empezar a jugar</h2>
              </div>

              <Link
                href="/draft"
                className="rounded-full border border-cyan/30 px-4 py-2 font-mono text-xs uppercase tracking-[0.25em] text-cyan transition hover:border-cyan hover:bg-cyan/10"
              >
                Entrar al draft
              </Link>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <article className="rounded-3xl border border-white/10 bg-night/60 p-5">
                <p className="font-mono text-xs uppercase tracking-[0.25em] text-sand/55">Formaciones</p>
                <p className="mt-3 text-4xl font-semibold">{overview.counts.formations}</p>
                <p className="mt-2 text-sm text-sand/65">Tres estilos para construir un equipo con personalidad propia.</p>
              </article>

              <article className="rounded-3xl border border-white/10 bg-night/60 p-5">
                <p className="font-mono text-xs uppercase tracking-[0.25em] text-sand/55">Selecciones</p>
                <p className="mt-3 text-4xl font-semibold">{overview.counts.nationalTeams}</p>
                <p className="mt-2 text-sm text-sand/65">El universo completo desde donde nace cada ronda del draft.</p>
              </article>

              <article className="rounded-3xl border border-white/10 bg-night/60 p-5">
                <p className="font-mono text-xs uppercase tracking-[0.25em] text-sand/55">Jugadores</p>
                <p className="mt-3 text-4xl font-semibold">{overview.counts.players}</p>
                <p className="mt-2 text-sm text-sand/65">Nombres reales listos para entrar a tu once o quedarse afuera.</p>
              </article>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <article className="rounded-3xl border border-cyan/15 bg-cyan/10 p-5">
                <p className="font-mono text-xs uppercase tracking-[0.25em] text-cyan/90">Disponibles</p>
                <p className="mt-3 text-4xl font-semibold">{draftOverview.readyPlayers}</p>
                <p className="mt-2 text-sm text-sand/65">Son los jugadores que ya pueden aparecer para tu equipo.</p>
              </article>

              <article className="rounded-3xl border border-amber-300/10 bg-amber-100/5 p-5">
                <p className="font-mono text-xs uppercase tracking-[0.25em] text-amber-200/85">Reservados</p>
                <p className="mt-3 text-4xl font-semibold">{draftOverview.blockedPlayers}</p>
                <p className="mt-2 text-sm text-sand/65">Siguen fuera de juego hasta estar listos para entrar al pool.</p>
              </article>
            </div>

            <div className="mt-8 rounded-3xl border border-amber-200/10 bg-amber-100/5 p-5 text-sm leading-7 text-sand/75">
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-ember/90">Cómo se siente</p>
              <p className="mt-3">
                {overview.databaseReachable
                  ? 'La partida arranca con una base sólida y un pool listo para sostener el modo principal.'
                  : 'Si alguna parte tarda en aparecer, podés seguir jugando igual con la experiencia central.'}
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/draft"
                className="rounded-full bg-sand px-5 py-3 font-mono text-xs uppercase tracking-[0.28em] text-night transition hover:bg-white"
              >
                Jugar ahora
              </Link>
              <Link
                href="/tournament"
                className="rounded-full border border-white/15 px-5 py-3 font-mono text-xs uppercase tracking-[0.28em] text-sand/75 transition hover:border-white/30"
              >
                Ver torneo
              </Link>
            </div>
          </div>

          <aside className="rounded-[2rem] border border-white/10 bg-[#0d1728]/85 p-6 shadow-card backdrop-blur sm:p-8">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-ember">Cómo se juega</p>
            <div className="mt-6 space-y-4">
              {roadmap.map((item) => (
                <article key={item.phase} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <p className="font-mono text-xs uppercase tracking-[0.25em] text-cyan/90">{item.phase}</p>
                  <h3 className="mt-2 text-xl font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-sand/70">{item.detail}</p>
                </article>
              ))}
            </div>
          </aside>
        </section>
      </div>
    </main>
  )
}
