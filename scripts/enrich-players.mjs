import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const GENERATED_DIR = path.join(ROOT, 'src', 'lib', 'seeds', 'generated')
const INPUT_PATH = path.join(GENERATED_DIR, 'planteles_mundial_2026.clean.csv')
const CACHE_DIR = path.join(GENERATED_DIR, 'cache')
const SEARCH_CACHE_PATH = path.join(CACHE_DIR, 'wikidata-search.json')
const ENTITY_CACHE_PATH = path.join(CACHE_DIR, 'wikidata-entities.json')
const LABEL_CACHE_PATH = path.join(CACHE_DIR, 'wikidata-labels.json')
const OUTPUT_JSON_PATH = path.join(GENERATED_DIR, 'players.mvp.json')
const OUTPUT_CSV_PATH = path.join(GENERATED_DIR, 'players.mvp.csv')
const REPORT_PATH = path.join(GENERATED_DIR, 'players.mvp.report.json')

const SEARCH_CONCURRENCY = 1
const ENTITY_BATCH_SIZE = 40
const LABEL_BATCH_SIZE = 50
const MAX_RETRIES = 5
const SEARCH_DELAY_MS = 120

const COUNTRY_KEYWORDS = {
  'México': ['mexican', 'mexico'],
  'Corea Del Sur': ['south korean', 'south korea', 'korean'],
  'República Checa': ['czech', 'czechia'],
  'Sudáfrica': ['south african', 'south africa'],
  'Canadá': ['canadian', 'canada'],
  Suiza: ['swiss', 'switzerland'],
  Qatar: ['qatari', 'qatar'],
  Bosnia: ['bosnian', 'bosnia'],
  Brasil: ['brazilian', 'brazil'],
  Marruecos: ['moroccan', 'morocco'],
  Escocia: ['scottish', 'scotland'],
  'Haití': ['haitian', 'haiti'],
  'Estados Unidos': ['american', 'united states', 'usa'],
  Australia: ['australian', 'australia'],
  Paraguay: ['paraguayan', 'paraguay'],
  'Turquía': ['turkish', 'turkey'],
  Alemania: ['german', 'germany'],
  'Costa De Marfil': ['ivorian', 'ivory coast', "cote d'ivoire", 'cote divoire'],
  Curazao: ['curaçao', 'curacao', 'curaçaoan', 'curacaoan'],
  Ecuador: ['ecuadorian', 'ecuadorean', 'ecuador'],
  'Países Bajos': ['dutch', 'netherlands'],
  'Japón': ['japanese', 'japan'],
  Suecia: ['swedish', 'sweden'],
  'Túnez': ['tunisian', 'tunisia'],
  'Bélgica': ['belgian', 'belgium'],
  Egipto: ['egyptian', 'egypt'],
  'Nueva Zelanda': ['new zealand', 'new zealander'],
  'Irán': ['iranian', 'iran'],
  'España': ['spanish', 'spain'],
  'Cabo Verde': ['cape verdean', 'cape verde', 'caboverdean'],
  Uruguay: ['uruguayan', 'uruguay'],
  'Arabia Saudita': ['saudi', 'saudi arabia'],
  Francia: ['french', 'france'],
  Senegal: ['senegalese', 'senegal'],
  Noruega: ['norwegian', 'norway'],
  Irak: ['iraqi', 'iraq'],
  Argentina: ['argentine', 'argentinian', 'argentina'],
  Austria: ['austrian', 'austria'],
  Argelia: ['algerian', 'algeria'],
  Jordania: ['jordanian', 'jordan'],
  Portugal: ['portuguese', 'portugal'],
  Colombia: ['colombian', 'colombia'],
  'República Democrática Del Congo': ['congolese', 'democratic republic of the congo', 'dr congo'],
  'Uzbekistán': ['uzbek', 'uzbekistan'],
  Inglaterra: ['english', 'england'],
  Croacia: ['croatian', 'croatia'],
  'Panamá': ['panamanian', 'panama'],
  Ghana: ['ghanaian', 'ghana'],
}

