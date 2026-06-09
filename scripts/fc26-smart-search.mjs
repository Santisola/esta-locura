import fs from 'node:fs/promises'
import path from 'node:path'

const GENERATED_DIR = path.join(process.cwd(), 'src', 'lib', 'seeds', 'generated')
const PLAYERS_PATH = path.join(GENERATED_DIR, 'players.mvp.json')

const API = 'https://drop-api.ea.com/rating/ea-sports-fc?locale=es&limit=5&search='
const HEADERS = { Referer: 'https://www.ea.com/', 'User-Agent': 'Mozilla/5.0' }

function nrm(s) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim()
}

function makeQueries(name) {
  const norm = nrm(name)
  const parts = norm.split(/\s+/).filter(Boolean)
  const queries = [name]
  if (parts.length > 1) queries.push(parts[0])
  queries.push(parts[parts.length - 1])
  if (parts.length > 1) queries.push(`${parts[parts.length - 1]} ${parts[0]}`)
  if (parts.length === 2) queries.push(parts.join(''))
  return [...new Set(queries)]
}

function scoreMatch(searchName, item) {
  const searchNorm = nrm(searchName)
  const fullName = nrm(`${item.firstName ?? ''} ${item.lastName ?? ''}`)
  const searchParts = searchNorm.split(/\s+/)
  const nameParts = fullName.split(/\s+/)
  const lastName = item.lastName ? nrm(item.lastName) : ''
  const firstName = item.firstName ? nrm(item.firstName) : ''
  let score = 0
  if (fullName === searchNorm) score = 100
  else if (searchParts.every(p => fullName.includes(p))) score = 85
  else if (lastName && searchParts.some(p => lastName.includes(p) || p.includes(lastName))) score = 50
  else if (firstName && searchParts.some(p => firstName.includes(p))) score = 40
  return score
}

function findBest(searchName, results, playerCountry) {
  if (!results?.length) return null
  const scored = results.map(r => ({
    id: r.id,
    name: `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim(),
    ovr: r.overallRating,
    position: r.position?.shortLabel ?? r.position?.label ?? '',
    nationality: r.nationality?.label ?? '',
    club: r.team?.label ?? '',
    score: scoreMatch(searchName, r),
  }))
  const filtered = scored.filter(r => {
    if (r.score >= 85) return true
    if (r.score >= 50) {
      const natMatch = nrm(r.nationality).includes(nrm(playerCountry)) || nrm(playerCountry).includes(nrm(r.nationality))
      return natMatch
    }
    return false
  })
  if (!filtered.length) return null
  filtered.sort((a, b) => b.score - a.score)
  return filtered[0]
}

async function searchEA(query) {
  try {
    const res = await fetch(API + encodeURIComponent(query), { headers: HEADERS })
    if (!res.ok) return null
    const data = await res.json()
    return data.items ?? []
  } catch { return null }
}

async function main() {
  const players = JSON.parse(await fs.readFile(PLAYERS_PATH, 'utf-8'))
  const target = players.filter(p => !p.fc26Ovr && (p.fc25Ovr || p.ovr > 80))
  console.log(`Targets without FC26: ${target.length} (${players.filter(p => !p.fc26Ovr).length} total without FC26)`)
  const found = []
  const notFound = []
  let searchCount = 0

  for (let i = 0; i < target.length; i++) {
    const p = target[i]
    const queries = makeQueries(p.name)
    let best = null
    for (const q of queries) {
      searchCount++
      const results = await searchEA(q)
      if (!results) continue
      best = findBest(q, results, p.country)
      if (best && best.score >= 85) break
    }
    if (best) {
      found.push({ slug: p.slug, name: p.name, country: p.country, fc26Ovr: best.ovr, fc26Name: best.name, fc26Positions: best.position, fc26Club: best.club })
      console.log(`FOUND: ${p.name} (${p.country}) -> ${best.name} OVR ${best.ovr}`)
    } else {
      notFound.push(p.name)
    }
    if ((i + 1) % 10 === 0) console.log(`Progress: ${i + 1}/${target.length} (found ${found.length}, searches ${searchCount})`)
    await new Promise(r => setTimeout(r, 100))
  }

  console.log(`\nDone! Found FC26 for ${found.length}/${target.length}`)
  console.log(`Not found (${notFound.length}): ${notFound.slice(0, 20).join(', ')}`)

  const output = { searchDate: new Date().toISOString(), targetCount: target.length, found, notFound }
  const outPath = path.join(GENERATED_DIR, 'fc26-smart-search.json')
  await fs.writeFile(outPath, JSON.stringify(output, null, 2), 'utf-8')
  console.log(`Results saved to ${outPath}`)

  let updated = 0
  for (const f of found) {
    const idx = players.findIndex(p => p.slug === f.slug && p.country === f.country)
    if (idx === -1) continue
    players[idx].fc26Ovr = f.fc26Ovr
    players[idx].fc26Name = f.fc26Name
    players[idx].fc26Positions = f.fc26Positions
    players[idx].fc26Club = f.fc26Club
    players[idx].ovr = f.fc26Ovr
    players[idx].enrichmentStatus = 'fc26_match'
    updated++
  }

  await fs.writeFile(PLAYERS_PATH, JSON.stringify(players, null, 2), 'utf-8')
  console.log(`Updated ${updated} players in players.mvp.json`)
}

main().catch(e => { console.error(e); process.exit(1) })
