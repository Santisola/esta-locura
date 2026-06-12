import { ImageResponse } from 'next/og'

import { getRoomCardData } from '@/lib/tournaments/room-card-data'

export const runtime = 'nodejs'

const C = {
  text: '#f2f5ff',
  muted: '#a9b0d8',
  celeste: '#4fb3ef',
  violeta: '#8b6cf0',
  gold: '#f4c84b',
  win: '#46d18a',
  loss: '#f4716a',
  panel: 'rgba(255,255,255,0.06)',
  panelBorder: 'rgba(255,255,255,0.12)',
  chip: 'rgba(255,255,255,0.10)',
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string }> },
) {
  const { tournamentId } = await params
  const { searchParams } = new URL(request.url)
  const entryId = searchParams.get('entry')
  if (!entryId) return new Response('Falta entry.', { status: 400 })

  const data = await getRoomCardData(tournamentId, entryId)
  if (!data) return new Response('Torneo no encontrado o no finalizado.', { status: 404 })

  const accent = data.isChampion ? C.gold : C.celeste

  const sectionTitle = (label: string) => (
    <div
      style={{
        display: 'flex',
        fontSize: 20,
        letterSpacing: 4,
        textTransform: 'uppercase',
        color: C.muted,
        fontWeight: 700,
        marginBottom: 10,
      }}
    >
      {label}
    </div>
  )

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(160deg, #15184a 0%, #2a1f5e 58%, #3a2470 100%)',
          color: C.text,
          padding: 52,
          fontFamily: 'sans-serif',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                display: 'flex',
                width: 56,
                height: 56,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 12,
                background: `linear-gradient(135deg, ${C.celeste}, ${C.violeta})`,
                fontSize: 24,
                fontWeight: 800,
              }}
            >
              EL
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: 28, fontWeight: 800, letterSpacing: 1 }}>ESTA LOCURA</div>
              <div style={{ display: 'flex', fontSize: 15, letterSpacing: 4, color: C.muted, textTransform: 'uppercase' }}>
                Multijugador · Mundial 2026
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', fontSize: 58, fontWeight: 800, lineHeight: 1, color: accent }}>{data.ovr}</div>
            <div style={{ display: 'flex', fontSize: 14, letterSpacing: 3, color: C.muted, textTransform: 'uppercase' }}>Media</div>
          </div>
        </div>

        {/* Outcome */}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 22 }}>
          <div style={{ display: 'flex', fontSize: data.isChampion ? 68 : 54, fontWeight: 800, color: accent, lineHeight: 1.05 }}>
            {data.outcomeLabel}
          </div>
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, marginTop: 4 }}>{data.humanName}</div>
          {!data.isChampion && data.championName && (
            <div style={{ display: 'flex', fontSize: 18, color: C.muted, marginTop: 4 }}>
              Campeon del torneo: {data.championName}
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ display: 'flex', gap: 28, marginTop: 24, flex: 1, minHeight: 0 }}>
          {/* Plantel */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            {sectionTitle('Plantel')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {data.squad.map((p, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: C.panel,
                    border: `1px solid ${C.panelBorder}`,
                    borderRadius: 8,
                    padding: '6px 10px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      width: 42,
                      justifyContent: 'center',
                      borderRadius: 5,
                      background: C.chip,
                      padding: '2px 0',
                      fontSize: 12,
                      fontWeight: 700,
                      color: C.celeste,
                    }}
                  >
                    {p.pos}
                  </div>
                  <div style={{ display: 'flex', flex: 1, fontSize: 18, overflow: 'hidden' }}>{p.name}</div>
                  <div style={{ display: 'flex', fontSize: 19, fontWeight: 800 }}>{p.ovr}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Columna derecha: campaña + participantes */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 20 }}>
            {/* Campaña */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {sectionTitle('La campana')}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {data.matches.map((m, i) => {
                  const tone = m.result === 'W' ? C.win : m.result === 'L' ? C.loss : C.muted
                  return (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: C.panel,
                        border: `1px solid ${C.panelBorder}`,
                        borderRadius: 8,
                        padding: '6px 10px',
                      }}
                    >
                      <div style={{ display: 'flex', width: 68, fontSize: 12, letterSpacing: 1, color: C.muted, textTransform: 'uppercase' }}>
                        {m.stage}
                      </div>
                      <div style={{ display: 'flex', flex: 1, fontSize: 17, overflow: 'hidden' }}>{m.opponent}</div>
                      <div style={{ display: 'flex', fontSize: 19, fontWeight: 800, color: tone }}>
                        {m.us}-{m.them}
                      </div>
                      {m.pen && <div style={{ display: 'flex', fontSize: 11, color: C.muted }}>({m.pen}p)</div>}
                      <div style={{ display: 'flex', width: 10, height: 10, borderRadius: 5, background: tone }} />
                    </div>
                  )
                })}
              </div>

              {/* Stats rápidas */}
              <div
                style={{
                  display: 'flex',
                  marginTop: 10,
                  gap: 18,
                  background: C.panel,
                  border: `1px solid ${C.panelBorder}`,
                  borderRadius: 10,
                  padding: '12px 16px',
                }}
              >
                {[
                  { v: String(data.goalsFor), l: 'GF' },
                  { v: String(data.goalsAgainst), l: 'GC' },
                  { v: data.topScorer ? `${data.topScorer.name} ${data.topScorer.goals}` : '-', l: 'Goleador' },
                ].map((s, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', fontSize: 22, fontWeight: 800, color: C.celeste }}>{s.v}</div>
                    <div style={{ display: 'flex', fontSize: 11, letterSpacing: 2, color: C.muted, textTransform: 'uppercase' }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Participantes */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {sectionTitle('Jugadores')}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {data.participants.map((p, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: p.isMe ? 'rgba(139,108,240,0.15)' : C.panel,
                      border: `1px solid ${p.isMe ? C.violeta : p.isChampion ? C.gold : C.panelBorder}`,
                      borderRadius: 8,
                      padding: '6px 10px',
                    }}
                  >
                    <div style={{ display: 'flex', flex: 1, fontSize: 17, fontWeight: p.isMe ? 700 : 400, overflow: 'hidden' }}>
                      {p.nickname}
                    </div>
                    <div style={{ display: 'flex', fontSize: 14, color: p.isChampion ? C.gold : C.muted }}>
                      {p.phase}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        width: 38,
                        justifyContent: 'center',
                        borderRadius: 5,
                        background: C.chip,
                        padding: '2px 0',
                        fontSize: 14,
                        fontWeight: 700,
                        color: C.celeste,
                      }}
                    >
                      {p.ovr}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', marginTop: 18, justifyContent: 'center', fontSize: 14, letterSpacing: 5, color: C.muted, textTransform: 'uppercase' }}>
          Arma · Simula · Gana
        </div>
      </div>
    ),
    { width: 1080, height: 1350 },
  )
}
