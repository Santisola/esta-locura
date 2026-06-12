// Segunda pasada de auditoría (junio 2026) sobre players.mvp.json:
//  - Medias adicionales sin sentido: estrellas 2025-26 subvaloradas (<80) y
//    juveniles/desconocidos inflados que la primera pasada (solo 80+) no cubrió.
//  - Fechas de nacimiento imposibles heredadas de homónimos de Wikidata
//    (ej: Tommy Smith de NZ con los datos de un inglés nacido en 1945).
//  - Clubes rotos: selecciones nacionales como club, IDs crudos de Wikidata
//    (Q582342), clubes muy desactualizados de jugadores top y nulls notorios.
//  - Typo de nombre: "Hikori Ito" → Hiroki Ito (Japón/Bayern).
// Igual que fix-ratings-2026.mjs, los cambios de ovr desplazan las 4 líneas.
// Correr con: node scripts/fix-data-2026.mjs — luego re-seedear con db:seed-rosters.
import fs from 'node:fs'

const PLAYERS_PATH = 'src/lib/seeds/generated/players.mvp.json'

const RATINGS = {
  // Subas: nivel 2025-26 claramente superior a la media cargada
  'portugal:joao-neves': 87,
  'francia:desire-doue': 86,
  'turquia:kenan-yildiz': 86,
  'turquia:arda-guler': 85,
  'paises-bajos:ryan-gravenberch': 86,
  'argentina:nico-paz': 84,
  'paises-bajos:micky-van-de-ven': 84,
  'brasil:matheus-cunha': 82,
  'inglaterra:morgan-rogers': 81,
  'ghana:antoine-semenyo': 81,
  'colombia:richard-rios': 80,
  // Bajas: juveniles o desconocidos con media inflada
  'ecuador:gonzalo-plata': 78,
  'escocia:findlay-curtis': 73,
  'egipto:hamza-abdelkarim': 72,
  'haiti:pierre-woodenski': 70,
  'haiti:jean-jaques-danley': 70,
}

// null = se desconoce el dato real con certeza; mejor vacío que inventado.
const BIRTH_DATES = {
  'qatar:pedro-miguel': '1990-08-06',
  'haiti:derrick-etienne': '1996-11-23',
  'estados-unidos:alex-freeman': null,
  'paraguay:juan-caceres': null,
  'paraguay:diego-gomez': '2003-01-27',
  'nueva-zelanda:tommy-smith': '1990-03-31',
  'espana:victor-munoz': '2004-01-24',
  'francia:brice-samba': '1994-04-25',
  'portugal:bernardo-silva': '1994-08-10',
  'colombia:richard-rios': '2000-06-02',
  'portugal:matheus-nunes': '1998-08-27',
  'uruguay:emiliano-martinez': null,
}

