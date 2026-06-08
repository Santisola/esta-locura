import 'server-only'

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'

import * as schema from '@/lib/db/schema'

function resolveDatabaseUrl() {
  return process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL ?? ''
}

let database:
  | ReturnType<typeof drizzle<typeof schema>>
  | null = null

export function isDatabaseConfigured() {
  return resolveDatabaseUrl().length > 0
}

export function getDb() {
  if (!database) {
    const connectionString = resolveDatabaseUrl()

    if (!connectionString) {
      throw new Error('DATABASE_URL o DATABASE_URL_POOLED no esta configurada.')
    }

    database = drizzle({
      client: neon(connectionString),
      schema,
    })
  }

  return database
}