const FOOTBALL_KEYWORDS = ['football', 'soccer']
const NON_FOOTBALL_KEYWORDS = [
  'badminton',
  'baseball',
  'researcher',
  'politician',
  'family name',
  'given name',
  'rugby',
  'cricketer',
  'basketball',
  'coach',
]

const GROUP_TO_DEFAULT_POSITIONS = {
  ARQUEROS: { primary: 'GK', secondary: [] },
  DEFENSORES: { primary: 'CB', secondary: ['LB', 'RB'] },
  MEDIOCAMPISTAS: { primary: 'CM', secondary: ['CDM', 'CAM'] },
  DELANTEROS: { primary: 'ST', secondary: ['LW', 'RW'] },
}

const GROUP_COMPATIBILITY = {
  ARQUEROS: ['GK'],
  DEFENSORES: ['CB', 'LB', 'RB', 'LWB', 'RWB', 'SW'],
  MEDIOCAMPISTAS: ['CDM', 'CM', 'CAM', 'LM', 'RM'],
  DELANTEROS: ['ST', 'CF', 'LW', 'RW', 'LF', 'RF'],
}

const POSITION_LABEL_MAP = new Map([
  ['goalkeeper', 'GK'],
  ['association football goalkeeper', 'GK'],
  ['defender', 'CB'],
  ['central defender', 'CB'],
  ['centre-back', 'CB'],
  ['center back', 'CB'],
  ['centre back', 'CB'],
  ['full-back', 'CB'],
  ['fullback', 'CB'],
  ['sweeper', 'SW'],
  ['left-back', 'LB'],
  ['left back', 'LB'],
  ['right-back', 'RB'],
  ['right back', 'RB'],
  ['left wing-back', 'LWB'],
  ['left wing back', 'LWB'],
  ['right wing-back', 'RWB'],
  ['right wing back', 'RWB'],
  ['midfielder', 'CM'],
  ['association football midfielder', 'CM'],
  ['central midfielder', 'CM'],
  ['centre midfielder', 'CM'],
  ['center midfielder', 'CM'],
  ['defensive midfielder', 'CDM'],
  ['holding midfielder', 'CDM'],
  ['attacking midfielder', 'CAM'],
  ['left midfielder', 'LM'],
  ['right midfielder', 'RM'],
  ['winger', 'RW'],
  ['left winger', 'LW'],
  ['right winger', 'RW'],
  ['left forward', 'LF'],
  ['right forward', 'RF'],
  ['forward', 'ST'],
  ['association football forward', 'ST'],
  ['striker', 'ST'],
  ['centre-forward', 'ST'],
  ['center forward', 'ST'],
  ['second striker', 'CF'],
])

const POSITION_RATINGS = {
  GK: { attack: 12, midfield: 22, defense: 34, goalkeeping: 83, ovr: 76 },
  SW: { attack: 34, midfield: 54, defense: 78, goalkeeping: 6, ovr: 74 },
  CB: { attack: 36, midfield: 55, defense: 80, goalkeeping: 5, ovr: 74 },
  LB: { attack: 49, midfield: 63, defense: 74, goalkeeping: 5, ovr: 75 },
  RB: { attack: 49, midfield: 63, defense: 74, goalkeeping: 5, ovr: 75 },
  LWB: { attack: 58, midfield: 67, defense: 71, goalkeeping: 5, ovr: 75 },
  RWB: { attack: 58, midfield: 67, defense: 71, goalkeeping: 5, ovr: 75 },
  CDM: { attack: 48, midfield: 77, defense: 69, goalkeeping: 5, ovr: 76 },
  CM: { attack: 58, midfield: 79, defense: 60, goalkeeping: 5, ovr: 77 },
  CAM: { attack: 73, midfield: 82, defense: 41, goalkeeping: 5, ovr: 78 },
  LM: { attack: 71, midfield: 77, defense: 43, goalkeeping: 5, ovr: 77 },
  RM: { attack: 71, midfield: 77, defense: 43, goalkeeping: 5, ovr: 77 },
  LW: { attack: 81, midfield: 69, defense: 34, goalkeeping: 5, ovr: 79 },
  RW: { attack: 81, midfield: 69, defense: 34, goalkeeping: 5, ovr: 79 },
  LF: { attack: 80, midfield: 68, defense: 33, goalkeeping: 5, ovr: 79 },
  RF: { attack: 80, midfield: 68, defense: 33, goalkeeping: 5, ovr: 79 },
  CF: { attack: 83, midfield: 66, defense: 31, goalkeeping: 5, ovr: 79 },
  ST: { attack: 85, midfield: 60, defense: 28, goalkeeping: 5, ovr: 80 },
}

