import 'server-only'

import { and, eq, inArray } from 'drizzle-orm'

import { getDb } from '@/lib/db/client'
import {
  draftedTeamPlayers,
  draftedTeams,
  groupStandings,
  matches,
  nationalTeams,
  tournamentEntries,
  tournaments,
  users,
} from '@/lib/db/schema'

const GROUP_CODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

function average(numbers: number[]) {
  if (numbers.length === 0) {
    return 0
  }

  return Math.round(numbers.reduce((sum, value) => sum + value, 0) / numbers.length)
}

function createSeedFromString(value: string) {
  let hash = 0

  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) % 2147483647
  }

  return hash
}

function createRng(seed: number) {
  let state = seed

  return () => {
    state = (state * 48271) % 2147483647
    return state / 2147483647
  }
}

function shuffle<T>(array: T[], seedSource: string) {
  const rng = createRng(createSeedFromString(seedSource))
  const clone = [...array]

  for (let index = clone.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1))
    ;[clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]]
  }

  return clone
}

function createRoundRobinPairings(entryIds: string[]) {
  const rotations = [...entryIds]
  const pairings: Array<{ home: string; away: string; order: number }> = []

  for (let round = 0; round < rotations.length - 1; round += 1) {
    for (let index = 0; index < rotations.length / 2; index += 1) {
      const home = rotations[index]
      const away = rotations[rotations.length - 1 - index]
      pairings.push({ home, away, order: pairings.length + 1 })
    }

    const fixed = rotations[0]
    const rest = rotations.slice(1)
    const last = rest.pop()

    if (!fixed || !last) {
      continue
    }

    rest.unshift(last)
    rotations.splice(0, rotations.length, fixed, ...rest)
  }

  return pairings
}

export async function createSingleplayerTournament(sessionToken: string) {
  const db = getDb()
  const user = await db.query.users.findFirst({
    where: eq(users.sessionToken, sessionToken),
  })

  if (!user) {
    throw new Error('No existe una sesion valida para crear el torneo.')
  }

  const draftedTeam = await db.query.draftedTeams.findFirst({
    where: and(eq(draftedTeams.userId, user.id), eq(draftedTeams.status, 'COMPLETED')),
    orderBy: (table, { desc }) => [desc(table.updatedAt)],
  })

  if (!draftedTeam) {
    throw new Error('No existe un equipo draft completado para iniciar el torneo.')
  }

  const existingTournament = await db.query.tournaments.findFirst({
    where: and(eq(tournaments.type, 'SINGLEPLAYER'), eq(tournaments.status, 'GROUP_STAGE')),
    orderBy: (table, { desc }) => [desc(table.updatedAt)],
  })

  if (existingTournament) {
    return { tournamentId: existingTournament.id, reused: true }
  }

  const draftedPlayers = await db
    .select({
      attack: nationalTeams.attack,
      midfield: nationalTeams.midfield,
      defense: nationalTeams.defense,
      goalkeeping: nationalTeams.goalkeeping,
      ovr: nationalTeams.ovr,
    })
    .from(draftedTeamPlayers)
    .innerJoin(nationalTeams, eq(draftedTeamPlayers.sourceNationalTeamId, nationalTeams.id))
    .where(eq(draftedTeamPlayers.draftedTeamId, draftedTeam.id))

  const [createdTournament] = await db
    .insert(tournaments)
    .values({
      type: 'SINGLEPLAYER',
      status: 'GROUP_STAGE',
      currentRound: 'GROUP',
      startedAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: tournaments.id })

  const realTeams = await db.query.nationalTeams.findMany()

  if (realTeams.length < 47) {
    throw new Error('No hay suficientes selecciones reales cargadas para armar un Mundial de 48 equipos.')
  }

  const shuffledOpponents = shuffle(
    realTeams.slice(0, 47),
    draftedTeam.id
  )

  const [draftedEntry] = await db
    .insert(tournamentEntries)
    .values({
      tournamentId: createdTournament.id,
      entryType: 'HUMAN_DRAFTED',
      displayName: 'Tu Seleccion Draft',
      draftedTeamId: draftedTeam.id,
      computedAttack: average(draftedPlayers.map((player) => player.attack)),
      computedMidfield: average(draftedPlayers.map((player) => player.midfield)),
      computedDefense: average(draftedPlayers.map((player) => player.defense)),
      computedGoalkeeping: average(draftedPlayers.map((player) => player.goalkeeping)),
      computedOvr: average(draftedPlayers.map((player) => player.ovr)),
      metadata: { origin: 'draft' },
    })
    .returning({ id: tournamentEntries.id })

  const opponentEntries = await db
    .insert(tournamentEntries)
    .values(
      shuffledOpponents.map((team) => ({
        tournamentId: createdTournament.id,
        entryType: 'REAL_TEAM' as const,
        displayName: team.name,
        nationalTeamId: team.id,
        computedAttack: team.attack,
        computedMidfield: team.midfield,
        computedDefense: team.defense,
        computedGoalkeeping: team.goalkeeping,
        computedOvr: team.ovr,
        metadata: { origin: 'national-team', slug: team.slug },
      }))
    )
    .returning({ id: tournamentEntries.id })

  const allEntries = shuffle([draftedEntry.id, ...opponentEntries.map((entry) => entry.id)], `groups:${draftedTeam.id}`)
  const groupedEntries = GROUP_CODES.map((code, index) => ({
    code,
    entryIds: allEntries.slice(index * 4, index * 4 + 4),
  }))

  for (const group of groupedEntries) {
    await db.update(tournamentEntries)
      .set({ groupCode: group.code })
      .where(inArray(tournamentEntries.id, group.entryIds))

    await db.insert(groupStandings).values(
      group.entryIds.map((entryId) => ({
        tournamentId: createdTournament.id,
        entryId,
        groupCode: group.code,
      }))
    )

    const fixtures = createRoundRobinPairings(group.entryIds)

    await db.insert(matches).values(
      fixtures.map((fixture, index) => ({
        tournamentId: createdTournament.id,
        round: 'GROUP' as const,
        stageOrder: index + 1,
        groupCode: group.code,
        homeEntryId: fixture.home,
        awayEntryId: fixture.away,
        simulationSeed: createSeedFromString(`${createdTournament.id}:${group.code}:${fixture.home}:${fixture.away}`),
      }))
    )
  }

  return {
    tournamentId: createdTournament.id,
    reused: false,
    groups: groupedEntries.map((group) => ({
      code: group.code,
      size: group.entryIds.length,
    })),
  }
}
