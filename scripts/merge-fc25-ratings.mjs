import fs from 'node:fs'

const PLAYERS_PATH = 'src/lib/seeds/generated/players.mvp.json'
const MATCHES_PATH = 'src/lib/seeds/generated/fc25-matches.json'
const NOTFOUND_PATH = 'src/lib/seeds/generated/fc25-notfound.json'
const OUTPUT_PATH = 'src/lib/seeds/generated/players.mvp.json'

const players = JSON.parse(fs.readFileSync(PLAYERS_PATH, 'utf-8'))
const matches = JSON.parse(fs.readFileSync(MATCHES_PATH, 'utf-8'))
const notFound = JSON.parse(fs.readFileSync(NOTFOUND_PATH, 'utf-8'))

const matchBySlug = {}
for (const m of matches) matchBySlug[m.slug] = m

let replaced = 0
let unchanged = 0

for (const p of players) {
  const m = matchBySlug[p.slug]
  if (m) {
    const oldOvr = p.ovr
    p.ovr = m.ovr
    p.fc25Ovr = m.ovr
    p.fc25Name = m.fc25Name
    p.fc25Positions = m.positions
    p.fc25Club = m.club
    p.fc25League = m.clubLeague
    replaced++
  } else {
    p.fc25Ovr = null
    unchanged++
  }
}

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(players, null, 2) + '\n', 'utf-8')

console.log(`Done!`)
console.log(`Replaced with FC25: ${replaced} players`)
console.log(`Kept calculated: ${unchanged} players`)
console.log(`Total: ${players.length} players`)
console.log(`\nSample OVR changes (stars):`)

const stars = ['lionel-messi', 'cristiano-ronaldo', 'kylian-mbappe', 'erling-haaland', 'mohamed-salah',
  'neymar', 'kevin-de-bruyne', 'jude-bellingham', 'lamine-yamal', 'vinicius-junior',
  'alexis-mac-allister', 'julian-alvarez', 'rodrigo-de-paul', 'enzo-fernandez',
  'guillermo-ochoa', 'kim-min-jae', 'luis-diaz']
for (const slug of stars) {
  const p = players.find(x => x.slug === slug)
  if (p) console.log(`  ${p.name.padEnd(25)} OVR: ${p.ovr} (FC25: ${p.fc25Ovr})`)
}
