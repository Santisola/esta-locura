import { ImageResponse } from 'next/og'

import { getTournamentCardData } from '@/lib/tournaments/card-data'

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
  _request: Request,
  { params }: { params: Promise<{ tournamentId: string }> },
) {
  const { tournamentId } = await params
  const data = await getTournamentCardData(tournamentId)

  if (!data) {
    return new Response('Torneo no encontrado o no finalizado.', { status: 404 })
  }

  const accent = data.isChampion ? C.gold : C.celeste

  const sectionTitle = (label: string) => (
    <div
      style={{
        display: 'flex',
        fontSize: 22,
        letterSpacing: 4,
        textTransform: 'uppercase',
        color: C.muted,
        fontWeight: 700,
        marginBottom: 14,
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
                width: 60,
                height: 60,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 14,
                background: `linear-gradient(135deg, ${C.celeste}, ${C.violeta})`,
                fontSize: 26,
                fontWeight: 800,
              }}
            >
              EL
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: 30, fontWeight: 800, letterSpacing: 1 }}>ESTA LOCURA</div>
              <div style={{ display: 'flex', fontSize: 16, letterSpacing: 4, color: C.muted, textTransform: 'uppercase' }}>
                Mundial 2026
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', fontSize: 64, fontWeight: 800, lineHeight: 1, color: accent }}>{data.ovr}</div>
            <div style={{ display: 'flex', fontSize: 15, letterSpacing: 3, color: C.muted, textTransform: 'uppercase' }}>Media</div>
          </div>
        </div>

        {/* Outcome */}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 28 }}>
          <div style={{ display: 'flex', fontSize: data.isChampion ? 76 : 60, fontWeight: 800, color: accent, lineHeight: 1.02 }}>
            {data.outcomeLabel}
          </div>
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, marginTop: 6 }}>{data.humanName}</div>
          {!data.isChampion && data.championName && (
            <div style={{ display: 'flex', fontSize: 20, color: C.muted, marginTop: 4 }}>
              Campeón del torneo: {data.championName}
            </div>
          )}
        </div>

        {/* Body: plantel + campaña */}
        <div style={{ display: 'flex', gap: 28, marginTop: 30, flex: 1 }}>
          {/* Plantel */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            {sectionTitle('Plantel')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {data.squad.map((p, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: C.panel,
                    border: `1px solid ${C.panelBorder}`,
                    borderRadius: 10,
                    padding: '8px 12px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      width: 46,
                      justifyContent: 'center',
                      borderRadius: 6,
                      background: C.chip,
                      padding: '3px 0',
                      fontSize: 14,
                      fontWeight: 700,
                      color: C.celeste,
                    }}
                  >
                    {p.pos}
                  </div>
                  <div style={{ display: 'flex', flex: 1, fontSize: 21, overflow: 'hidden' }}>{p.name}</div>
                  <div style={{ display: 'flex', fontSize: 22, fontWeight: 800, color: C.text }}>{p.ovr}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Campaña */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            {sectionTitle('La campaña')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {data.matches.map((m, i) => {
                const tone = m.result === 'W' ? C.win : m.result === 'L' ? C.loss : C.muted
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      background: C.panel,
                      border: `1px solid ${C.panelBorder}`,
                      borderRadius: 10,
                      padding: '8px 12px',
                    }}
                  >
                    <div style={{ display: 'flex', width: 78, fontSize: 13, letterSpacing: 1, color: C.muted, textTransform: 'uppercase' }}>
                      {m.stage}
                    </div>
                    <div style={{ display: 'flex', flex: 1, fontSize: 20, overflow: 'hidden' }}>{m.opponent}</div>
                    <div style={{ display: 'flex', fontSize: 22, fontWeight: 800, color: tone }}>
                      {m.us}-{m.them}
                    </div>
                    {m.pen && <div style={{ display: 'flex', fontSize: 12, color: C.muted }}>({m.pen}p)</div>}
                    <div style={{ display: 'flex', width: 12, height: 12, borderRadius: 6, background: tone }} />
                  </div>
                )
              })}
            </div>

            {/* Resumen */}
            <div
              style={{
                display: 'flex',
                marginTop: 'auto',
                gap: 20,
                background: C.panel,
                border: `1px solid ${C.panelBorder}`,
                borderRadius: 14,
                padding: '18px 22px',
              }}
            >
              {[
                { v: String(data.goalsFor), l: 'GF' },
                { v: String(data.goalsAgainst), l: 'GC' },
                { v: data.topScorer ? `${data.topScorer.name} ${data.topScorer.goals}` : '—', l: 'Goleador' },
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', fontSize: 26, fontWeight: 800, color: C.celeste }}>{s.v}</div>
                  <div style={{ display: 'flex', fontSize: 13, letterSpacing: 2, color: C.muted, textTransform: 'uppercase' }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', marginTop: 22, justifyContent: 'center', fontSize: 15, letterSpacing: 5, color: C.muted, textTransform: 'uppercase' }}>
          Armá · Simulá · Ganá
        </div>
      </div>
    ),
    { width: 1080, height: 1350 },
  )
}
