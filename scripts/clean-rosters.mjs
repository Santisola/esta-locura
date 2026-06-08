import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const INPUT_PATH = path.join(ROOT, 'planteles_mundial_2026.csv')
const OUTPUT_DIR = path.join(ROOT, 'src', 'lib', 'seeds', 'generated')
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'planteles_mundial_2026.clean.csv')
const REPORT_PATH = path.join(OUTPUT_DIR, 'planteles_mundial_2026.clean.report.json')

const POSITION_GROUP_MAP = {
  ARQUEROS: 'ARQUEROS',
  DEFENSORES: 'DEFENSORES',
  VOLANTES: 'MEDIOCAMPISTAS',
  MEDIOCAMPISTAS: 'MEDIOCAMPISTAS',
  DELANTEROS: 'DELANTEROS',
}

const MANUAL_SPLITS = new Map([
  ['Rayan e Igor Thiago', ['Rayan', 'Igor Thiago']],
  ['Kevin Rodriguez Jordy Caicedo', ['Kevin Rodriguez', 'Jordy Caicedo']],
  ['Dominik Kotarski e Ivor Pandur', ['Dominik Kotarski', 'Ivor Pandur']],
  ['Yousef Qashi e Ibrahim Sadeh', ['Yousef Qashi', 'Ibrahim Sadeh']],
  ['Ali Olwan e Ibrahim Sabra', ['Ali Olwan', 'Ibrahim Sabra']],
])

function normalizeKey(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitCsvRow(rawLine) {
  const firstComma = rawLine.indexOf(',')
  const lastComma = rawLine.lastIndexOf(',')

  if (firstComma === -1 || lastComma === -1 || firstComma === lastComma) {
    throw new Error(`Fila invalida: ${rawLine}`)
  }

  return {
    country: rawLine.slice(0, firstComma).trim(),
    player: rawLine.slice(firstComma + 1, lastComma).trim(),
    listedPosition: rawLine.slice(lastComma + 1).trim(),
  }
}

function cleanupPlayerName(player) {
  return player
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitPlayerName(player) {
  const manual = MANUAL_SPLITS.get(normalizeKey(player))

  if (manual) {
    return manual
  }

  if (!player.includes(' e ')) {
    return [player]
  }

  const parts = player
    .split(/\se\s/)
    .map((part) => part.trim())
    .filter(Boolean)

  return parts.length > 1 ? parts : [player]
}

function needsMergeWithNext(row) {
  return row.player.includes('(') && !row.player.includes(')')
}

function csvEscape(value) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }

  return value
}

const rawCsv = await fs.readFile(INPUT_PATH, 'utf8')
const lines = rawCsv.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean)
const [headerLine, ...rawRows] = lines

if (headerLine.trim() !== 'pais,jugador,posicion_listado') {
  throw new Error('Header inesperado en planteles_mundial_2026.csv')
}

const parsedRows = rawRows.map(splitCsvRow)
const mergedRows = []
const report = {
  totalInputRows: parsedRows.length,
  mergedRows: [],
  strippedAnnotations: [],
  splitPlayers: [],
  normalizedPositions: {},
  duplicatesRemoved: 0,
  totalOutputRows: 0,
}

for (let index = 0; index < parsedRows.length; index += 1) {
  const current = parsedRows[index]

  if (
    needsMergeWithNext(current) &&
    index + 1 < parsedRows.length &&
    parsedRows[index + 1].country === current.country &&
    parsedRows[index + 1].listedPosition === current.listedPosition
  ) {
    const next = parsedRows[index + 1]
    const mergedPlayer = `${current.player}, ${next.player}`

    mergedRows.push({
      ...current,
      player: mergedPlayer,
    })

    report.mergedRows.push({
      country: current.country,
      listedPosition: current.listedPosition,
      from: [current.player, next.player],
      to: mergedPlayer,
    })

    index += 1
    continue
  }

  mergedRows.push(current)
}

const outputRows = []
const seen = new Set()

for (const row of mergedRows) {
  const normalizedPosition = POSITION_GROUP_MAP[row.listedPosition] ?? row.listedPosition
  report.normalizedPositions[row.listedPosition] = normalizedPosition

  const cleanedName = cleanupPlayerName(row.player)

  if (cleanedName !== row.player) {
    report.strippedAnnotations.push({
      country: row.country,
      from: row.player,
      to: cleanedName,
    })
  }

  const splitNames = splitPlayerName(cleanedName)

  if (splitNames.length > 1) {
    report.splitPlayers.push({
      country: row.country,
      from: cleanedName,
      to: splitNames,
    })
  }

  for (const playerName of splitNames) {
    const normalizedPlayerName = playerName.replace(/\s+/g, ' ').trim()

    if (!normalizedPlayerName) {
      continue
    }

    const dedupeKey = `${normalizeKey(row.country)}::${normalizeKey(normalizedPlayerName)}::${normalizedPosition}`

    if (seen.has(dedupeKey)) {
      report.duplicatesRemoved += 1
      continue
    }

    seen.add(dedupeKey)
    outputRows.push({
      country: row.country,
      player: normalizedPlayerName,
      listedPosition: normalizedPosition,
    })
  }
}

report.totalOutputRows = outputRows.length

await fs.mkdir(OUTPUT_DIR, { recursive: true })
await fs.writeFile(
  OUTPUT_PATH,
  ['pais,jugador,posicion_listado', ...outputRows.map((row) => [row.country, row.player, row.listedPosition].map(csvEscape).join(','))].join('\n') + '\n',
  'utf8'
)
await fs.writeFile(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8')

console.log(
  JSON.stringify(
    {
      outputPath: path.relative(ROOT, OUTPUT_PATH),
      reportPath: path.relative(ROOT, REPORT_PATH),
      totalInputRows: report.totalInputRows,
      totalOutputRows: report.totalOutputRows,
      mergedRows: report.mergedRows.length,
      strippedAnnotations: report.strippedAnnotations.length,
      splitPlayers: report.splitPlayers.length,
      duplicatesRemoved: report.duplicatesRemoved,
    },
    null,
    2
  )
)
