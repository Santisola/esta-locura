import { cookies } from 'next/headers'

const COOKIE_NAME = 'esta-locura-session'

function createSessionToken() {
  return crypto.randomUUID()
}

// Solo lectura: para Server Components (páginas), que no pueden escribir cookies.
// Si no hay sesión todavía, devuelve null y la página muestra el estado vacío.
// La cookie se crea desde los Route Handlers (API) cuando el usuario juega.
export async function getSessionTokenReadOnly() {
  const cookieStore = await cookies()
  return cookieStore.get(COOKIE_NAME)?.value ?? null
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