const CLUBS = {
  // Selecciones nacionales cargadas como club
  'brasil:casemiro': 'Manchester United F.C.',
  'portugal:ruben-neves': 'Al Hilal SFC',
  'sudafrica:teboho-mokoena': 'Mamelodi Sundowns F.C.',
  'suiza:cedric-itten': 'BSC Young Boys',
  'escocia:kenny-mclean': 'Norwich City F.C.',
  'australia:aziz-behich': 'Melbourne City FC',
  'nueva-zelanda:tim-payne': 'Wellington Phoenix FC',
  'republica-democratica-del-congo:meschack-elia': 'BSC Young Boys',
  'haiti:johnny-placide': null,
  'panama:orlando-mosquera': null,
  'nueva-zelanda:tommy-smith': null,
  // IDs crudos de Wikidata
  'qatar:assim-madibo': 'Al-Duhail SC',
  'irak:frans-dhia-putros': null,
  // Clubes muy desactualizados (temporada 2025-26)
  'brasil:alisson': 'Liverpool F.C.',
  'brasil:ederson': 'Fenerbahçe S.K.',
  'inglaterra:anthony-gordon': 'Newcastle United F.C.',
  'inglaterra:marcus-rashford': 'Fc Barcelona',
  'bosnia:edin-dzeko': 'ACF Fiorentina',
  'alemania:alexander-nubel': 'VfB Stuttgart',
  'alemania:waldemar-anton': 'Borussia Dortmund',
  'austria:kevin-danso': 'Tottenham Hotspur F.C.',
  'austria:christoph-baumgartner': 'RB Leipzig',
  'corea-del-sur:hwang-in-beom': 'Feyenoord',
  'portugal:joao-felix': 'Al-Nassr',
  'uruguay:maximiliano-araujo': 'Sporting CP',
  'marruecos:noussair-mazraoui': 'Manchester United F.C.',
  'paraguay:gustavo-gomez': 'SE Palmeiras',
  'brasil:roger-ibanez': 'Al-Ahli Saudi FC',
  'costa-de-marfil:seko-fofana': 'Stade Rennais F.C.',
  'uruguay:emiliano-martinez': 'FC Midtjylland',
  'haiti:derrick-etienne': 'Atlanta United FC',
  'estados-unidos:alex-freeman': 'Orlando City SC',
  'paraguay:diego-gomez': 'Brighton & Hove Albion F.C.',
  'colombia:richard-rios': 'S.L. Benfica',
  // Nulls notorios de jugadores top
  'portugal:vitinha': 'Paris Saint-Germain FC',
  'portugal:bernardo-silva': 'Manchester City F.C.',
  'brasil:bremer': 'Juventus FC',
  'espana:fabian': 'Paris Saint-Germain FC',
  'espana:gavi': 'Fc Barcelona',
  'ghana:thomas-partey': 'Villarreal CF',
  'portugal:rui-silva': 'Sporting CP',
  'argentina:thiago-almada': 'Atlético Madrid',
  'senegal:pape-matar-sarr': 'Tottenham Hotspur F.C.',
  'portugal:jose-sa': 'Wolverhampton Wanderers F.C.',
  'portugal:matheus-nunes': 'Manchester City F.C.',
  'francia:brice-samba': 'Stade Rennais F.C.',
}

const NAMES = {
  'japon:hikori-ito': 'Hiroki Ito', // typo en el roster; CB de Japón (Bayern)
}
const EXTRA = {
  'japon:hikori-ito': { club: 'FC Bayern Munich', birthDate: '1999-05-12' },
}

const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
const players = JSON.parse(fs.readFileSync(PLAYERS_PATH, 'utf-8'))
const pending = new Set([
  ...Object.keys(RATINGS), ...Object.keys(BIRTH_DATES),
  ...Object.keys(CLUBS), ...Object.keys(NAMES),
])
const log = []

for (const p of players) {
  const key = `${p.countrySlug}:${p.slug}`
  if (!pending.has(key)) continue

  if (key in RATINGS) {
    const delta = RATINGS[key] - p.ovr
    if (delta !== 0) {
      log.push(`ovr   ${p.name} (${p.country}): ${p.ovr} → ${RATINGS[key]}`)
      p.attack = clamp(p.attack + delta, 1, 99)
      p.midfield = clamp(p.midfield + delta, 1, 99)
      p.defense = clamp(p.defense + delta, 1, 99)
      p.goalkeeping = clamp(p.goalkeeping + delta, 1, 99)
      p.ovr = RATINGS[key]
    }
  }
  if (key in BIRTH_DATES && p.birthDate !== BIRTH_DATES[key]) {
    log.push(`nac   ${p.name} (${p.country}): ${p.birthDate} → ${BIRTH_DATES[key]}`)
    p.birthDate = BIRTH_DATES[key]
  }
  if (key in CLUBS && p.club !== CLUBS[key]) {
    log.push(`club  ${p.name} (${p.country}): ${p.club ?? '∅'} → ${CLUBS[key] ?? '∅'}`)
    p.club = CLUBS[key]
  }
  if (key in NAMES) {
    log.push(`name  ${p.name} → ${NAMES[key]}`)
    p.name = NAMES[key]
    Object.assign(p, EXTRA[key])
  }
  pending.delete(key)
}

if (pending.size > 0) {
  console.error('Claves no encontradas (no se escribió nada):')
  for (const key of pending) console.error(`  - ${key}`)
  process.exit(1)
}

fs.writeFileSync(PLAYERS_PATH, JSON.stringify(players, null, 2) + '\n', 'utf-8')
console.log(`${log.length} cambios aplicados:\n`)
for (const line of log) console.log('  ' + line)
