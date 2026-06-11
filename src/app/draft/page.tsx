import { eq } from 'drizzle-orm'

import { DraftWorkbench } from '@/features/draft/components/draft-workbench'
import { getDb } from '@/lib/db/client'
import { rooms } from '@/lib/db/schema'
import type { DraftDifficultyMode } from '@/features/draft/types'
import { getDraftBootstrap } from '@/lib/game/draft-bootstrap'

export default async function DraftPage({
  searchParams,
}: {
  searchParams: Promise<{ sala?: string }>
}) {
  const { sala } = await searchParams
  const draftBootstrap = await getDraftBootstrap()

  // En modo sala, la dificultad la fija la sala: el draft la hereda y no se puede cambiar.
  let roomDifficulty: DraftDifficultyMode | undefined
  if (sala) {
    const room = await getDb().query.rooms.findFirst({
      where: eq(rooms.code, sala.toUpperCase()),
    })
    roomDifficulty = room?.difficultyMode as DraftDifficultyMode | undefined
  }

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8">
        <DraftWorkbench {...draftBootstrap} roomCode={sala} roomDifficulty={roomDifficulty} />
      </div>
    </main>
  )
}
