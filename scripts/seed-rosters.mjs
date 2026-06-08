import fs from 'node:fs/promises'
import path from 'node:path'

import { neon } from '@neondatabase/serverless'
import { and, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/neon-http'

import { nationalTeams, players } from '../src/lib/db/schema.ts'

const connectionString = process.env.DATABASE_URL ?? process.env.DATABASE_URL_POOLED

if (!connectionString) {
  throw new Error('DATABASE_URL o DATABASE_URL_POOLED no esta configurada.')
}

const db = drizzle({ client: neon(connectionString) })

const PLAYERS_PATH = path.join(process.cwd(), 'src', 'lib', 'seeds', 'generated', 'players.mvp.json')

const CONFEDERATION_BY_COUNTRY = {
  'México': 'CONCACAF',
  'Corea Del Sur': 'AFC',
  'República Checa': 'UEFA',
  'Sudáfrica': 'CAF',
  'Canadá': 'CONCACAF',
  Suiza: 'UEFA',
  Qatar: 'AFC',
  Bosnia: 'UEFA',
  Brasil: 'CONMEBOL',
  Marruecos: 'CAF',
  Escocia: 'UEFA',
  'Haití': 'CONCACAF',
  'Estados Unidos': 'CONCACAF',
  Australia: 'AFC',
  Paraguay: 'CONMEBOL',
  'Turquía': 'UEFA',
  Alemania: 'UEFA',
  'Costa De Marfil': 'CAF',
  Curazao: 'CONCACAF',
  Ecuador: 'CONMEBOL',
  'Países Bajos': 'UEFA',
  'Japón': 'AFC',
  Suecia: 'UEFA',
  'Túnez': 'CAF',
  'Bélgica': 'UEFA',
  Egipto: 'CAF',
  'Nueva Zelanda': 'OFC',
  'Irán': 'AFC',
  'España': 'UEFA',
  'Cabo Verde': 'CAF',
  Uruguay: 'CONMEBOL',
  'Arabia Saudita': 'AFC',
  Francia: 'UEFA',
  Senegal: 'CAF',
  Noruega: 'UEFA',
  Irak: 'AFC',
  Argentina: 'CONMEBOL',
  Austria: 'UEFA',
  Argelia: 'CAF',
  Jordania: 'AFC',
  Portugal: 'UEFA',
  Colombia: 'CONMEBOL',
  'República Democrática Del Congo': 'CAF',
  'Uzbekistán': 'AFC',
  Inglaterra: 'UEFA',
  Croacia: 'UEFA',
  'Panamá': 'CONCACAF',
  Ghana: 'CAF',
}

const COUNTRY_CODE_BY_COUNTRY = {
  'México': 'MEX',
  'Corea Del Sur': 'KOR',
  'República Checa': 'CZE',
  'Sudáfrica': 'RSA',
  'Canadá': 'CAN',
  Suiza: 'SUI',
  Qatar: 'QAT',
  Bosnia: 'BIH',
  Brasil: 'BRA',
  Marruecos: 'MAR',
  Escocia: 'SCO',
  'Haití': 'HAI',
  'Estados Unidos': 'USA',
  Australia: 'AUS',
  Paraguay: 'PAR',
  'Turquía': 'TUR',
  Alemania: 'GER',
  'Costa De Marfil': 'CIV',
  Curazao: 'CUW',
  Ecuador: 'ECU',
  'Países Bajos': 'NED',
  'Japón': 'JPN',
  Suecia: 'SWE',
  'Túnez': 'TUN',
  'Bélgica': 'BEL',
  Egipto: 'EGY',
  'Nueva Zelanda': 'NZL',
  'Irán': 'IRN',
  'España': 'ESP',
  'Cabo Verde': 'CPV',
  Uruguay: 'URU',
  'Arabia Saudita': 'KSA',
  Francia: 'FRA',
  Senegal: 'SEN',
  Noruega: 'NOR',
  Irak: 'IRQ',
  Argentina: 'ARG',
  Austria: 'AUT',
  Argelia: 'ALG',
  Jordania: 'JOR',
  Portugal: 'POR',
  Colombia: 'COL',
  'República Democrática Del Congo': 'COD',
  'Uzbekistán': 'UZB',
  Inglaterra: 'ENG',
  Croacia: 'CRO',
  'Panamá': 'PAN',
  Ghana: 'GHA',
}

const rawPlayers = JSON.parse(await fs.readFile(PLAYERS_PATH, 'utf8'))
const readyPlayers = rawPlayers.filter((player) => player.enrichmentStatus === 'matched')

const grouped = new Map()

for (const player of readyPlayers) {
  const current = grouped.get(player.countrySlug) ?? {
    country: player.country,
    countrySlug: player.countrySlug,
    players: [],
  }

  current.players.push(player)
  grouped.set(player.countrySlug, current)
}

const teamResults = []
const playerResults = []

for (const group of grouped.values()) {
  const averages = ['attack', 'midfield', 'defense', 'goalkeeping', 'ovr'].reduce((accumulator, key) => {
    const total = group.players.reduce((sum, player) => sum + player[key], 0)
    accumulator[key] = Math.round(total / group.players.length)
    return accumulator
  }, {})

  const confederation = CONFEDERATION_BY_COUNTRY[group.country] ?? 'INVITED'
  const code = COUNTRY_CODE_BY_COUNTRY[group.country] ?? group.countrySlug.slice(0, 3).toUpperCase()
  const teamPayload = {
    slug: group.countrySlug,
    name: group.country,
    code,
    confederation,
    attack: averages.attack,
    midfield: averages.midfield,
    defense: averages.defense,
    goalkeeping: averages.goalkeeping,
    ovr: averages.ovr,
    updatedAt: new Date(),
  }

  const existingTeam = await db.select().from(nationalTeams).where(eq(nationalTeams.slug, group.countrySlug))

  let teamId

  if (existingTeam.length > 0) {
    const [updatedTeam] = await db
      .update(nationalTeams)
      .set(teamPayload)
      .where(eq(nationalTeams.slug, group.countrySlug))
      .returning({ id: nationalTeams.id, slug: nationalTeams.slug })

    teamId = updatedTeam.id
    teamResults.push({ country: group.country, action: 'updated' })
  } else {
    const [createdTeam] = await db
      .insert(nationalTeams)
      .values(teamPayload)
      .returning({ id: nationalTeams.id, slug: nationalTeams.slug })

    teamId = createdTeam.id
    teamResults.push({ country: group.country, action: 'created' })
  }

  for (const player of group.players) {
    const playerPayload = {
      nationalTeamId: teamId,
      slug: player.slug,
      name: player.name,
      shirtNumber: player.shirtNumber,
      primaryPosition: player.primaryPosition,
      secondaryPositions: player.secondaryPositions,
      attack: player.attack,
      midfield: player.midfield,
      defense: player.defense,
      goalkeeping: player.goalkeeping,
      ovr: player.ovr,
      isCaptain: player.isCaptain,
      updatedAt: new Date(),
    }

    const existingPlayer = await db
      .select({ id: players.id })
      .from(players)
      .where(and(eq(players.nationalTeamId, teamId), eq(players.slug, player.slug)))

    if (existingPlayer.length > 0) {
      await db.update(players).set(playerPayload).where(eq(players.id, existingPlayer[0].id))
      playerResults.push({ player: player.name, action: 'updated' })
      continue
    }

    await db.insert(players).values(playerPayload)
    playerResults.push({ player: player.name, action: 'created' })
  }
}

console.log(
  JSON.stringify(
    {
      teamsSeeded: teamResults.length,
      playersSeeded: playerResults.length,
      teamSummary: teamResults,
    },
    null,
    2
  )
)
