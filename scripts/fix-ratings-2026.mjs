// Corrección manual de medias (ovr) para jugadores 80+ cuyo rating no refleja
// su nivel actual (mitad de 2026). Dos categorías:
//  - Ajustes de forma/edad: estrellas sub o sobrevaloradas vs. temporada 2025-26.
//  - Mismatches de Wikidata/FC25: jugadores poco conocidos que heredaron una media
//    inflada de otro futbolista homónimo (ej: Emiliano Martínez de Uruguay con 87).
// Al cambiar la ovr se desplazan las 4 líneas (attack/midfield/defense/goalkeeping)
// en el mismo delta, igual que hace applyRatingAdjustments en enrich-players.mjs,
// para que los equipos drafteados (que promedian líneas) queden consistentes.
// Correr con: node scripts/fix-ratings-2026.mjs — luego re-seedear con db:seed-rosters.
import fs from 'node:fs'

const PLAYERS_PATH = 'src/lib/seeds/generated/players.mvp.json'

// key: `${countrySlug}:${slug}` (el slug solo no es único — hay dos emiliano-martinez)
const CORRECTIONS = {
  // --- Subas: nivel actual claramente por encima de la media cargada ---
  'espana:lamine-yamal': 89,
  'francia:ousmane-dembele': 90, // Balón de Oro 2025
  'espana:pedri': 89,
  'portugal:vitinha': 88,
  'brasil:raphinha': 88,
  'marruecos:achraf-hakimi': 87,
  'argentina:julian-alvarez': 87,
  'francia:michael-olise': 87,
  'suecia:alexander-isak': 87,
  'suecia:viktor-gyokeres': 86,
  'ecuador:moises-caicedo': 87,
  'argentina:enzo-fernandez': 86,
  'francia:dayot-upamecano': 86,
  'espana:fabian': 86,
  'espana:martin-zubimendi': 85,
  'croacia:josko-gvardiol': 85,
  'portugal:nuno-mendes': 86,
  'colombia:luis-diaz': 86,
  'paises-bajos:tijjani-reijnders': 85,
  'espana:marc-cucurella': 84,
  'inglaterra:eberechi-eze': 84,
  'inglaterra:marc-guehi': 84,
  'espana:mikel-oyarzabal': 84,
  'francia:marcus-thuram': 85,
  'ecuador:piero-hincapie': 83,
  'belgica:jeremy-doku': 84,
  'estados-unidos:christian-pulisic': 84,
  'espana:ferran-torres': 84,

  // --- Bajas: edad, lesiones o caída de nivel/liga ---
  'belgica:kevin-de-bruyne': 87,
  'brasil:neymar-junior': 83,
  'brasil:ederson': 85,
  'corea-del-sur:son-heung-min': 85,
  'francia:theo-hernandez': 84,
  'suiza:granit-xhaka': 84,
  'uruguay:giorgian-de-arrascaeta': 83,
  'portugal:joao-cancelo': 84,
  'alemania:antonio-rudiger': 86,
  'noruega:martin-odegaard': 87,
  'argelia:riyad-mahrez': 83,
  'francia:n-golo-kante': 83,
  'inglaterra:john-stones': 83,
  'escocia:andy-robertson': 83,
  'inglaterra:ollie-watkins': 83,
  'bosnia:edin-dzeko': 79,
  'brasil:fabinho': 80,
  'colombia:luis-suarez': 80,
  'uruguay:fernando-muslera': 78,
  'inglaterra:jordan-henderson': 77,
  'suiza:gregor-kobel': 87,
  'alemania:leroy-sane': 84,
  'belgica:romelu-lukaku': 81,
  'alemania:florian-wirtz': 87,
  'brasil:rayan': 78,
  'alemania:lennart-karl': 77,

  // --- Mismatches: media heredada de un homónimo o inflada sin respaldo ---
  'uruguay:emiliano-martinez': 75, // mediocampista del Midtjylland, no el Dibu
  'uruguay:maximiliano-araujo': 80,
  'marruecos:ayoube-amaimouni': 72,
  'uruguay:brian-rodriguez': 78,
  'panama:tomas-rodriguez': 71,
  'sudafrica:ronwen-williams': 80,
  'colombia:james-rodriguez': 80,
  'republica-checa:denis-visinsky': 72,
  'haiti:josue-duverger': 70,
  'japon:kento-shiogai': 71,
  'curazao:gervane-kastaneer': 70,
  'haiti:dominique-simon': 68,
  'cabo-verde:willy-semedo': 72,
  'uzbekistan:igor-sergeev': 73,
  'espana:victor-munoz': 75, // Wikidata matcheó al ex DT nacido en 1957
  'uzbekistan:dostonbek-khamdamov': 72,
  'arabia-saudita:abdullah-al-hamdan': 74,
  'croacia:marco-pasalic': 75,
}

const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

const players = JSON.parse(fs.readFileSync(PLAYERS_PATH, 'utf-8'))
const pending = new Set(Object.keys(CORRECTIONS))
const changes = []

for (const p of players) {
  const key = `${p.countrySlug}:${p.slug}`
  const newOvr = CORRECTIONS[key]
  if (newOvr == null) continue

  const delta = newOvr - p.ovr
  if (delta !== 0) {
    changes.push({ key, name: p.name, country: p.country, from: p.ovr, to: newOvr, delta })
    p.attack = clamp(p.attack + delta, 1, 99)
    p.midfield = clamp(p.midfield + delta, 1, 99)
    p.defense = clamp(p.defense + delta, 1, 99)
    p.goalkeeping = clamp(p.goalkeeping + delta, 1, 99)
    p.ovr = newOvr
  }
  pending.delete(key)
}

if (pending.size > 0) {
  console.error('No se encontraron estos jugadores (no se escribió nada):')
  for (const key of pending) console.error(`  - ${key}`)
  process.exit(1)
}

fs.writeFileSync(PLAYERS_PATH, JSON.stringify(players, null, 2) + '\n', 'utf-8')

changes.sort((a, b) => b.delta - a.delta)
console.log(`Corregidos ${changes.length} jugadores:\n`)
for (const c of changes) {
  const arrow = c.delta > 0 ? '↑' : '↓'
  console.log(`  ${arrow} ${c.name.padEnd(28)} (${c.country.padEnd(15)}) ${c.from} → ${c.to}`)
}
