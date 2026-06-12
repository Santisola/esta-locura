import 'server-only'

import { and, eq, or } from 'drizzle-orm'

import { getDb, isDatabaseConfigured } from '@/lib/db/client'
import {
  draftedTeamPlayers,
  matchEvents,
  matches,
  players,
  roomParticipants,
  rooms,
  tournamentEntries,
  tournaments,
} from '@/lib/db/schema'

const ROUND_RANK: Record<string, number> = {
  GROUP: 0, ROUND_OF_32: 1, ROUND_OF_16: 2, QUARTER_FINAL: 3, SEMI_FINAL: 4, FINAL: 5,
}
const STAGE_SHORT: Record<string, string> = {
  GROUP: 'Grupos', ROUND_OF_32: '16avos', ROUND_OF_16: 'Octavos',
  QUARTER_FINAL: 'Cuartos', SEMI_FINAL: 'Semis', FINAL: 'Final',
}
const ROUND_LABEL: Record<string, string> = {
  ROUND_OF_32: '16avos', ROUND_OF_16: 'Octavos',
  QUARTER_FINAL: 'Cuartos', SEMI_FINAL: 'Semis', FINAL: 'Final',
}
const POS_LABEL: Record<string, string> = {
  GK: 'POR', LB: 'LI', RB: 'LD', CB: 'DFC', SW: 'LIB', LWB: 'CAI', RWB: 'CAD',
  CDM: 'MCD', CM: 'MC', CAM: 'MEI', LM: 'EI', RM: 'ED',
  LW: 'EI', RW: 'ED', ST: 'DC', CF: 'DC', LF: 'DC', RF: 'DC',
}
const LANE_RANK: Record<string, number> = {
  GK: 0,
  CB: 1, LB: 1, RB: 1, SW: 1, LWB: 1, RWB: 1,
  CDM: 2, CM: 2, CAM: 2, LM: 2, RM: 2,
  LW: 3, RW: 3, ST: 3, CF: 3, LF: 3, RF: 3,
}

function baseCode(code: string) { return code.replace(/[0-9]/g, '') }
function posLabel(slotCode: string) { return POS_LABEL[baseCode(slotCode)] ?? baseCode(slotCode) }
function surname(name: string) {
  const parts = name.trim().split(' ')
  return parts[parts.length - 1]
}

export type RoomCardParticipant = {
  nickname: string
  ovr: number
  phase: string
  isChampion: boolean
  isMe: boolean
}

export type RoomCardData = {
  humanName: string
  ovr: number
  isChampion: boolean
  outcomeLabel: string
  championName: string | null
  goalsFor: number
  goalsAgainst: number
  topScorer: { name: string; goals: number } | null
  squad: Array<{ pos: string; name: string; ovr: number }>
  matches: Array<{ stage: string; opponent: string; us: number; them: number; result: 'W' | 'D' | 'L'; pen: string | null }>
  participants: RoomCardParticipant[]
}

