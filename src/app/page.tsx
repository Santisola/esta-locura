import Link from 'next/link'

import { getProjectOverview } from '@/lib/db/queries/overview'
import { getDraftOverview } from '@/lib/game/draft-bootstrap'

export default async function HomePage() {
  const [overview, draftOverview] = await Promise.all([getProjectOverview(), getDraftOverview()])

  return (
    <main className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 -z-10 h-[32rem] bg-pitch blur-3xl" />
      <div className="absolute inset-x-0 top-0 -z-10 h-[32rem] bg-[radial-gradient(ellipse_at_center,rgba(0,200,200,0.08)_0%,transparent_70%)]" />

      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-12 sm:px-8">
        {/* Hero */}
        <section className="flex flex-col items-center text-center">
          <p className="font-mono text-xs uppercase tracking-[0.4em] text-cyan/80">
            Draft de selecciones &middot; Mundial 2026
          </p>
          <h1 className="mt-8 max-w-3xl text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl lg:text-8xl">
            Arma tu seleccion
            <br />
            <span className="bg-gradient-to-r from-cyan to-emerald bg-clip-text text-transparent">
              y conquista el Mundial
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-sand/65 sm:text-lg">
            Elegis una formacion, aparecen paises, tomas decisiones. Cada partido despues pone a
            prueba lo que construiste. Sin relleno.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
            <Link
              href="/draft"
              className="group relative inline-flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-cyan to-emerald px-10 py-5 text-lg font-bold uppercase tracking-[0.15em] text-night transition-all hover:scale-[1.03] hover:shadow-[0_0_40px_-8px_rgba(0,200,200,0.4)]"
            >
              <span className="relative z-10">Jugar ahora</span>
              <span className="relative z-10 text-xl transition group-hover:translate-x-1">&rarr;</span>
              <div className="absolute inset-0 -translate-x-full bg-white/20 transition group-hover:translate-x-0" />
            </Link>
            <Link
              href="/tournament"
              className="rounded-2xl border border-white/20 px-8 py-5 font-mono text-sm uppercase tracking-[0.25em] text-sand/70 transition hover:border-white/40 hover:text-sand"
            >
              Ver torneo
            </Link>
            <Link
              href="/historial"
              className="rounded-2xl border border-white/20 px-8 py-5 font-mono text-sm uppercase tracking-[0.25em] text-sand/70 transition hover:border-white/40 hover:text-sand"
            >
              Historial
            </Link>
          </div>
        </section>

        {/* Stats row */}
        <div className="mt-16 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-center backdrop-blur">
            <p className="font-mono text-2xl font-bold text-cyan sm:text-3xl">{overview.counts.formations}</p>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.2em] text-sand/50">Formaciones</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-center backdrop-blur">
            <p className="font-mono text-2xl font-bold text-cyan sm:text-3xl">{overview.counts.nationalTeams}</p>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.2em] text-sand/50">Selecciones</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-center backdrop-blur">
            <p className="font-mono text-2xl font-bold text-emerald sm:text-3xl">{draftOverview.readyPlayers}</p>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.2em] text-sand/50">Jugadores listos</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-center backdrop-blur">
            <p className="font-mono text-2xl font-bold text-amber sm:text-3xl">{draftOverview.blockedPlayers}</p>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.2em] text-sand/50">En espera</p>
          </div>
        </div>

        {/* How it works — compact */}
        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-night/60 p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-cyan/85">01</p>
            <h3 className="mt-3 text-lg font-semibold">Elegi tu plan</h3>
            <p className="mt-2 text-sm leading-6 text-sand/60">Formacion y dificultad. Despues arranca el draft.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-night/60 p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-cyan/85">02</p>
            <h3 className="mt-3 text-lg font-semibold">Armá tu equipo</h3>
            <p className="mt-2 text-sm leading-6 text-sand/60">Paises que aparecen, jugadores que elejis. Cada decision cuenta.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-night/60 p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-emerald/85">03</p>
            <h3 className="mt-3 text-lg font-semibold">Gana el Mundial</h3>
            <p className="mt-2 text-sm leading-6 text-sand/60">48 selecciones, grupos y mata-mata. Tu equipo se pone a prueba.</p>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-14 flex flex-col items-center gap-4 rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/5 to-transparent px-8 py-10 text-center backdrop-blur">
          <p className="max-w-lg text-base leading-7 text-sand/60">
            No hay microtransacciones, no hay espera. Arranca tu draft ahora y llega hasta la final.
          </p>
          <Link
            href="/draft"
            className="rounded-full bg-sand px-8 py-4 font-mono text-sm font-semibold uppercase tracking-[0.28em] text-night transition hover:bg-white hover:shadow-[0_0_30px_-6px_rgba(255,255,255,0.2)]"
          >
            Empezar a jugar
          </Link>
        </div>
      </div>
    </main>
  )
}
