import Link from 'next/link'

import { getProjectOverview } from '@/lib/db/queries/overview'
import { getDraftOverview } from '@/lib/game/draft-bootstrap'

export default async function HomePage() {
  const [overview, draftOverview] = await Promise.all([getProjectOverview(), getDraftOverview()])

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto w-full max-w-[1000px] px-5 py-10 sm:px-8">
        {/* Logo bar */}
        <header className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink/80 pb-5">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-xl border-2 border-ink bg-gradient-to-br from-celeste to-violeta shadow-hardsm">
              <img src="/worldcup.svg" alt="EL" className="h-9 w-9" />
            </span>
            <div>
              <p className="font-slab text-2xl leading-none tracking-wide text-ink sm:text-3xl">
                ESTA <span className="bg-gradient-to-r from-celeste to-violeta bg-clip-text text-transparent">LOCURA</span>
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.3em] text-ink2">Armá · Simulá · Ganá</p>
            </div>
          </div>
          <Link href="/historial" className="rounded-full border-2 border-ink bg-bone px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink shadow-hardsm transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none">
            Historial
          </Link>
        </header>

        {/* Hero */}
        <section className="mt-10">
          <h1 className="font-slab text-6xl uppercase leading-[0.92] tracking-tight text-ink sm:text-8xl">
            Armá tu selección<br />y conquistá el <span className="text-vermillion">Mundial</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-ink2">
            Elegís una formación, aparecen países, tomás decisiones. Cada partido después pone a prueba
            lo que construiste. Sin relleno.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/draft"
              className="rounded-2xl border-2 border-ink bg-gradient-to-r from-celeste to-violeta px-10 py-5 font-slab text-2xl uppercase tracking-wide text-white shadow-hard transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
            >
              Jugar ahora →
            </Link>
            <Link
              href="/tournament"
              className="rounded-2xl border-2 border-ink bg-bone px-8 py-5 font-slab text-xl uppercase tracking-wide text-ink shadow-hardsm transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
            >
              La campaña
            </Link>
          </div>
        </section>

        {/* Stats */}
        <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { value: overview.counts.formations, label: 'Formaciones' },
            { value: overview.counts.nationalTeams, label: 'Selecciones' },
            { value: draftOverview.readyPlayers, label: 'Jugadores' },
            { value: 48, label: 'Equipos' },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border-2 border-ink bg-bone px-5 py-5 text-center shadow-hardsm">
              <p className="font-slab text-4xl leading-none text-ink">{s.value}</p>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink2">{s.label}</p>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          {[
            { n: '01', t: 'Elegí tu plan', d: 'Formación y dificultad. Después arranca el draft.' },
            { n: '02', t: 'Armá tu equipo', d: 'Países que aparecen, jugadores que elegís. Cada decisión cuenta.' },
            { n: '03', t: 'Ganá el Mundial', d: '48 selecciones, grupos y mata-mata. Tu equipo se pone a prueba.' },
          ].map((c) => (
            <div key={c.n} className="rounded-2xl border-2 border-ink bg-bone p-5 shadow-hardsm">
              <p className="font-slab text-2xl text-vermillion">{c.n}</p>
              <h3 className="mt-2 font-slab text-lg uppercase tracking-wide text-ink">{c.t}</h3>
              <p className="mt-2 text-sm leading-6 text-ink2">{c.d}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