export async function getRoomCardData(
  tournamentId: string,
  entryId: string,
): Promise<RoomCardData | null> {
  if (!isDatabaseConfigured()) return null

  const db = getDb()

  const tournament = await db.query.tournaments.findFirst({
    where: and(eq(tournaments.id, tournamentId), eq(tournaments.status, 'FINISHED')),
  })
  if (!tournament || !tournament.roomId) return null

  const allEntries = await db.query.tournamentEntries.findMany({
    where: eq(tournamentEntries.tournamentId, tournamentId),
  })

  const myEntry = allEntries.find((e) => e.id === entryId && e.entryType === 'HUMAN_DRAFTED')
  if (!myEntry) return null

  const humanEntries = allEntries.filter((e) => e.entryType === 'HUMAN_DRAFTED')
  const entryName = new Map(allEntries.map((e) => [e.id, e.displayName]))
  const isChampion = tournament.championEntryId === myEntry.id
  const championName = tournament.championEntryId
    ? entryName.get(tournament.championEntryId) ?? null
    : null

  // ---- Partidos de la room (todos, para calcular fases de cada participante) ----
  const allMatches = await db.query.matches.findMany({
    where: eq(matches.tournamentId, tournamentId),
  })

  const championEntryId = tournament.championEntryId

  // Fase alcanzada por cada entry humana
  function computePhase(eId: string): { label: string; isChampion: boolean } {
    if (championEntryId === eId) return { label: 'Campeón', isChampion: true }
    const koPlayed = allMatches.filter(
      (m) => m.round !== 'GROUP' && m.status === 'FINISHED' &&
        (m.homeEntryId === eId || m.awayEntryId === eId),
    )
    if (koPlayed.length === 0) return { label: 'Fase de grupos', isChampion: false }
    const furthest = koPlayed.reduce((best, m) =>
      (ROUND_RANK[m.round] ?? 0) > (ROUND_RANK[best.round] ?? 0) ? m : best,
    )
    return { label: ROUND_LABEL[furthest.round] ?? furthest.round, isChampion: false }
  }

  // ---- Participants de la sala ----
  const room = await db.query.rooms.findFirst({ where: eq(rooms.id, tournament.roomId) })
  const rParticipants = room
    ? await db.query.roomParticipants.findMany({
        where: eq(roomParticipants.roomId, room.id),
        orderBy: (t, { asc }) => [asc(t.joinedAt)],
      })
    : []
  const nicknameByUserId = new Map(rParticipants.map((p) => [p.userId, p.nicknameSnapshot]))

  // Para obtener el userId del draft de cada entry, consultamos draftedTeamPlayers → entry.draftedTeamId
  // El displayName de la entry ya es el nickname, lo usamos como fallback.
  const participants: RoomCardParticipant[] = humanEntries.map((e) => {
    const { label, isChampion: ec } = computePhase(e.id)
    return {
      nickname: e.displayName,
      ovr: e.computedOvr,
      phase: label,
      isChampion: ec,
      isMe: e.id === myEntry.id,
    }
  })

  // ---- Partidos del equipo humano ----
  const rawMatches = allMatches
    .filter((m) => m.homeEntryId === myEntry.id || m.awayEntryId === myEntry.id)
    .sort((a, b) => {
      const ra = ROUND_RANK[a.round] ?? 0
      const rb = ROUND_RANK[b.round] ?? 0
      return ra !== rb ? ra - rb : a.stageOrder - b.stageOrder
    })

  let goalsFor = 0
  let goalsAgainst = 0
  const matchList = rawMatches.map((m) => {
    const home = m.homeEntryId === myEntry.id
    const us = home ? m.homeScore : m.awayScore
    const them = home ? m.awayScore : m.homeScore
    goalsFor += us
    goalsAgainst += them
    let result: 'W' | 'D' | 'L'
    if (m.winnerEntryId) result = m.winnerEntryId === myEntry.id ? 'W' : 'L'
    else result = us > them ? 'W' : us === them ? 'D' : 'L'
    const pen =
      m.wentToPenalties && m.homePenalties != null && m.awayPenalties != null
        ? `${home ? m.homePenalties : m.awayPenalties}-${home ? m.awayPenalties : m.homePenalties}`
        : null
    return {
      stage: STAGE_SHORT[m.round] ?? m.round,
      opponent: entryName.get(home ? m.awayEntryId : m.homeEntryId) ?? '?',
      us, them, result, pen,
    }
  })

  let outcomeLabel = 'Fase de grupos'
  if (isChampion) {
    outcomeLabel = 'Campeón del mundo'
  } else {
    const ko = rawMatches.filter((m) => m.round !== 'GROUP')
    if (ko.length > 0) {
      const furthest = ko.reduce((best, m) =>
        (ROUND_RANK[m.round] ?? 0) > (ROUND_RANK[best.round] ?? 0) ? m : best,
      )
      outcomeLabel = `Eliminado en ${ROUND_LABEL[furthest.round] ?? furthest.round}`
    }
  }

  // ---- Plantel ----
  const squadRows = myEntry.draftedTeamId
    ? await db
        .select({ slotCode: draftedTeamPlayers.slotCode, name: players.name, ovr: players.ovr })
        .from(draftedTeamPlayers)
        .innerJoin(players, eq(draftedTeamPlayers.playerId, players.id))
        .where(eq(draftedTeamPlayers.draftedTeamId, myEntry.draftedTeamId))
    : []

  const squad = squadRows
    .map((row) => ({
      pos: posLabel(row.slotCode),
      name: row.name,
      ovr: row.ovr,
      _rank: LANE_RANK[baseCode(row.slotCode)] ?? 9,
      _slot: row.slotCode,
    }))
    .sort((a, b) => a._rank - b._rank || a._slot.localeCompare(b._slot))
    .map(({ pos, name, ovr }) => ({ pos, name, ovr }))

  // ---- Goleador del torneo ----
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
    humanName: myEntry.displayName,
    ovr: myEntry.computedOvr,
    isChampion,
    outcomeLabel,
    championName,
    goalsFor,
    goalsAgainst,
    topScorer,
    squad,
    matches: matchList,
    participants,
  }
}
