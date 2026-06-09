import fs from 'node:fs/promises'
import path from 'node:path'

const GENERATED_DIR = path.join(process.cwd(), 'src', 'lib', 'seeds', 'generated')
const PLAYER_NAMES_PATH = path.join(GENERATED_DIR, 'player-names.json')
const OUTPUT_PATH = path.join(GENERATED_DIR, 'fc26-ratings.json')
const STATE_PATH = path.join(process.cwd(), 'fctools-auth.json')
const BASE_URL = 'https://fctoolshub.com'

function cookieHeader(state) {
  return state.cookies.map(c => `${c.name}=${c.value}`).join('; ')
}

async function getInertiaVersion(state) {
  const res = await fetch(`${BASE_URL}/es/database/fc26/players?perPage=1`, {
    headers: {
      'X-Inertia': 'true',
      'Cookie': cookieHeader(state),
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  })
  const json = await res.json()
  return json.version
}

async function searchPlayer(state, version, name) {
  const url = `${BASE_URL}/es/database/fc26/players?filters[aliases][$contains]=${encodeURIComponent(name)}&perPage=5`
  const res = await fetch(url, {
    headers: {
      'X-Inertia': 'true',
      'X-Inertia-Version': version,
      'X-Inertia-Partial-Data': 'players',
      'X-Inertia-Partial-Component': 'Database/Players/DatabasePlayersIndex',
      'Cookie': cookieHeader(state),
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  })
  const json = await res.json()
  return json.props.players.data.map(p => ({
    id: p.id,
    name: p.full_name,
    known_as: p.known_as,
    ovr: p.stats.overall,
    potential: p.stats.potential,
    position: p.main_position?.name,
    club: p.club?.name,
    age: p.age,
  }))
}

function normalizeForCompare(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
}

function scoreMatch(searchName, result) {
  const searchNorm = normalizeForCompare(searchName)
  const nameNorm = normalizeForCompare(result.name)
  const knownNorm = normalizeForCompare(result.known_as)

  if (nameNorm === searchNorm || knownNorm === searchNorm) return 100

  const searchParts = searchNorm.split(/\s+/)
  const nameParts = nameNorm.split(/\s+/)
  const knownParts = knownNorm.split(/\s+/)

  const lastName = searchParts[searchParts.length - 1]
  const firstName = searchParts[0]

  const nameHasLastName = nameNorm.includes(lastName)
  const nameHasFirstName = nameNorm.includes(firstName)
  const knownHasLastName = knownNorm.includes(lastName)
  const knownHasFirstName = knownNorm.includes(firstName)
  const allPartsInName = searchParts.every(p => nameNorm.includes(p))
  const allPartsInKnown = searchParts.every(p => knownNorm.includes(p))

  if (allPartsInName && nameParts.length >= searchParts.length) return 90
  if (allPartsInKnown && knownParts.length >= searchParts.length) return 88
  if (nameHasLastName && nameHasFirstName) return 70
  if (knownHasLastName && knownHasFirstName) return 68
  if (nameHasLastName || knownHasLastName) return 40

  return 0
}

function getBestMatch(searchName, results) {
  if (!results || results.length === 0) return null
  const scored = results.map(r => ({ ...r, score: scoreMatch(searchName, r) }))
  const filtered = scored.filter(r => r.score >= 60)
  if (filtered.length === 0) return null
  filtered.sort((a, b) => b.score - a.score)
  return filtered[0]
}

async function main() {
  console.log('Loading player names...')
  const players = JSON.parse(await fs.readFile(PLAYER_NAMES_PATH, 'utf-8'))
  console.log(`Total players to search: ${players.length}`)

  console.log('Loading browser state...')
  const state = JSON.parse(await fs.readFile(STATE_PATH, 'utf-8'))

  console.log('Getting Inertia version...')
  let version
  try {
    version = await getInertiaVersion(state)
    console.log(`Inertia version: ${version}`)
  } catch (err) {
    console.error('Failed to get Inertia version. State may be expired.', err.message)
    process.exit(1)
  }

  const results = []
  const notFound = []
  const BATCH_SIZE = 10
  const BATCH_DELAY_MS = 400

  for (let i = 0; i < players.length; i += BATCH_SIZE) {
    const batch = players.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.all(
      batch.map(p => searchPlayer(state, version, p.name).catch(() => []))
    )

    for (let j = 0; j < batch.length; j++) {
      const match = getBestMatch(batch[j].name, batchResults[j])
      if (match) {
        results.push({ slug: batch[j].slug, name: batch[j].name, ...match, fc26Found: true })
      } else {
        results.push({ slug: batch[j].slug, name: batch[j].name, fc26Found: false })
        notFound.push(batch[j].name)
      }
    }

    if ((i / BATCH_SIZE) % 25 === 0 || i + BATCH_SIZE >= players.length) {
      const found = results.filter(r => r.fc26Found).length
      console.log(`Progress: ${Math.min(i + BATCH_SIZE, players.length)}/${players.length} (found ${found})`)
    }

    await new Promise(r => setTimeout(r, BATCH_DELAY_MS))
  }

  const foundCount = results.filter(r => r.fc26Found).length
  console.log(`\nDone! Found FC26 ratings for ${foundCount}/${players.length} players`)
  console.log(`Not found (${notFound.length}):`, notFound.slice(0, 20).join(', '), notFound.length > 20 ? '...' : '')

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(results, null, 2), 'utf-8')
  console.log(`\nResults saved to ${OUTPUT_PATH}`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
