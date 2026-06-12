import 'server-only'

import { and, eq, or } from 'drizzle-orm'

import { getDb, isDatabaseConfigured } from '@/lib/db/client'
import {
  draftedTeamPlayers,
  matchEvents,
  matches,
  players,
  tournamentEntries,
  tournaments,
} from '@/lib/db/schema'

const ROUND_RANK: Record<string, number> = {
  GROUP: 0,
  ROUND_OF_32: 1,
  ROUND_OF_16: 2,
  QUARTER_FINAL: 3,
  SEMI_FINAL: 4,
  FINAL: 5,
}

const ROUND_LABEL: Record<string, string> = {
  ROUND_OF_32: 'Dieciseisavos',
  ROUND_OF_16: 'Octavos',
  QUARTER_FINAL: 'Cuartos',
  SEMI_FINAL: 'Semifinal',
  FINAL: 'Final',
}

const STAGE_SHORT: Record<string, string> = {
  GROUP: 'Grupos',
  ROUND_OF_32: '16avos',
  ROUND_OF_16: 'Octavos',
  QUARTER_FINAL: 'Cuartos',
  SEMI_FINAL: 'Semis',
  FINAL: 'Final',
}

const POS_LABEL: Record<string, string> = {
  GK: 'POR', LB: 'LI', RB: 'LD', CB: 'DFC', SW: 'LIB', LWB: 'CAI', RWB: 'CAD',
  CDM: 'MCD', CM: 'MC', CAM: 'MEI', LM: 'MI', RM: 'MD',
  LW: 'EI', RW: 'ED', ST: 'DC', CF: 'DC', LF: 'DC', RF: 'DC',
}

// Orden de líneas para listar el plantel (arquero → defensa → medio → ataque).
const LANE_RANK: Record<string, number> = {
  GK: 0,
  CB: 1, LB: 1, RB: 1, SW: 1, LWB: 1, RWB: 1,
  CDM: 2, CM: 2, CAM: 2, LM: 2, RM: 2,
  LW: 3, RW: 3, ST: 3, CF: 3, LF: 3, RF: 3,
}

function baseCode(code: string) {
  return code.replace(/[0-9]/g, '')
}
function posLabel(slotCode: string) {
  return POS_LABEL[baseCode(slotCode)] ?? baseCode(slotCode)
}
function surname(name: string) {
  const parts = name.trim().split(' ')
  return parts[parts.length - 1]
}

export type CardSquadPlayer = { pos: string; name: string; ovr: number }
export type CardMatch = {
  stage: string
  opponent: string
  us: number
  them: number
  result: 'W' | 'D' | 'L'
  pen: string | null
}

export type TournamentCardData = {
  humanName: string
  championName: string | null
  isChampion: boolean
  outcomeLabel: string
  ovr: number
  topScorer: { name: string; goals: number } | null
  goalsFor: number
  goalsAgainst: number
  squad: CardSquadPlayer[]
  matches: CardMatch[]
}

