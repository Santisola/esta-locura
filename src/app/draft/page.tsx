import Link from 'next/link'

import { DraftWorkbench } from '@/features/draft/components/draft-workbench'
import { getDraftBootstrap } from '@/lib/game/draft-bootstrap'

export default async function DraftPage() {
  const draftBootstrap = await getDraftBootstrap()

  return (
    <main className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 -z-10 h-[28rem] bg-pitch blur-3xl" />

      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-8 sm:px-8 lg:px-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="rounded-full border border-white/15 px-4 py-2 font-mono text-xs uppercase tracking-[0.24em] text-sand/75 transition hover:border-white/30"
          >
            Volver al inicio
          </Link>
        </div>

        <DraftWorkbench {...draftBootstrap} />
      </div>
    </main>
  )
}
