import fs from 'node:fs'
import path from 'node:path'

const GENERATED_DIR = path.join(process.cwd(), 'src', 'lib', 'seeds', 'generated')

function parseLine(line) {
  const result = []; let cur = ''; let q = false
  for (const ch of line) {
    if (ch === '"' && !q) { q = true; continue }
    if (ch === '"' && q) { q = false; continue }
    if (ch === ',' && !q) { result.push(cur); cur = ''; continue }
    cur += ch
  }
  result.push(cur)
  return result
}

const fc25Raw = fs.readFileSync(path.join(GENERATED_DIR, 'fc25-players.csv'), 'utf-8')
const lines = fc25Raw.split('\n')
const header = parseLine(lines[0])
const hIdx = name => header.indexOf(name)

const nameI = hIdx('full_name'), name2I = hIdx('name')
const ovrI = hIdx('overall_rating'), potI = hIdx('potential')
const posI = hIdx('positions'), clubI = hIdx('club_name')
const leagueI = hIdx('club_league_name'), countryI = hIdx('country_name')

function normalize(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim().replace(/\s+/g, ' ')
}

console.log('Building FC25 index...')
const index = new Map()
for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue
  const f = parseLine(lines[i])
  if (f.length < header.length) continue
  const fn = normalize(f[nameI]) || normalize(f[name2I])
  if (!fn) continue
  const names = fn.split(' ')
  for (const n of names) {
    if (n.length < 2) continue
    if (!index.has(n)) index.set(n, [])
    index.get(n).push({ idx: i, raw: f, normalized: fn })
  }
}

console.log(`Index built: ${index.size} unique name tokens`)

const ourPlayers = JSON.parse(fs.readFileSync(path.join(GENERATED_DIR, 'player-names.json'), 'utf-8'))
console.log(`Our players: ${ourPlayers.length}`)

function scoreMatch(searchName, fc25NormalizedName) {
  const sn = searchName.split(' ')
  const nn = fc25NormalizedName.split(' ')
  const ln = sn[sn.length - 1]
  const fn = sn[0]
  const nnHasLn = nn.includes(ln)
  const nnHasFn = nn.includes(fn)
  const allInName = sn.every(p => nn.includes(p))
  if (allInName && nn.length >= sn.length) return 90
  if (nnHasLn && nnHasFn) return 70
  if (nnHasLn) return 40
  return 0
}

function findBestMatch(searchName) {
  const sn = normalize(searchName)
  const tokens = sn.split(' ')
  let candidates = new Set()

  for (const token of tokens) {
    if (token.length < 2) continue
    const matches = index.get(token)
    if (matches) {
      for (const m of matches) candidates.add(m)
    }
  }

  let best = null, bestScore = 0
  for (const c of candidates) {
    const score = scoreMatch(sn, c.normalized)
    if (score > bestScore) { bestScore = score; best = c }
  }

  if (!best || bestScore < 60) return null

  const f = best.raw
  return {
    ovr: parseInt(f[ovrI], 10),
    potential: parseInt(f[potI], 10),
    positions: f[posI],
    club: f[clubI],
    clubLeague: f[leagueI],
    fc25Name: f[nameI] || f[name2I],
  }
}

const matches = []
const notFound = []

for (const player of ourPlayers) {
  const match = findBestMatch(player.name)
  if (match) {
    matches.push({ slug: player.slug, name: player.name, country: player.country, ...match })
  } else {
    notFound.push(player.name)
  }
}

console.log(`\nMatched: ${matches.length}/${ourPlayers.length}`)
console.log(`Not found: ${notFound.length}`)
console.log(`\nTop 20 matches:`)
matches.slice(0, 20).forEach(m => console.log(`  ${m.name.padEnd(25)} → OVR ${m.ovr} (${m.fc25Name})`))
console.log(`\nNot found sample:`)
notFound.slice(0, 30).forEach(n => console.log(`  ${n}`))

fs.writeFileSync(path.join(GENERATED_DIR, 'fc25-matches.json'), JSON.stringify(matches, null, 2))
fs.writeFileSync(path.join(GENERATED_DIR, 'fc25-notfound.json'), JSON.stringify(notFound, null, 2))
console.log(`\nSaved to fc25-matches.json and fc25-notfound.json`)
