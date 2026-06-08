import 'server-only'

import { asc, eq } from 'drizzle-orm'

import { getDb, isDatabaseConfigured } from '@/lib/db/client'
import { formations } from '@/lib/db/schema'

export async function listActiveFormations() {
  if (!isDatabaseConfigured()) {
    return []
  }

  return getDb()
    .select({
      id: formations.id,
      code: formations.code,
      name: formations.name,
      slots: formations.slots,
    })
    .from(formations)
    .where(eq(formations.isActive, true))
    .orderBy(asc(formations.code))
}
