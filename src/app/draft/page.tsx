import { DraftWorkbench } from '@/features/draft/components/draft-workbench'
import { getDraftBootstrap } from '@/lib/game/draft-bootstrap'

export default async function DraftPage() {
  const draftBootstrap = await getDraftBootstrap()

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8">
        <DraftWorkbench {...draftBootstrap} />
      </div>
    </main>
  )
}
