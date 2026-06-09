import { NextResponse } from 'next/server'

import { getDb, isDatabaseConfigured } from '@/lib/db/client'
import { getOrCreateSessionToken } from '@/lib/draft/session-token'
import {
  groupStandings,
  matchEvents,
  matches,
  tournamentEntries,
  tournaments,
  users,
} from '@/lib/db/schema'
import { simulateFullTournament } from '@/lib/sim/tournament'
import type { TeamStats } from '@/lib/sim/types'
import { and, eq } from 'drizzle-orm'

export async function POST() {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: 'Base de datos no configurada.' }, { status: 500 })
    }

    const db = getDb()
    const sessionToken = await getOrCreateSessionToken()

    const user = await db.query.users.findFirst({
      where: eq(users.sessionToken, sessionToken),
    })

    if (!user) {
      return NextResponse.json({ error: 'Sesion no encontrada.' }, { status: 401 })
    }

    const tournament = await db.query.tournaments.findFirst({
      where: and(
        eq(tournaments.type, 'SINGLEPLAYER'),
        eq(tournaments.status, 'GROUP_STAGE'),
      ),
      orderBy: (table, { desc }) => [desc(table.updatedAt)],
    })

    if (!tournament) {
      return NextResponse.json({ error: 'No hay un torneo activo en fase de grupos.' }, { status: 404 })
    }

    const allEntries = await db.query.tournamentEntries.findMany({
      where: eq(tournamentEntries.tournamentId, tournament.id),
    })

    const entryMap = Object.fromEntries(allEntries.map((e) => [e.id, e]))

    const groupCodes = [...new Set(allEntries.map((e) => e.groupCode).filter(Boolean))] as string[]
    groupCodes.sort()

    const groups: Array<{ code: string; entries: TeamStats[] }> = groupCodes.map((code) => ({
      code,
      entries: allEntries
        .filter((e) => e.groupCode === code)
        .map((entry) => ({
          id: entry.id,
          name: entry.displayName,
          attack: entry.computedAttack,
          midfield: entry.computedMidfield,
          defense: entry.computedDefense,
          goalkeeping: entry.computedGoalkeeping,
          ovr: entry.computedOvr,
        })),
    }))

    const result = simulateFullTournament(groups, tournament.id)

    for (const groupStandingList of result.groupStandings) {
      for (const standing of groupStandingList) {
        await db
          .update(groupStandings)
          .set({
            played: standing.played,
            wins: standing.wins,
            draws: standing.draws,
            losses: standing.losses,
            goalsFor: standing.goalsFor,
            goalsAgainst: standing.goalsAgainst,
            goalDifference: standing.goalDifference,
            points: standing.points,
            rank: standing.rank,
          })
          .where(
            and(
              eq(groupStandings.tournamentId, tournament.id),
              eq(groupStandings.entryId, standing.entryId),
            ),
          )
      }
    }

    const allGroupMatches = await db.query.matches.findMany({
      where: and(eq(matches.tournamentId, tournament.id), eq(matches.round, 'GROUP')),
      orderBy: (table, { asc }) => [asc(table.stageOrder)],
    })

    const flatGroupResults = result.groupMatchResults.flat()

    for (const dbMatch of allGroupMatches) {
      const simResult = flatGroupResults.find(
        (r) =>
          (r.homeId === dbMatch.homeEntryId && r.awayId === dbMatch.awayEntryId) ||
          (r.homeId === dbMatch.awayEntryId && r.awayId === dbMatch.homeEntryId),
      )

      if (!simResult) continue

      await db.update(matches).set({
        homeScore: simResult.homeId === dbMatch.homeEntryId ? simResult.homeScore : simResult.awayScore,
        awayScore: simResult.awayId === dbMatch.awayEntryId ? simResult.awayScore : simResult.homeScore,
        winnerEntryId: simResult.winnerId,
        status: 'FINISHED',
        endedAt: new Date(),
      }).where(eq(matches.id, dbMatch.id))

      await db.delete(matchEvents).where(eq(matchEvents.matchId, dbMatch.id))

      if (simResult.events.length > 0) {
        const eventsForDb = simResult.events.map((ev) => ({
          matchId: dbMatch.id,
          minute: ev.minute,
          side: ev.side as 'HOME' | 'AWAY' | 'NEUTRAL',
          eventType: ev.type as typeof matchEvents.$inferInsert.eventType,
          playerName: ev.playerName ?? null,
          payload: {},
        }))

        await db.insert(matchEvents).values(eventsForDb)
      }
    }

    for (const stage of result.bracket) {
      for (const bracketMatch of stage.matches) {
        if (!bracketMatch.result) continue
        const r = bracketMatch.result

        const round = stage.round as typeof matches.$inferInsert.round
        const stageOrder = bracketMatch.order + 1

        const seed = Math.abs(
          `${tournament.id}:${round}:${bracketMatch.homeEntryId}:${bracketMatch.awayEntryId}`.split('').reduce(
            (h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0,
          ),
        )

        const [insertedMatch] = await db
          .insert(matches)
          .values({
            tournamentId: tournament.id,
            round,
            stageOrder,
            homeEntryId: bracketMatch.homeEntryId ?? '',
            awayEntryId: bracketMatch.awayEntryId ?? '',
            homeScore: r.homeScore,
            awayScore: r.awayScore,
            homePenalties: r.homePenalties ?? null,
            awayPenalties: r.awayPenalties ?? null,
            wentToPenalties: r.wentToPenalties,
            winnerEntryId: r.winnerId,
            status: 'FINISHED',
            simulationSeed: seed,
            startedAt: new Date(),
            endedAt: new Date(),
          })
          .returning({ id: matches.id })

        if (r.events.length > 0 && insertedMatch) {
          await db.insert(matchEvents).values(
            r.events.map((ev) => ({
              matchId: insertedMatch.id,
              minute: ev.minute,
              side: ev.side as 'HOME' | 'AWAY' | 'NEUTRAL',
              eventType: ev.type as typeof matchEvents.$inferInsert.eventType,
              playerName: ev.playerName ?? null,
              payload: {},
            })),
          )
        }
      }
    }

    await db
      .update(tournaments)
      .set({
        status: 'FINISHED',
        currentRound: 'FINAL',
        championEntryId: result.championId,
        endedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tournaments.id, tournament.id))

    const humanEntry = allEntries.find((e) => e.entryType === 'HUMAN_DRAFTED')

    return NextResponse.json({
      simulated: true,
      championId: result.championId,
      humanEntryId: humanEntry?.id ?? null,
      groups: result.groupStandings.map((g) => ({
        code: g[0]?.groupCode ?? '',
        standings: g.map((s) => ({
          rank: s.rank,
          entryId: s.entryId,
          name: s.name,
          played: s.played,
          wins: s.wins,
          draws: s.draws,
          losses: s.losses,
          goalsFor: s.goalsFor,
          goalsAgainst: s.goalsAgainst,
          goalDifference: s.goalDifference,
          points: s.points,
        })),
      })),
      bracket: result.bracket.map((stage) => ({
        round: stage.round,
        matches: stage.matches.map((m) => ({
          id: m.id,
          homeName: m.homeEntryId ? entryMap[m.homeEntryId]?.displayName ?? '?' : '?',
          awayName: m.awayEntryId ? entryMap[m.awayEntryId]?.displayName ?? '?' : '?',
          homeScore: m.result?.homeScore ?? -1,
          awayScore: m.result?.awayScore ?? -1,
          homeEntryId: m.homeEntryId,
          awayEntryId: m.awayEntryId,
          winnerId: m.result?.winnerId,
          wentToPenalties: m.result?.wentToPenalties ?? false,
          homePenalties: m.result?.homePenalties,
          awayPenalties: m.result?.awayPenalties,
        })),
      })),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error al simular el torneo.',
      },
      { status: 500 },
    )
  }
}
