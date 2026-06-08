import 'server-only'

import { count } from 'drizzle-orm'

import { getDb, isDatabaseConfigured } from '@/lib/db/client'
import { formations, nationalTeams, players } from '@/lib/db/schema'

export type ProjectOverview = {
  checkedAt: string
  databaseConfigured: boolean
  databaseReachable: boolean
  counts: {
    formations: number
    nationalTeams: number
    players: number
  }
  error: string | null
}

export async function getProjectOverview(): Promise<ProjectOverview> {
  if (!isDatabaseConfigured()) {
    return {
      checkedAt: new Date().toISOString(),
      databaseConfigured: false,
      databaseReachable: false,
      counts: {
        formations: 0,
        nationalTeams: 0,
        players: 0,
      },
      error: 'Configura DATABASE_URL o DATABASE_URL_POOLED para activar Neon.',
    }
  }

  try {
    const db = getDb()

    const [formationCount, nationalTeamCount, playerCount] = await Promise.all([
      db.select({ value: count() }).from(formations),
      db.select({ value: count() }).from(nationalTeams),
      db.select({ value: count() }).from(players),
    ])

    return {
      checkedAt: new Date().toISOString(),
      databaseConfigured: true,
      databaseReachable: true,
      counts: {
        formations: formationCount[0]?.value ?? 0,
        nationalTeams: nationalTeamCount[0]?.value ?? 0,
        players: playerCount[0]?.value ?? 0,
      },
      error: null,
    }
  } catch (error) {
    return {
      checkedAt: new Date().toISOString(),
      databaseConfigured: true,
      databaseReachable: false,
      counts: {
        formations: 0,
        nationalTeams: 0,
        players: 0,
      },
      error: error instanceof Error ? error.message : 'No se pudo consultar Neon.',
    }
  }
}
