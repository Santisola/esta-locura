import 'server-only'

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { cache } from 'react'

import { getPlayerLockReason, isPlayerReadyForMvp } from '@/features/draft/rules'
import type { DraftBootstrap, DraftCountryGroup, DraftPlayer } from '@/features/draft/types'
import { listActiveFormations } from '@/lib/db/queries/formations'
import { listReadyDraftCountries } from '@/lib/db/queries/draft-pool'
import { formationSeeds } from '@/lib/seeds/formations'

type RawGeneratedPlayer = {
  country: string
  countrySlug: string
  name: string
  slug: string
  listedPositionGroup: string
  primaryPosition: string
  secondaryPositions: string[]
  wikidataId: string | null
  enrichmentStatus: 'matched' | 'unmatched'
  birthDate: string | null
  club: string | null
  attack: number
  midfield: number
  defense: number
  goalkeeping: number
  ovr: number
}

const GENERATED_PLAYERS_PATH = path.join(
  process.cwd(),
  'src',
  'lib',
  'seeds',
  'generated',
  'players.mvp.json'
)

const getGeneratedPlayers = cache(async (): Promise<DraftPlayer[]> => {
  const rawFile = await readFile(GENERATED_PLAYERS_PATH, 'utf8')
  const parsed = JSON.parse(rawFile) as RawGeneratedPlayer[]

  return parsed.map((player) => ({
    id: `${player.countrySlug}:${player.slug}`,
    country: player.country,
    countrySlug: player.countrySlug,
    name: player.name,
    slug: player.slug,
    listedPositionGroup: player.listedPositionGroup,
    primaryPosition: player.primaryPosition,
    secondaryPositions: player.secondaryPositions,
    birthDate: player.birthDate,
    club: player.club,
    attack: player.attack,
    midfield: player.midfield,
    defense: player.defense,
    goalkeeping: player.goalkeeping,
    ovr: player.ovr,
    isDataReady: isPlayerReadyForMvp(player),
    lockReason: getPlayerLockReason(player),
    enrichmentStatus: player.enrichmentStatus,
  }))
})

export const getDraftBootstrap = cache(async (): Promise<DraftBootstrap> => {
  const players = await getGeneratedPlayers()
  const dbFormations = await listActiveFormations()
  const readyCountriesFromDb = await listReadyDraftCountries()
  const countriesMap = new Map<string, DraftCountryGroup>()

  for (const player of players) {
    const existing = countriesMap.get(player.countrySlug)

    if (!existing) {
      countriesMap.set(player.countrySlug, {
        country: player.country,
        countrySlug: player.countrySlug,
        totalPlayers: 0,
        readyPlayers: 0,
        blockedPlayers: 0,
        players: [],
      })
    }

    const group = countriesMap.get(player.countrySlug)

    if (!group) {
      continue
    }

    group.players.push(player)
    group.totalPlayers += 1
    group.readyPlayers += player.isDataReady ? 1 : 0
    group.blockedPlayers += player.isDataReady ? 0 : 1
  }

  if (readyCountriesFromDb.length > 0) {
    for (const readyCountry of readyCountriesFromDb) {
      const existing = countriesMap.get(readyCountry.countrySlug)

      if (!existing) {
        countriesMap.set(readyCountry.countrySlug, readyCountry)
        continue
      }

      const blockedPlayers = existing.players.filter((player) => !player.isDataReady)
      const mergedPlayers = [...readyCountry.players, ...blockedPlayers]

      countriesMap.set(readyCountry.countrySlug, {
        country: readyCountry.country,
        countrySlug: readyCountry.countrySlug,
        totalPlayers: mergedPlayers.length,
        readyPlayers: readyCountry.readyPlayers,
        blockedPlayers: blockedPlayers.length,
        players: mergedPlayers,
      })
    }
  }

  const countries = [...countriesMap.values()]
    .map((country) => ({
      ...country,
      players: [...country.players].sort((left, right) => right.ovr - left.ovr || left.name.localeCompare(right.name)),
    }))
    .sort((left, right) => left.country.localeCompare(right.country))

  return {
    summary: {
      totalPlayers: players.length,
      readyPlayers: players.filter((player) => player.isDataReady).length,
      blockedPlayers: players.filter((player) => !player.isDataReady).length,
      totalCountries: countries.length,
    },
    formations: (dbFormations.length > 0 ? dbFormations : formationSeeds).map((formation) => ({
      code: formation.code,
      name: formation.name,
      slots: [...formation.slots],
    })),
    countries,
  }
})

export const getDraftOverview = cache(async () => {
  const { summary } = await getDraftBootstrap()
  return summary
})