function normalizeText(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function slugify(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/\s+/g, '-')
}

function parseCsv(csvText) {
  const [header, ...rows] = csvText.trim().split(/\r?\n/)

  if (header !== 'pais,jugador,posicion_listado') {
    throw new Error('Header inesperado en el CSV limpio')
  }

  return rows.map((line) => {
    const firstComma = line.indexOf(',')
    const lastComma = line.lastIndexOf(',')

    return {
      country: line.slice(0, firstComma),
      player: line.slice(firstComma + 1, lastComma),
      listedPositionGroup: line.slice(lastComma + 1),
    }
  })
}

function csvEscape(value) {
  const stringValue = value == null ? '' : String(value)

  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }

  return stringValue
}

async function readJson(filePath, fallbackValue) {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return JSON.parse(raw)
  } catch {
    return fallbackValue
  }
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8')
}

async function fetchJson(url) {
  let lastError = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    let response

    try {
      response = await fetch(url, {
        headers: {
          'user-agent': 'esta-locura-mvp-seeder/1.0',
        },
      })
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      const waitTime = Math.min(1500 * 2 ** attempt, 12000)
      await new Promise((resolve) => setTimeout(resolve, waitTime))
      continue
    }

    if (response.ok) {
      return response.json()
    }

    if (response.status === 429 || response.status >= 500) {
      const retryAfter = Number(response.headers.get('retry-after'))
      const waitTime = Number.isFinite(retryAfter)
        ? retryAfter * 1000
        : Math.min(1500 * 2 ** attempt, 12000)

      lastError = new Error(`HTTP ${response.status} para ${url}`)
      await new Promise((resolve) => setTimeout(resolve, waitTime))
      continue
    }

    throw new Error(`HTTP ${response.status} para ${url}`)
  }

  throw lastError ?? new Error(`No se pudo obtener ${url}`)
}

function scoreSearchCandidate(player, candidate) {
  const label = normalizeText(candidate.label ?? '')
  const searchName = normalizeText(player.player)
  const description = (candidate.description ?? '').toLowerCase()
  const countryKeywords = COUNTRY_KEYWORDS[player.country] ?? []

  let score = 0

  if (label === searchName) {
    score += 100
  }

  if (candidate.match?.text && normalizeText(candidate.match.text) === searchName) {
    score += 30
  }

  if (description.includes('football')) {
    score += 25
  }

  if (description.includes('soccer')) {
    score += 15
  }

  if (description.includes('player')) {
    score += 10
  }

  if (countryKeywords.some((keyword) => description.includes(keyword))) {
    score += 35
  }

  if (NON_FOOTBALL_KEYWORDS.some((keyword) => description.includes(keyword))) {
    score -= 120
  }

  return score
}

function isFootballDescription(description) {
  const lowerDescription = (description ?? '').toLowerCase()

  return FOOTBALL_KEYWORDS.some((keyword) => lowerDescription.includes(keyword))
}

function hasNonFootballSignals(description) {
  const lowerDescription = (description ?? '').toLowerCase()

  return NON_FOOTBALL_KEYWORDS.some((keyword) => lowerDescription.includes(keyword))
}

function hasCountrySignal(country, description) {
  const lowerDescription = (description ?? '').toLowerCase()
  const countryKeywords = COUNTRY_KEYWORDS[country] ?? []

  return countryKeywords.some((keyword) => lowerDescription.includes(keyword))
}

function isSearchHitUsable(player, hit) {
  if (!hit) {
    return false
  }

  if (hasNonFootballSignals(hit.description)) {
    return false
  }

  if (!isFootballDescription(hit.description)) {
    return false
  }

  return hasCountrySignal(player.country, hit.description) || (hit.score ?? 0) >= 155
}

