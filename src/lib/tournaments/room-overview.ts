import 'server-only'

import { and, asc, eq, inArray } from 'drizzle-orm'

import { getDb } from '@/lib/db/client'
import {
  draftedTeams,
  groupStandings,
  matchEvents,
  matches,
  roomParticipants,
  rooms,
  tournamentEntries,
  tournaments,
} from '@/lib/db/schema'
import type { BracketMatchInfo, GroupStandingInfo, MatchInfo, TournamentOverview } from './overview'

// Índices de fase (pares = resultados, impares = preview de cruces):
// -1: nada | 0: grupos
// 1: cruces R32 (preview) | 2: resultados R32
// 3: cruces R16 (preview) | 4: resultados R16
// 5: cruces QF  (preview) | 6: resultados QF
// 7: cruces SF  (preview) | 8: resultados SF
// 9: cruce Final (preview) | 10: resultado Final → FINISHED
const KO_ROUND_PREVIEW_INDEX: Record<string, number> = {
  ROUND_OF_32: 1,
  ROUND_OF_16: 3,
  QUARTER_FINAL: 5,
  SEMI_FINAL: 7,
  FINAL: 9,
}
const KO_ROUND_RESULT_INDEX: Record<string, number> = {
  ROUND_OF_32: 2,
  ROUND_OF_16: 4,
  QUARTER_FINAL: 6,
  SEMI_FINAL: 8,
  FINAL: 10,
}
const KO_ROUNDS = ['ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL'] as const

export type HumanRunEntry = {
  entryId: string
  nickname: string
  isMe: boolean
  status: 'ALIVE' | 'ELIMINATED' | 'CHAMPION'
  reachedRound: string
  eliminatedByEntryId: string | null
  eliminatedByHuman: boolean
}

export type RoomBracketMatchInfo = BracketMatchInfo & {
  isHumanDerby: boolean
  showScores: boolean
}

export type RoomTournamentOverview = Omit<TournamentOverview, 'knockoutMatches'> & {
  myEntryId: string | null
  revealStageIndex: number
  humans: HumanRunEntry[]
  knockoutMatches: RoomBracketMatchInfo[]
}

