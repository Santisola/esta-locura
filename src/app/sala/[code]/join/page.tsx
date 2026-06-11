import { JoinRoomClient } from '@/features/rooms/components/join-room-client'

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  return <JoinRoomClient code={code.toUpperCase()} />
}
