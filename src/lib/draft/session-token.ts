import { cookies } from 'next/headers'

const COOKIE_NAME = 'esta-locura-session'

function createSessionToken() {
  return crypto.randomUUID()
}

export async function getOrCreateSessionToken() {
  const cookieStore = await cookies()
  const existing = cookieStore.get(COOKIE_NAME)?.value

  if (existing) {
    return existing
  }

  const sessionToken = createSessionToken()

  cookieStore.set(COOKIE_NAME, sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })

  return sessionToken
}