async function searchWikidata(player, searchCache) {
  const cacheKey = `${slugify(player.country)}::${slugify(player.player)}`

  if (Object.prototype.hasOwnProperty.call(searchCache, cacheKey) && isSearchHitUsable(player, searchCache[cacheKey])) {
    return searchCache[cacheKey]
  }

  const params = new URLSearchParams({
    action: 'wbsearchentities',
    search: player.player,
    language: 'en',
    uselang: 'en',
    type: 'item',
    format: 'json',
    limit: '7',
    origin: '*',
  })

  let payload

  try {
    payload = await fetchJson(`https://www.wikidata.org/w/api.php?${params.toString()}`)
  } catch (error) {
    console.warn(`Busqueda fallida para ${player.player} (${player.country}): ${error instanceof Error ? error.message : String(error)}`)
    searchCache[cacheKey] = null
    return null
  }

  const candidates = Array.isArray(payload.search) ? payload.search : []
  const ranked = [...candidates].sort((left, right) => scoreSearchCandidate(player, right) - scoreSearchCandidate(player, left))
  const winner =
    ranked
      .map((candidate) => ({
        id: candidate.id,
        label: candidate.label ?? null,
        description: candidate.description ?? null,
        score: scoreSearchCandidate(player, candidate),
      }))
      .find((candidate) => isSearchHitUsable(player, candidate)) ?? null

  const result = winner
    ? winner
    : null

  searchCache[cacheKey] = result
  await new Promise((resolve) => setTimeout(resolve, SEARCH_DELAY_MS))
  return result
}

async function runWithConcurrency(items, concurrency, worker) {
  let index = 0

  async function consume() {
    while (index < items.length) {
      const currentIndex = index
      index += 1
      await worker(items[currentIndex], currentIndex)
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => consume())
  await Promise.all(workers)
}

function chunk(array, size) {
  const chunks = []

  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size))
  }

  return chunks
}

async function fetchEntityBatch(ids) {
  const params = new URLSearchParams({
    action: 'wbgetentities',
    ids: ids.join('|'),
    languages: 'en',
    format: 'json',
    props: 'labels|claims',
    origin: '*',
  })

  const payload = await fetchJson(`https://www.wikidata.org/w/api.php?${params.toString()}`)
  return payload.entities ?? {}
}

function getClaimEntityIds(entity, property) {
  const claims = entity?.claims?.[property] ?? []

  return claims
    .map((claim) => claim?.mainsnak?.datavalue?.value?.id)
    .filter((value) => typeof value === 'string')
}

function getBirthDate(entity) {
  const claim = entity?.claims?.P569?.[0]
  const value = claim?.mainsnak?.datavalue?.value?.time

  if (typeof value !== 'string') {
    return null
  }

  return value.slice(1, 11)
}

function getHeightCm(entity) {
  const claim = entity?.claims?.P2048?.[0]
  const amount = claim?.mainsnak?.datavalue?.value?.amount

  if (typeof amount !== 'string') {
    return null
  }

  const rawHeight = Math.abs(Number(amount))

  if (!Number.isFinite(rawHeight)) {
    return null
  }

  if (rawHeight <= 3) {
    return Math.round(rawHeight * 100)
  }

  if (rawHeight <= 300) {
    return Math.round(rawHeight)
  }

  if (rawHeight <= 30000) {
    return Math.round(rawHeight / 100)
  }

  return null
}

function getCurrentClubId(entity) {
  const claims = entity?.claims?.P54 ?? []

  for (const claim of claims) {
    const endTime = claim?.qualifiers?.P582?.[0]?.datavalue?.value?.time

    if (endTime) {
      continue
    }

    const id = claim?.mainsnak?.datavalue?.value?.id

    if (typeof id === 'string') {
      return id
    }
  }

  return claims[0]?.mainsnak?.datavalue?.value?.id ?? null
}

function mapPositionLabelsToCodes(positionLabels) {
  const mapped = []

  for (const label of positionLabels) {
    const normalizedLabel = normalizeText(label).toLowerCase()
    const mappedCode = POSITION_LABEL_MAP.get(normalizedLabel)

    if (mappedCode && !mapped.includes(mappedCode)) {
      mapped.push(mappedCode)
    }
  }

  return mapped
}

