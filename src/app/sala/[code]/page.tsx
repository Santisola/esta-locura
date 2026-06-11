import { RoomClient } from '@/features/rooms/components/room-client'

export default async function SalaPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  return <RoomClient code={code.toUpperCase()} />
}
