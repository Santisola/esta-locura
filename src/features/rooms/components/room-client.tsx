'use client'

import { useEffect, useRef, useState } from 'react'
import type { RoomState, ParticipantState } from '@/lib/rooms/queries'
import { RoomLobby } from './room-lobby'
import { RoomDraft } from './room-draft'
import { RoomTournament } from './room-tournament'

type PolledState = {
  state: RoomState
  me: ParticipantState | null
}

const POLL_INTERVAL_LOBBY_DRAFT = 2500
const POLL_INTERVAL_TOURNAMENT = 1500

export function RoomClient({ code }: { code: string }) {
  const [data, setData] = useState<PolledState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const poll = async () => {
    try {
      const res = await fetch(`/api/rooms/${code}/state`)
      if (res.status === 401) {
        // Sin sesión: redirigir al join.
        window.location.href = `/sala/${code}/join`
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? 'Error al conectar con la sala.')
        return
      }
      const body: PolledState = await res.json()

      // Tiene sesión válida pero no es participante de esta sala (ej: abrió el link
      // de invitación con un session token previo de haber usado el sitio antes).
      // El endpoint responde 200 con me=null, así que sin esto caería al lobby sin
      // figurar entre los jugadores. Lo mandamos al form de apodo para que se una.
      if (body.me === null) {
        window.location.href = `/sala/${code}/join`
        return
      }

      setData(body)
      setError(null)

      const status = body.state.status
      if (status === 'CANCELLED') return

      const interval =
        status === 'TOURNAMENT' || status === 'FINISHED'
          ? POLL_INTERVAL_TOURNAMENT
          : POLL_INTERVAL_LOBBY_DRAFT
      pollRef.current = setTimeout(poll, interval)
    } catch {
      setError('Sin conexión. Reintentando…')
      pollRef.current = setTimeout(poll, 3000)
    }
  }

  useEffect(() => {
    poll()
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  if (error && !data) {
    return (
      <main className="min-h-screen bg-paper text-ink flex items-center justify-center px-5">
        <div className="space-y-4 text-center">
          <p className="text-sm font-semibold text-vermillion">{error}</p>
          <a href="/multiplayer" className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink2 underline-offset-2 hover:underline">
            ← Volver
          </a>
        </div>
      </main>
    )
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-paper text-ink flex items-center justify-center">
        <p className="animate-pulse font-mono text-[11px] uppercase tracking-[0.3em] text-ink2">Conectando con la sala…</p>
      </main>
    )
  }

  const { state, me } = data

  if (state.status === 'CANCELLED') {
    return (
      <main className="min-h-screen bg-paper text-ink flex items-center justify-center px-5">
        <div className="space-y-4 text-center">
          <p className="text-sm font-semibold text-ink2">La sala fue cancelada.</p>
          <a href="/multiplayer" className="font-mono text-[11px] uppercase tracking-[0.18em] text-violeta underline-offset-2 hover:underline">
            ← Volver al multijugador
          </a>
        </div>
      </main>
    )
  }

  if (state.status === 'LOBBY') {
    return <RoomLobby state={state} me={me} onRefresh={poll} />
  }

  if (state.status === 'DRAFT') {
    return <RoomDraft state={state} me={me} onRefresh={poll} />
  }

  if (state.status === 'TOURNAMENT' || state.status === 'FINISHED') {
    return <RoomTournament state={state} me={me} onRefresh={poll} />
  }

  return null
}
