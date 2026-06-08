import { NextResponse } from 'next/server'

import { getProjectOverview } from '@/lib/db/queries/overview'

export async function GET() {
  const overview = await getProjectOverview()

  return NextResponse.json(overview, {
    status: overview.databaseReachable || !overview.databaseConfigured ? 200 : 503,
  })
}
