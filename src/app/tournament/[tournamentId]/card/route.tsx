import { ImageResponse } from 'next/og'

import { getTournamentCardData } from '@/lib/tournaments/card-data'

export const runtime = 'nodejs'

const COLORS = {
  bg: '#0a1322',
  panel: '#0f1c30',
  sand: '#e9e3d5',
  muted: '#9aa6b8',
  cyan: '#22d3ee',
  emerald: '#34d399',
  amber: '#fbbf24',
  red: '#f87171',
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

  const accent = data.isChampion ? COLORS.amber : COLORS.cyan

  const stat = (label: string, value: string) => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: '20px 28px',
        borderRadius: 20,
        background: COLORS.panel,
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div style={{ display: 'flex', fontSize: 40, fontWeight: 800, color: COLORS.sand }}>{value}</div>
      <div
        style={{
          display: 'flex',
          fontSize: 18,
          letterSpacing: 2,
          textTransform: 'uppercase',
          color: COLORS.muted,
        }}
      >
        {label}
      </div>
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
          justifyContent: 'space-between',
          background: `linear-gradient(135deg, ${COLORS.bg} 0%, #0d1a2e 100%)`,
          padding: 64,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', width: 14, height: 14, borderRadius: 7, background: accent }} />
          <div
            style={{
              display: 'flex',
              fontSize: 24,
              letterSpacing: 8,
              textTransform: 'uppercase',
              color: COLORS.muted,
            }}
          >
            Esta Locura · Mundial 2026
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            style={{
              display: 'flex',
              fontSize: data.isChampion ? 96 : 78,
              fontWeight: 800,
              color: accent,
              lineHeight: 1.05,
            }}
          >
            {data.isChampion ? 'Campeón del mundo' : data.outcomeLabel}
          </div>
          <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, color: COLORS.sand }}>
            {data.humanName}
          </div>
          {!data.isChampion && data.championName && (
            <div style={{ display: 'flex', fontSize: 28, color: COLORS.muted }}>
              Campeón del torneo: {data.championName}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 20 }}>
          {stat('Goles a favor', String(data.goalsFor))}
          {stat('Goles en contra', String(data.goalsAgainst))}
          {data.topScorer
            ? stat('Goleador', `${data.topScorer.name} (${data.topScorer.goals})`)
            : stat('Goleador', '—')}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
