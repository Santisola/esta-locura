import type { Metadata } from 'next'
import { Anton, Bricolage_Grotesque, Space_Mono } from 'next/font/google'

import './globals.css'

const displayFont = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
})

const monoFont = Space_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '700'],
})

// Display condensado y contundente para titulares y números grandes (estilo deportivo).
const slabFont = Anton({
  subsets: ['latin'],
  variable: '--font-slab',
  weight: ['400'],
})

export const metadata: Metadata = {
  title: 'Esta Locura',
  description: 'Draft y simulacion del Mundial 2026 con modo singleplayer y multiplayer.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body className={`${displayFont.variable} ${monoFont.variable} ${slabFont.variable} bg-night text-sand antialiased`}>
        {children}
        <footer className="border-t border-white/10 bg-night px-5 py-8 text-center">
          <p className="font-slab text-base uppercase tracking-widest text-sand/80">Esta Locura</p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.2em] text-sand/40">
            Desarrollado por Santiago Isola
          </p>
          <div className="mt-4">
            <a
              href="https://cafecito.app/santisola"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-sand/60 transition hover:border-white/30 hover:bg-white/10 hover:text-sand/90"
            >
              ☕ Esta locura me costó varios cafés — convidame uno
            </a>
            <p className="mt-2 font-mono text-[10px] tracking-wide text-sand/25">
              Tu donación motiva y financia el desarrollo de más proyectos como este.
            </p>
          </div>
        </footer>
      </body>
    </html>
  )
}