// Datos del card final de un torneo, por id (público: el id es un UUID inadivinable).
// Usado por la imagen OG compartible y reusable en el cliente.
export async function getTournamentCardData(tournamentId: string): Promise<TournamentCardData | null> {
  if (!isDatabaseConfigured()) return null

  const db = getDb()
  const tournament = await db.query.tournaments.findFirst({
    where: and(eq(tournaments.id, tournamentId), eq(tournaments.status, 'FINISHED')),
  })
  if (!tournament) return null

  const entries = await db.query.tournamentEntries.findMany({
    where: eq(tournamentEntries.tournamentId, tournamentId),
  })
  const human = entries.find((e) => e.entryType === 'HUMAN_DRAFTED')
  if (!human) return null

  const entryName = new Map(entries.map((e) => [e.id, e.displayName]))
  const championName = tournament.championEntryId ? entryName.get(tournament.championEntryId) ?? null : null
  const isChampion = tournament.championEntryId === human.id

  // ---- Partidos del equipo humano (con rival, marcador y penales) ----
  const rawMatches = await db
    .select({
      round: matches.round,
      stageOrder: matches.stageOrder,
      homeEntryId: matches.homeEntryId,
      awayEntryId: matches.awayEntryId,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      homePenalties: matches.homePenalties,
      awayPenalties: matches.awayPenalties,
      wentToPenalties: matches.wentToPenalties,
      winnerEntryId: matches.winnerEntryId,
    })
    .from(matches)
    .where(
      and(
        eq(matches.tournamentId, tournamentId),
        or(eq(matches.homeEntryId, human.id), eq(matches.awayEntryId, human.id)),
      ),
    )

  const ordered = [...rawMatches].sort((a, b) => {
    const ra = ROUND_RANK[a.round] ?? 0
    const rb = ROUND_RANK[b.round] ?? 0
    if (ra !== rb) return ra - rb
    return a.stageOrder - b.stageOrder
  })

  let goalsFor = 0
  let goalsAgainst = 0
  const matchList: CardMatch[] = ordered.map((m) => {
    const home = m.homeEntryId === human.id
    const us = home ? m.homeScore : m.awayScore
    const them = home ? m.awayScore : m.homeScore
    goalsFor += us
    goalsAgainst += them
    let result: 'W' | 'D' | 'L'
    if (m.winnerEntryId) result = m.winnerEntryId === human.id ? 'W' : 'L'
    else result = us > them ? 'W' : us === them ? 'D' : 'L'
    const pen =
      m.wentToPenalties && m.homePenalties != null && m.awayPenalties != null
        ? `${home ? m.homePenalties : m.awayPenalties}-${home ? m.awayPenalties : m.homePenalties}`
        : null
    return {
      stage: STAGE_SHORT[m.round] ?? m.round,
      opponent: entryName.get(home ? m.awayEntryId : m.homeEntryId) ?? '?',
      us,
      them,
      result,
      pen,
    }
  })

  let outcomeLabel = 'Fase de grupos'
  if (isChampion) {
    outcomeLabel = 'Campeón del mundo'
  } else {
    const ko = ordered.filter((m) => m.round !== 'GROUP')
    if (ko.length > 0) {
      const furthest = ko.reduce((best, m) =>
        (ROUND_RANK[m.round] ?? 0) > (ROUND_RANK[best.round] ?? 0) ? m : best,
      )
      outcomeLabel = `Eliminado en ${ROUND_LABEL[furthest.round] ?? furthest.round}`
    }
  }

  // ---- Plantel del equipo draft ----
  const squadRows = human.draftedTeamId
    ? await db
        .select({
          slotCode: draftedTeamPlayers.slotCode,
          name: players.name,
          ovr: players.ovr,
        })
        .from(draftedTeamPlayers)
        .innerJoin(players, eq(draftedTeamPlayers.playerId, players.id))
        .where(eq(draftedTeamPlayers.draftedTeamId, human.draftedTeamId))
    : []

  const squad: CardSquadPlayer[] = squadRows
    .map((row) => ({
      pos: posLabel(row.slotCode),
      name: row.name,
      ovr: row.ovr,
      _rank: LANE_RANK[baseCode(row.slotCode)] ?? 9,
      _slot: row.slotCode,
    }))
    .sort((a, b) => a._rank - b._rank || a._slot.localeCompare(b._slot))
    .map(({ pos, name, ovr }) => ({ pos, name, ovr }))

  // ---- Goleador del torneo (solo goles de juego) ----
  const goalRows = await db
    .select({ playerName: matchEvents.playerName })
    .from(matchEvents)
    .innerJoin(matches, eq(matchEvents.matchId, matches.id))
    .where(and(eq(matches.tournamentId, tournamentId), eq(matchEvents.eventType, 'GOAL')))

  const goalsByPlayer = new Map<string, number>()
  for (const row of goalRows) {
    if (row.playerName) goalsByPlayer.set(row.playerName, (goalsByPlayer.get(row.playerName) ?? 0) + 1)
  }
  let topScorer: { name: string; goals: number } | null = null
  for (const [name, goals] of goalsByPlayer) {
    if (!topScorer || goals > topScorer.goals) topScorer = { name: surname(name), goals }
  }

  return {
    humanName: human.displayName,
    championName,
    isChampion,
    outcomeLabel,
    ovr: human.computedOvr,
    topScorer,
    goalsFor,
    goalsAgainst,
    squad,
    matches: matchList,
  }
}