function choosePositions(positionCodes, listedPositionGroup) {
  const compatible = GROUP_COMPATIBILITY[listedPositionGroup] ?? []
  const filtered = positionCodes.filter((code) => compatible.includes(code))

  if (filtered.length > 0) {
    return {
      primary: filtered[0],
      secondary: filtered.slice(1, 3),
    }
  }

  return GROUP_TO_DEFAULT_POSITIONS[listedPositionGroup]
}

function calculateAge(birthDate) {
  if (!birthDate) {
    return null
  }

  const birth = new Date(birthDate)

  if (Number.isNaN(birth.getTime())) {
    return null
  }

  const today = new Date()
  let age = today.getUTCFullYear() - birth.getUTCFullYear()
  const monthDelta = today.getUTCMonth() - birth.getUTCMonth()

  if (monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < birth.getUTCDate())) {
    age -= 1
  }

  return age
}

function createDeterministicJitter(seed) {
  let hash = 0

  for (const character of seed) {
    hash = (hash * 31 + character.charCodeAt(0)) % 1000003
  }

  return (hash % 7) - 3
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function applyRatingAdjustments(baseRatings, player) {
  const age = calculateAge(player.birthDate)
  const jitter = createDeterministicJitter(`${player.country}:${player.name}:${player.primaryPosition}`)
  let ageBoost = 0

  if (age != null) {
    if (age >= 24 && age <= 30) {
      ageBoost = 2
    } else if (age <= 20 || age >= 35) {
      ageBoost = -2
    }
  }

  return {
    attack: clamp(baseRatings.attack + jitter + ageBoost, 1, 99),
    midfield: clamp(baseRatings.midfield + jitter + ageBoost, 1, 99),
    defense: clamp(baseRatings.defense + jitter + ageBoost, 1, 99),
    goalkeeping: clamp(baseRatings.goalkeeping + jitter + ageBoost, 1, 99),
    ovr: clamp(baseRatings.ovr + jitter + ageBoost, 1, 99),
  }
}

async function main() {
  await fs.mkdir(CACHE_DIR, { recursive: true })

  const rosterCsv = await fs.readFile(INPUT_PATH, 'utf8')
  const players = parseCsv(rosterCsv)
  const searchCache = await readJson(SEARCH_CACHE_PATH, {})
  const entityCache = await readJson(ENTITY_CACHE_PATH, {})
  const labelCache = await readJson(LABEL_CACHE_PATH, {})

  await runWithConcurrency(players, SEARCH_CONCURRENCY, async (player, index) => {
    await searchWikidata(player, searchCache)

    if ((index + 1) % 100 === 0 || index === players.length - 1) {
      await writeJson(SEARCH_CACHE_PATH, searchCache)
      console.log(`Busquedas completadas: ${index + 1}/${players.length}`)
    }
  })

  const entityIds = [...new Set(Object.values(searchCache).filter(Boolean).map((entry) => entry.id))]
  const missingEntityIds = entityIds.filter((id) => !entityCache[id])

  for (const ids of chunk(missingEntityIds, ENTITY_BATCH_SIZE)) {
    const entities = await fetchEntityBatch(ids)
    Object.assign(entityCache, entities)
    await writeJson(ENTITY_CACHE_PATH, entityCache)
  }

  const linkedIds = new Set()

  for (const entityId of entityIds) {
    const entity = entityCache[entityId]

    for (const positionId of getClaimEntityIds(entity, 'P413')) {
      linkedIds.add(positionId)
    }

    const clubId = getCurrentClubId(entity)

    if (clubId) {
      linkedIds.add(clubId)
    }
  }

  const missingLinkedIds = [...linkedIds].filter((id) => !labelCache[id])

  for (const ids of chunk(missingLinkedIds, LABEL_BATCH_SIZE)) {
    const labelsPayload = await fetchEntityBatch(ids)

    for (const [id, entity] of Object.entries(labelsPayload)) {
      labelCache[id] = entity?.labels?.en?.value ?? id
    }

    await writeJson(LABEL_CACHE_PATH, labelCache)
  }

  const enrichedPlayers = players.map((player) => {
    const searchKey = `${slugify(player.country)}::${slugify(player.player)}`
    const searchHit = searchCache[searchKey]
    const entity = searchHit ? entityCache[searchHit.id] : null
    const positionCodes = searchHit
      ? mapPositionLabelsToCodes(
          getClaimEntityIds(entity, 'P413').map((id) => labelCache[id]).filter(Boolean)
        )
      : []
    const chosenPositions = choosePositions(positionCodes, player.listedPositionGroup)
    const baseRatings = POSITION_RATINGS[chosenPositions.primary] ?? POSITION_RATINGS.ST
    const birthDate = entity ? getBirthDate(entity) : null
    const clubId = entity ? getCurrentClubId(entity) : null
    const heightCm = entity ? getHeightCm(entity) : null
    const enriched = {
      country: player.country,
      countrySlug: slugify(player.country),
      name: player.player,
      slug: slugify(player.player),
      listedPositionGroup: player.listedPositionGroup,
      primaryPosition: chosenPositions.primary,
      secondaryPositions: chosenPositions.secondary,
      wikidataId: searchHit?.id ?? null,
      wikidataLabel: searchHit?.label ?? null,
      wikidataDescription: searchHit?.description ?? null,
      enrichmentStatus: searchHit ? 'matched' : 'unmatched',
      birthDate,
      heightCm,
      club: clubId ? labelCache[clubId] ?? null : null,
      shirtNumber: null,
      isCaptain: false,
      ...applyRatingAdjustments(baseRatings, {
        country: player.country,
        name: player.player,
        birthDate,
        primaryPosition: chosenPositions.primary,
      }),
    }

    return enriched
  })

  const unmatchedPlayers = enrichedPlayers
    .filter((player) => player.enrichmentStatus === 'unmatched')
    .map((player) => ({
      country: player.country,
      name: player.name,
      listedPositionGroup: player.listedPositionGroup,
      slug: player.slug,
    }))

  const report = {
    totalPlayers: enrichedPlayers.length,
    matchedPlayers: enrichedPlayers.filter((player) => player.enrichmentStatus === 'matched').length,
    unmatchedPlayers: enrichedPlayers.filter((player) => player.enrichmentStatus === 'unmatched').length,
    playersWithBirthDate: enrichedPlayers.filter((player) => player.birthDate).length,
    playersWithClub: enrichedPlayers.filter((player) => player.club).length,
    playersWithHeight: enrichedPlayers.filter((player) => Number.isInteger(player.heightCm)).length,
    unmatchedSample: unmatchedPlayers.slice(0, 25),
  }

  const csvHeader = [
    'pais',
    'country_slug',
    'jugador',
    'slug',
    'posicion_listado',
    'primary_position',
    'secondary_positions',
    'wikidata_id',
    'wikidata_label',
    'wikidata_description',
    'enrichment_status',
    'birth_date',
    'height_cm',
    'club',
    'shirt_number',
    'is_captain',
    'attack',
    'midfield',
    'defense',
    'goalkeeping',
    'ovr',
  ]

  const csvRows = enrichedPlayers.map((player) =>
    [
      player.country,
      player.countrySlug,
      player.name,
      player.slug,
      player.listedPositionGroup,
      player.primaryPosition,
      JSON.stringify(player.secondaryPositions),
      player.wikidataId,
      player.wikidataLabel,
      player.wikidataDescription,
      player.enrichmentStatus,
      player.birthDate,
      player.heightCm,
      player.club,
      player.shirtNumber,
      player.isCaptain,
      player.attack,
      player.midfield,
      player.defense,
      player.goalkeeping,
      player.ovr,
    ].map(csvEscape).join(',')
  )

  await fs.writeFile(OUTPUT_JSON_PATH, JSON.stringify(enrichedPlayers, null, 2), 'utf8')
  await fs.writeFile(OUTPUT_CSV_PATH, [csvHeader.join(','), ...csvRows].join('\n') + '\n', 'utf8')
  await fs.writeFile(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8')

  console.log(JSON.stringify({ outputJson: path.relative(ROOT, OUTPUT_JSON_PATH), outputCsv: path.relative(ROOT, OUTPUT_CSV_PATH), reportPath: path.relative(ROOT, REPORT_PATH), ...report }, null, 2))
}

await main()
