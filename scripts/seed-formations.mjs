import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq } from 'drizzle-orm'

import { formations } from '../src/lib/db/schema.ts'

const connectionString = process.env.DATABASE_URL ?? process.env.DATABASE_URL_POOLED

if (!connectionString) {
  throw new Error('DATABASE_URL o DATABASE_URL_POOLED no esta configurada.')
}

const db = drizzle({
  client: neon(connectionString),
})

const formationSeeds = [
  {
    code: '4-3-3',
    name: '4-3-3 Presion Alta',
    slots: [
      { code: 'GK', lane: 'GK', order: 1 },
      { code: 'RB', lane: 'DEF', order: 2 },
      { code: 'CB1', lane: 'DEF', order: 3 },
      { code: 'CB2', lane: 'DEF', order: 4 },
      { code: 'LB', lane: 'DEF', order: 5 },
      { code: 'CM1', lane: 'MID', order: 6 },
      { code: 'CM2', lane: 'MID', order: 7 },
      { code: 'CM3', lane: 'MID', order: 8 },
      { code: 'RW', lane: 'ATT', order: 9 },
      { code: 'ST', lane: 'ATT', order: 10 },
      { code: 'LW', lane: 'ATT', order: 11 },
    ],
  },
  {
    code: '4-4-2',
    name: '4-4-2 Clasico',
    slots: [
      { code: 'GK', lane: 'GK', order: 1 },
      { code: 'RB', lane: 'DEF', order: 2 },
      { code: 'CB1', lane: 'DEF', order: 3 },
      { code: 'CB2', lane: 'DEF', order: 4 },
      { code: 'LB', lane: 'DEF', order: 5 },
      { code: 'RM', lane: 'MID', order: 6 },
      { code: 'CM1', lane: 'MID', order: 7 },
      { code: 'CM2', lane: 'MID', order: 8 },
      { code: 'LM', lane: 'MID', order: 9 },
      { code: 'ST1', lane: 'ATT', order: 10 },
      { code: 'ST2', lane: 'ATT', order: 11 },
    ],
  },
  {
    code: '3-4-3',
    name: '3-4-3 Vertical',
    slots: [
      { code: 'GK', lane: 'GK', order: 1 },
      { code: 'CB1', lane: 'DEF', order: 2 },
      { code: 'CB2', lane: 'DEF', order: 3 },
      { code: 'CB3', lane: 'DEF', order: 4 },
      { code: 'RM', lane: 'MID', order: 5 },
      { code: 'CM1', lane: 'MID', order: 6 },
      { code: 'CM2', lane: 'MID', order: 7 },
      { code: 'LM', lane: 'MID', order: 8 },
      { code: 'RW', lane: 'ATT', order: 9 },
      { code: 'ST', lane: 'ATT', order: 10 },
      { code: 'LW', lane: 'ATT', order: 11 },
    ],
  },
]

const results = []

for (const formation of formationSeeds) {
  const existing = await db.select().from(formations).where(eq(formations.code, formation.code))

  if (existing.length > 0) {
    const [updated] = await db
      .update(formations)
      .set({
        name: formation.name,
        slots: formation.slots,
        isActive: true,
      })
      .where(eq(formations.code, formation.code))
      .returning({ code: formations.code })

    results.push({ code: updated.code, action: 'updated' })
    continue
  }

  const [created] = await db
    .insert(formations)
    .values({
      code: formation.code,
      name: formation.name,
      slots: formation.slots,
      isActive: true,
    })
    .returning({ code: formations.code })

  results.push({ code: created.code, action: 'created' })
}

console.log(JSON.stringify({ seeded: results.length, results }, null, 2))
