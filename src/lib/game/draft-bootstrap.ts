import 'server-only'

import { cache } from 'react'

import type { DraftBootstrap } from '@/features/draft/types'
import { listActiveFormations } from '@/lib/db/queries/formations'
import { listReadyDraftCountries } from '@/lib/db/queries/draft-pool'
import { formationSeeds } from '@/lib/seeds/formations'

// Fuente única del pool de draft: la base de datos (sembrada desde el JSON con
// `db:seed-rosters`). Antes este módulo mezclaba el JSON generado con la DB, lo
// que producía IDs distintos para el mismo jugador (`slug:slug` vs UUID) y un
// merge impredecible. Ahora el draft consume solo IDs de DB, que son los que
// resuelven los picks al persistir y simular.
export const getDraftBootstrap = cache(async (): Promise<DraftBootstrap> => {
  const [countriesRaw, dbFormations] = await Promise.all([
    listReadyDraftCountries(),
    listActiveFormations(),
  ])

  const countries = countriesRaw
    .map((country) => ({
      ...country,
      players: [...country.players].sort(
        (left, right) => right.ovr - left.ovr || left.name.localeCompare(right.name),
      ),
    }))
    .sort((left, right) => left.country.localeCompare(right.country))

  const totalPlayers = countries.reduce((sum, country) => sum + country.totalPlayers, 0)
  const readyPlayers = countries.reduce((sum, country) => sum + country.readyPlayers, 0)

  const formations = (dbFormations.length > 0 ? dbFormations : formationSeeds).map((formation) => ({
    code: formation.code,
    name: formation.name,
    slots: [...formation.slots],
  }))

  return {
    summary: {
      totalPlayers,
      readyPlayers,
      blockedPlayers: totalPlayers - readyPlayers,
      totalCountries: countries.length,
    },
    formations,
    countries,
  }
})

export const getDraftOverview = cache(async () => {
  const { summary } = await getDraftBootstrap()
  return summary
})