export async function getRoomTournamentOverview(
  roomCode: string,
  requestingUserId: string,
): Promise<RoomTournamentOverview | null> {
  const db = getDb()

  const room = await db.query.rooms.findFirst({
    where: eq(rooms.code, roomCode),
  })

  if (!room || room.status === 'LOBBY' || room.status === 'DRAFT' || room.status === 'CANCELLED') {
    return null
  }

  const tournament = await db.query.tournaments.findFirst({
    where: and(eq(tournaments.roomId, room.id), eq(tournaments.type, 'MULTIPLAYER')),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  })

  if (!tournament) return null

  const revealStageIndex = room.revealStageIndex

  const allEntries = await db.query.tournamentEntries.findMany({
    where: eq(tournamentEntries.tournamentId, tournament.id),
    orderBy: (table, { asc }) => [asc(table.groupCode), asc(table.displayName)],
  })

  const entryMap = Object.fromEntries(allEntries.map((e) => [e.id, e]))

  const humanEntryIds = new Set(
    allEntries.filter((e) => e.entryType === 'HUMAN_DRAFTED').map((e) => e.id),
  )

  // Mi entry: la HUMAN_DRAFTED cuyo drafted_team pertenece al usuario que pide.
  const myDraft = await db.query.draftedTeams.findFirst({
    where: and(eq(draftedTeams.userId, requestingUserId), eq(draftedTeams.roomId, room.id)),
    orderBy: (table, { desc }) => [desc(table.updatedAt)],
  })
  const myEntry = myDraft
    ? allEntries.find((e) => e.draftedTeamId === myDraft.id) ?? null
    : null

  // Cargar partidos — solo hasta el índice revelado.
  const allDbMatches = await db.query.matches.findMany({
    where: eq(matches.tournamentId, tournament.id),
    orderBy: (table, { asc }) => [asc(table.stageOrder)],
  })

  const visibleMatches = allDbMatches.filter((m) => {
    if (m.round === 'GROUP') return revealStageIndex >= 0
    return (KO_ROUND_PREVIEW_INDEX[m.round] ?? 99) <= revealStageIndex
  })

  const visibleMatchIds = visibleMatches.map((m) => m.id)
  const eventsByMatch = new Map<string, Array<{ minute: number; eventType: string; side: string; playerName: string | null }>>()

  if (visibleMatchIds.length > 0) {
    const dbEvents = await db
      .select({
        matchId: matchEvents.matchId,
        minute: matchEvents.minute,
        eventType: matchEvents.eventType,
        side: matchEvents.side,
        playerName: matchEvents.playerName,
      })
      .from(matchEvents)
      .where(inArray(matchEvents.matchId, visibleMatchIds))
      .orderBy(asc(matchEvents.minute))

    for (const ev of dbEvents) {
      const list = eventsByMatch.get(ev.matchId) ?? []
      list.push(ev)
      eventsByMatch.set(ev.matchId, list)
    }
  }

  // Goleador del torneo (solo de los partidos revelados).
  const goalsByPlayer = new Map<string, number>()
  for (const events of eventsByMatch.values()) {
    for (const ev of events) {
      if (ev.eventType === 'GOAL' && ev.playerName) {
        goalsByPlayer.set(ev.playerName, (goalsByPlayer.get(ev.playerName) ?? 0) + 1)
      }
    }
  }
  let topScorer: { name: string; goals: number } | null = null
  for (const [name, goals] of goalsByPlayer) {
    if (!topScorer || goals > topScorer.goals) topScorer = { name, goals }
  }

  // Standings de grupo (solo si grupos ya revelados).
  const dbStandings = revealStageIndex >= 0
    ? await db.query.groupStandings.findMany({
        where: eq(groupStandings.tournamentId, tournament.id),
        orderBy: (table, { asc }) => [asc(table.groupCode), asc(table.rank)],
      })
    : []

  const groupCodes = [...new Set(allEntries.map((e) => e.groupCode).filter(Boolean))] as string[]
  groupCodes.sort()

  const groups: TournamentOverview['groups'] = revealStageIndex >= 0
    ? groupCodes.map((code) => {
        const groupEntries = allEntries.filter((e) => e.groupCode === code)
        const groupMatches = visibleMatches.filter((m) => m.groupCode === code)
        const groupDbStandings = dbStandings.filter((s) => s.groupCode === code)

        const computedStandings: GroupStandingInfo[] = groupEntries.map((entry) => {
          const standing = groupDbStandings.find((s) => s.entryId === entry.id)
          return {
            rank: standing?.rank ?? 0,
            entryId: entry.id,
            name: entry.displayName,
            played: standing?.played ?? 0,
            wins: standing?.wins ?? 0,
            draws: standing?.draws ?? 0,
            losses: standing?.losses ?? 0,
            goalsFor: standing?.goalsFor ?? 0,
            goalsAgainst: standing?.goalsAgainst ?? 0,
            goalDifference: standing?.goalDifference ?? 0,
            points: standing?.points ?? 0,
            ovr: entry.computedOvr,
          }
        })
        computedStandings.sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points
          if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference
          if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
          return b.ovr - a.ovr
        })
        computedStandings.forEach((s, i) => { s.rank = i + 1 })

        return {
          code,
          entries: groupEntries.map((e) => ({
            id: e.id,
            name: e.displayName,
            type: e.entryType as 'HUMAN_DRAFTED' | 'REAL_TEAM',
            ovr: e.computedOvr,
          })),
          standings: computedStandings,
          fixtures: groupMatches.map((m) => ({
            id: m.id,
            round: m.round,
            stageOrder: m.stageOrder,
            groupCode: m.groupCode,
            homeEntryId: m.homeEntryId,
            awayEntryId: m.awayEntryId,
            homeName: entryMap[m.homeEntryId]?.displayName ?? 'Local',
            awayName: entryMap[m.awayEntryId]?.displayName ?? 'Visitante',
            homeScore: m.homeScore,
            awayScore: m.awayScore,
            homePenalties: m.homePenalties,
            awayPenalties: m.awayPenalties,
            wentToPenalties: m.wentToPenalties,
            status: m.status,
            winnerEntryId: m.winnerEntryId,
            events: (eventsByMatch.get(m.id) ?? []).map((ev) => ({
              minute: ev.minute,
              type: ev.eventType,
              side: ev.side,
              playerName: ev.playerName,
            })),
          })),
        }
      })
    : []

  // Bracket KO (clampado por preview).
  const knockoutMatches: RoomBracketMatchInfo[] = []

  for (const round of KO_ROUNDS) {
    if ((KO_ROUND_PREVIEW_INDEX[round] ?? 99) > revealStageIndex) continue

    const roundMatches = visibleMatches
      .filter((m) => m.round === round)
      .sort((a, b) => a.stageOrder - b.stageOrder)

    const showScores = (KO_ROUND_RESULT_INDEX[round] ?? 99) <= revealStageIndex

    for (const m of roundMatches) {
      const isHumanDerby = humanEntryIds.has(m.homeEntryId) && humanEntryIds.has(m.awayEntryId)
      knockoutMatches.push({
        id: m.id,
        round: m.round,
        homeEntryId: m.homeEntryId,
        awayEntryId: m.awayEntryId,
        homeName: entryMap[m.homeEntryId]?.displayName ?? '?',
        awayName: entryMap[m.awayEntryId]?.displayName ?? '?',
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        homePenalties: m.homePenalties,
        awayPenalties: m.awayPenalties,
        wentToPenalties: m.wentToPenalties,
        winnerId: m.winnerEntryId,
        order: m.stageOrder,
        events: showScores
          ? (eventsByMatch.get(m.id) ?? []).map((ev) => ({
              minute: ev.minute,
              type: ev.eventType,
              side: ev.side,
              playerName: ev.playerName,
            }))
          : [],
        isHumanDerby,
        showScores,
      })
    }
  }

  // Recorrido de cada equipo humano (hasta el índice revelado).
  const participants = await db.query.roomParticipants.findMany({
    where: eq(roomParticipants.roomId, room.id),
    orderBy: (table, { asc }) => [asc(table.joinedAt)],
  })
  const nicknameByUserId = new Map(participants.map((p) => [p.userId, p.nicknameSnapshot]))

  const humanEntryList = allEntries.filter((e) => e.entryType === 'HUMAN_DRAFTED')
  const isSimulated = allDbMatches.some((m) => m.status === 'FINISHED')

  const humans: HumanRunEntry[] = humanEntryList.map((entry) => {
    const draftTeam = entry.draftedTeamId
      ? { userId: allEntries.find((e) => e.id === entry.id) }
      : null

    // Buscar el drafted_team para obtener el userId.
    const draft = entry.draftedTeamId
      ? allEntries.find((e) => e.draftedTeamId === entry.draftedTeamId)
      : null

    let reachedRound = revealStageIndex >= 0 ? 'GROUP' : 'PENDING'
    let status: HumanRunEntry['status'] = 'ALIVE'
    let eliminatedByEntryId: string | null = null
    let eliminatedByHuman = false

    if (revealStageIndex >= 0 && isSimulated) {
      const isChampion = tournament.championEntryId === entry.id
      // El campeón solo se revela cuando el resultado de la final está visible (idx=10).
      if (isChampion && revealStageIndex >= 10) {
        status = 'CHAMPION'
        reachedRound = 'FINAL'
      } else {
        // Solo considerar partidos cuyo resultado ya fue revelado.
        const koMatchesWithResults = knockoutMatches.filter((m) => m.showScores)

        const appeared = koMatchesWithResults.some(
          (m) => m.homeEntryId === entry.id || m.awayEntryId === entry.id,
        )

        // R32 resultados visibles recién en idx=2.
        if (!appeared && revealStageIndex >= 2) {
          status = 'ELIMINATED'
          reachedRound = 'GROUP'
        } else {
          for (const m of koMatchesWithResults) {
            if (m.winnerId && m.winnerId !== entry.id) {
              if (m.homeEntryId === entry.id || m.awayEntryId === entry.id) {
                status = 'ELIMINATED'
                reachedRound = m.round
                eliminatedByEntryId = m.winnerId
                eliminatedByHuman = humanEntryIds.has(m.winnerId)
                break
              }
            }
          }
        }
      }
    }

    // Obtener nickname del participante.
    // El drafted_team tiene userId que podemos buscar en participantes.
    let nickname = entry.displayName
    // Intentar resolver el nickname real desde room_participants.
    // Para eso necesitamos el userId del draft — lo buscamos en allEntries por draftedTeamId.
    // (Se carga en el bloque de humans de start-tournament con el nicknameSnapshot.)
    // Fallback al displayName de la entry que ya es el nickname.

    return {
      entryId: entry.id,
      nickname,
      isMe: myEntry?.id === entry.id,
      status,
      reachedRound,
      eliminatedByEntryId,
      eliminatedByHuman,
    }
  })

  const championEntryId = revealStageIndex >= 10 ? (tournament.championEntryId ?? null) : null
  const championName = championEntryId ? entryMap[championEntryId]?.displayName ?? null : null
  const isFinished = tournament.status === 'FINISHED'

  return {
    tournamentId: tournament.id,
    status: tournament.status,
    currentRound: tournament.currentRound,
    championEntryId,
    championName,
    humanEntryId: myEntry?.id ?? null,
    groups,
    knockoutMatches,
    isSimulated,
    topScorer: revealStageIndex >= 0 ? topScorer : null,
    myEntryId: myEntry?.id ?? null,
    revealStageIndex,
    humans,
  }
}
