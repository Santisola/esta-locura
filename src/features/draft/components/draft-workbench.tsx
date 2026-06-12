'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { getCompatibleSlots, isDraftComplete } from '@/features/draft/rules'
import type {
  DraftBootstrap,
  DraftCountryGroup,
  DraftDifficultyMode,
  DraftPersistenceMode,
  DraftPlayer,
  DraftSessionState,
} from '@/features/draft/types'

type DraftWorkbenchProps = DraftBootstrap & {
  roomCode?: string
  roomDifficulty?: DraftDifficultyMode
}

const STORAGE_KEY = 'esta-locura.singleplayer-draft.v1'

const DIFFICULTY_OPTIONS: Array<{ value: DraftDifficultyMode; label: string }> = [
  { value: 'CLASSIC', label: 'Clásico' },
  { value: 'MEMORY', label: 'De memoria' },
]

// Etiquetas de posición estilo planilla (español).
const POS_LABEL: Record<string, string> = {
  GK: 'POR', LB: 'LI', RB: 'LD', CB: 'DFC', SW: 'LIB', LWB: 'CAI', RWB: 'CAD',
  CDM: 'MCD', CM: 'MC', CAM: 'MEI', LM: 'EI', RM: 'ED',
  LW: 'EI', RW: 'ED', ST: 'DC', CF: 'DC', LF: 'DC', RF: 'DC',
}

function posLabel(slotCode: string) {
  const base = slotCode.replace(/[0-9]/g, '')
  return POS_LABEL[base] ?? base
}

function surname(name: string) {
  const parts = name.trim().split(' ')
  return parts[parts.length - 1]
}

// Nivel vertical por tipo de posición (0 = arquero abajo, 5 = delantero arriba).
const TIER: Record<string, number> = {
  GK: 0,
  CB: 1, LB: 1, RB: 1, SW: 1, LWB: 1, RWB: 1,
  CDM: 2,
  CM: 3, LM: 3, RM: 3,
  CAM: 4,
  LW: 5, RW: 5, ST: 5, CF: 5, LF: 5, RF: 5,
}
// Flanco horizontal: negativo = izquierda de la pantalla, positivo = derecha.
const FLANK: Record<string, number> = {
  LB: -2, LWB: -2, LM: -2, LW: -2, LF: -1,
  RB: 2, RWB: 2, RM: 2, RW: 2, RF: 1,
}

function baseCode(code: string) {
  return code.replace(/[0-9]/g, '')
}
function tierOf(code: string) {
  return TIER[baseCode(code)] ?? 3
}
function flankOf(code: string) {
  return FLANK[baseCode(code)] ?? 0
}

type PitchNode = { code: string; lane: string; x: number; y: number }

// Posiciona los slots por niveles (eje vertical) y flanco (eje horizontal). Así
// el lateral/extremo izquierdo queda a la izquierda y el derecho a la derecha, y
// las formaciones con más líneas (4-2-3-1, etc.) se ven con su escalonado real.
function pitchPositions(slots: Array<{ code: string; lane: string }>): PitchNode[] {
  const tiers = [...new Set(slots.map((s) => tierOf(s.code)))].sort((a, b) => a - b)
  const Y_BOTTOM = 90
  const Y_TOP = 20
  const out: PitchNode[] = []

  tiers.forEach((tier, tierIndex) => {
    const y = tiers.length === 1 ? 55 : Y_BOTTOM - (tierIndex / (tiers.length - 1)) * (Y_BOTTOM - Y_TOP)
    const rowSlots = slots
      .map((slot, index) => ({ slot, index }))
      .filter(({ slot }) => tierOf(slot.code) === tier)
      .sort((a, b) => flankOf(a.slot.code) - flankOf(b.slot.code) || a.index - b.index)

    rowSlots.forEach(({ slot }, i) => {
      out.push({
        code: slot.code,
        lane: slot.lane,
        x: ((i + 1) / (rowSlots.length + 1)) * 100,
        y,
      })
    })
  })

  return out
}

async function readJsonSafe<T>(res: Response): Promise<T | null> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

function normalizeDraftState(state: DraftSessionState): DraftSessionState {
  return {
    ...state,
    usedCountrySlugs: Array.isArray(state.usedCountrySlugs)
      ? state.usedCountrySlugs
      : state.currentCountrySlug
        ? [state.currentCountrySlug]
        : [],
  }
}

export function DraftWorkbench({ formations, countries, roomCode, roomDifficulty }: DraftWorkbenchProps) {
  const [selectedFormationCode, setSelectedFormationCode] = useState(formations[0]?.code ?? '')
  const [selectedDifficulty, setSelectedDifficulty] = useState<DraftDifficultyMode>(roomDifficulty ?? 'CLASSIC')
  const [draftState, setDraftState] = useState<DraftSessionState | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)
  const [, setPersistenceMode] = useState<DraftPersistenceMode>('local-fallback')
  const [isFinalizing, setIsFinalizing] = useState(false)
  const [tournamentMessage, setTournamentMessage] = useState<string | null>(null)
  const [tournamentId, setTournamentId] = useState<string | null>(null)

  const storageKey = roomCode ? `esta-locura.room-draft.${roomCode}.v1` : STORAGE_KEY

  const countriesBySlug = useMemo(
    () => Object.fromEntries(countries.map((c) => [c.countrySlug, c])), [countries],
  )

  const playersById = useMemo(
    () => Object.fromEntries(
      countries.flatMap((c) => c.players.map((p) => [p.id, p])),
    ) as Record<string, DraftPlayer>, [countries],
  )

  useEffect(() => {
    async function bootstrap() {
      const saved = window.localStorage.getItem(storageKey)
      if (saved) {
        try {
          const parsed = normalizeDraftState(JSON.parse(saved) as DraftSessionState)
          setDraftState(parsed)
          setSelectedFormationCode(parsed.formationCode)
          setSelectedDifficulty(parsed.difficulty)
        } catch { window.localStorage.removeItem(storageKey) }
      }
      try {
        const endpoint = roomCode ? `/api/rooms/${roomCode}/draft/save` : '/api/draft/singleplayer'
        const res = await fetch(endpoint, { cache: 'no-store' })
        if (!res.ok) throw new Error()
        const payload = await res.json() as {
          draftState: DraftSessionState | null; persistenceMode: DraftPersistenceMode
        }
        setPersistenceMode(payload.persistenceMode)
        if (payload.draftState) {
          const n = normalizeDraftState(payload.draftState)
          setDraftState(n)
          setSelectedFormationCode(n.formationCode)
          setSelectedDifficulty(n.difficulty)
        }
      } catch { setPersistenceMode('local-fallback') }
      setIsHydrated(true)
    }
    void bootstrap()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode])

  useEffect(() => {
    if (!isHydrated) return
    if (draftState) { window.localStorage.setItem(storageKey, JSON.stringify(draftState)); return }
    window.localStorage.removeItem(storageKey)
  }, [draftState, isHydrated, storageKey])

  useEffect(() => {
    if (!isHydrated || !draftState) return
    const endpoint = roomCode ? `/api/rooms/${roomCode}/draft/save` : '/api/draft/singleplayer'
    const timer = window.setTimeout(async () => {
      try {
        await fetch(endpoint, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ draftState }),
        })
      } catch { setPersistenceMode('local-fallback') }
    }, 500)
    return () => window.clearTimeout(timer)
  }, [draftState, isHydrated, roomCode])

  const activeFormation = useMemo(
    () => formations.find((f) => f.code === (draftState?.formationCode ?? selectedFormationCode)) ?? formations[0],
    [draftState?.formationCode, formations, selectedFormationCode],
  )

  const activeDifficulty = draftState?.difficulty ?? selectedDifficulty
  const usedCountrySlugs = draftState?.usedCountrySlugs ?? []

  const openSlotCodes = useMemo(() => {
    if (!draftState || !activeFormation) return []
    return activeFormation.slots.map((s) => s.code).filter((c) => !draftState.picks[c])
  }, [activeFormation, draftState])

  const playableCountries = useMemo(() => {
    if (!draftState || !activeFormation) return []
    return countries.filter((c) =>
      !usedCountrySlugs.includes(c.countrySlug) &&
      c.players.some((p) => p.isDataReady && !draftState.usedPlayerIds.includes(p.id) && getCompatibleSlots(p, openSlotCodes).length > 0),
    )
  }, [activeFormation, countries, draftState, openSlotCodes, usedCountrySlugs])

  const currentCountry = draftState?.currentCountrySlug ? countriesBySlug[draftState.currentCountrySlug] : null

  const currentCountryPlayers = useMemo(() => {
    if (!currentCountry || !draftState) return []
    return [...currentCountry.players]
      .sort((a, b) => {
        const pg = (p: DraftPlayer) => {
          const m: Record<string, number> = { GK: 0, DEF: 1, CB: 1, LB: 1, RB: 1, MID: 2, CM: 2, CDM: 2, CAM: 2, ATT: 3, ST: 3, LW: 3, RW: 3 }
          return m[p.listedPositionGroup] ?? m[p.primaryPosition] ?? 99
        }
        const d = pg(a) - pg(b)
        if (d !== 0) return d
        return b.ovr - a.ovr || a.name.localeCompare(b.name)
      })
      .map((p) => {
        const taken = draftState.usedPlayerIds.includes(p.id)
        const compat = taken ? [] : getCompatibleSlots(p, openSlotCodes)
        return { ...p, compatibleSlots: compat, isDisabled: !p.isDataReady || taken || compat.length === 0, disabledReason: taken ? 'Ya en tu equipo' : !p.isDataReady ? 'No disponible' : compat.length === 0 ? 'No encaja' : null }
      })
  }, [currentCountry, draftState, openSlotCodes])

  const filled = draftState ? Object.keys(draftState.picks).length : 0
  const total = activeFormation?.slots.length ?? 0
  const isComplete = Boolean(draftState && activeFormation && isDraftComplete(activeFormation.slots.map((s) => s.code), draftState.picks))

  // ---- Box score: ratings agregados del equipo a partir de los picks ----
  const laneBySlot = useMemo(
    () => new Map((activeFormation?.slots ?? []).map((s) => [s.code, s.lane])),
    [activeFormation],
  )

  const boxScore = useMemo(() => {
    const empty = { ovr: null, ataque: null, medio: null, defensa: null, arquero: null }
    if (!draftState) return empty
    const picked = Object.entries(draftState.picks)
      .map(([slot, pid]) => ({ slot, p: playersById[pid] }))
      .filter((x) => x.p)
    if (picked.length === 0) return empty
    const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null)
    const laneAttr = (lane: string, attr: keyof DraftPlayer) =>
      avg(picked.filter((x) => laneBySlot.get(x.slot) === lane).map((x) => Number(x.p[attr])))
    const ataque = laneAttr('ATT', 'attack')
    const medio = laneAttr('MID', 'midfield')
    const defensa = laneAttr('DEF', 'defense')
    const arquero = laneAttr('GK', 'goalkeeping')
    // La media es el promedio de las líneas presentes (lo que se muestra), no del
    // ovr de cada jugador — así Ataque/Medio/Defensa/Arquero siempre cuadran con la Media.
    const lines = [ataque, medio, defensa, arquero].filter((v): v is number => v != null)
    const ovr = lines.length ? Math.round(lines.reduce((a, b) => a + b, 0) / lines.length) : null
    return { ovr, ataque, medio, defensa, arquero }
  }, [draftState, playersById, laneBySlot])

  const revealRatings = activeDifficulty === 'CLASSIC' || isComplete

  function pickRandom(next: DraftCountryGroup[]) {
    return next.length > 0 ? next[Math.floor(Math.random() * next.length)]?.countrySlug ?? null : null
  }

  function startDraft() {
    setTournamentId(null)
    setTournamentMessage(null)
    // Calcular el primer slug al arrancar para evitar el click extra en "Tirar"
    const formation = formations.find((f) => f.code === selectedFormationCode) ?? formations[0]
    const allSlotCodes = formation?.slots.map((s) => s.code) ?? []
    const initialPlayable = countries.filter((c) =>
      c.players.some((p) => p.isDataReady && getCompatibleSlots(p, allSlotCodes).length > 0),
    )
    const slug = pickRandom(initialPlayable)
    setDraftState({
      formationCode: selectedFormationCode, difficulty: selectedDifficulty,
      rerollsLeft: 3, currentCountrySlug: slug, usedCountrySlugs: slug ? [slug] : [],
      picks: {}, usedPlayerIds: [], startedAt: new Date().toISOString(), completedAt: null,
    })
  }

  function rollCountry() {
    if (!draftState) return
    const slug = pickRandom(playableCountries)
    setDraftState((s) => s ? { ...s, currentCountrySlug: slug, usedCountrySlugs: slug ? [...new Set([...s.usedCountrySlugs, slug])] : s.usedCountrySlugs } : s)
  }

  function reroll() {
    if (!draftState || draftState.rerollsLeft <= 0) return
    const slug = pickRandom(playableCountries)
    setDraftState((s) => s ? { ...s, rerollsLeft: Math.max(0, s.rerollsLeft - 1), currentCountrySlug: slug, usedCountrySlugs: slug ? [...new Set([...s.usedCountrySlugs, slug])] : s.usedCountrySlugs } : s)
  }

  function assign(playerId: string, slotCode: string) {
    if (!draftState || !activeFormation) return
    setDraftState((s) => {
      if (!s) return s
      const picks = { ...s.picks, [slotCode]: playerId }
      const used = [...s.usedPlayerIds, playerId]
      const done = activeFormation.slots.every((sl) => picks[sl.code])
      return { ...s, picks, usedPlayerIds: used, currentCountrySlug: null, completedAt: done ? new Date().toISOString() : null }
    })
  }

  async function resetDraft() {
    if (!roomCode) {
      try { await fetch('/api/draft/singleplayer', { method: 'DELETE' }) } catch { /* ignore */ }
    }
    window.localStorage.removeItem(storageKey)
    setDraftState(null)
    setTournamentId(null)
    setTournamentMessage(null)
    setSelectedFormationCode(formations[0]?.code ?? '')
    setSelectedDifficulty('CLASSIC')
  }

  async function finalize() {
    if (!draftState || !isComplete) return
    setIsFinalizing(true)
    setTournamentMessage(null)
    try {
      if (roomCode) {
        // Guardar la selección definitiva antes de finalizar: el auto-save tiene
        // debounce, así que persistimos el estado completo de forma explícita para
        // que finalize no marque COMPLETED sobre un snapshot viejo.
        const finalState: DraftSessionState = {
          ...draftState,
          completedAt: draftState.completedAt ?? new Date().toISOString(),
        }
        const saveRes = await fetch(`/api/rooms/${roomCode}/draft/save`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ draftState: finalState }),
        })
        if (!saveRes.ok) {
          const saveData = await readJsonSafe<{ error?: string }>(saveRes)
          throw new Error(saveData?.error ?? `No se pudo guardar la selección (${saveRes.status}).`)
        }
        setDraftState(finalState)

        const res = await fetch(`/api/rooms/${roomCode}/draft/finalize`, { method: 'POST' })
        const data = await readJsonSafe<{ error?: string }>(res)
        if (!res.ok) throw new Error(data?.error ?? `Error al finalizar el draft (${res.status}).`)
        window.location.href = `/sala/${roomCode}`
        return
      }
      const res = await fetch('/api/tournaments/singleplayer', { method: 'POST' })
      const data = await readJsonSafe<{ error?: string; tournament?: { tournamentId: string } }>(res)
      if (!res.ok || !data) throw new Error(data?.error ?? `No se pudo abrir el Mundial (error ${res.status}).`)
      setTournamentId(data.tournament?.tournamentId ?? null)
      setTournamentMessage('Tu seleccion entró al Mundial.')
      setDraftState((s) => s ? { ...s, completedAt: s.completedAt ?? new Date().toISOString() } : s)
    } catch (e) { setTournamentMessage(e instanceof Error ? e.message : 'Error.') }
    finally { setIsFinalizing(false) }
  }

  const nodes = activeFormation ? pitchPositions(activeFormation.slots) : []

  const metaChips = [
    activeFormation?.code,
    activeDifficulty === 'CLASSIC' ? 'Clásico' : 'De memoria',
  ].filter(Boolean) as string[]

  if (!isHydrated) {
    return <div className="flex min-h-[70vh] items-center justify-center"><p className="font-mono text-sm uppercase tracking-[0.3em] text-ink2">Preparando la mesa...</p></div>
  }

  return (
    <div className="space-y-5">
      {/* Header / scoreboard */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink/80 pb-4">
        <Link href={roomCode ? `/sala/${roomCode}` : '/'} className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-xl border-2 border-ink bg-gradient-to-br from-celeste to-violeta shadow-hardsm"><img src="/worldcup.svg" alt="EL" className="h-9 w-9" /></span>
          <div>
            <p className="font-slab text-2xl leading-none tracking-wide text-ink">
              ESTA <span className="bg-gradient-to-r from-celeste to-violeta bg-clip-text text-transparent">LOCURA</span>
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.3em] text-ink2">
              {roomCode ? `Sala ${roomCode}` : 'Armá · Simulá · Ganá'}
            </p>
          </div>
        </Link>
        <div className="flex flex-wrap gap-2">
          {metaChips.map((c) => (
            <span key={c} className="rounded-full border border-line bg-bone px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-ink2">{c}</span>
          ))}
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)_300px]">
        {/* ---------- IZQUIERDA: configuración / acción ---------- */}
        <aside className="space-y-4">
          {currentCountry && draftState ? (
            <CountryPicker
              country={currentCountry}
              players={currentCountryPlayers}
              rerollsLeft={draftState.rerollsLeft}
              difficulty={activeDifficulty}
              onAssign={assign}
              onReroll={reroll}
              canReroll={draftState.rerollsLeft > 0 && playableCountries.length > 0}
            />
          ) : (
            <ConfigPanel
              formations={formations}
              selectedFormationCode={activeFormation?.code ?? selectedFormationCode}
              onSelectFormation={setSelectedFormationCode}
              selectedDifficulty={activeDifficulty}
              onSelectDifficulty={setSelectedDifficulty}
              locked={Boolean(draftState)}
              difficultyLocked={Boolean(roomCode)}
              difficultyHint={roomCode ? 'Lo define la sala' : undefined}
            />
          )}

          {/* Acción principal */}
          <div className="rounded-2xl border-2 border-ink bg-bone p-4 shadow-hardsm">
            {!draftState && (
              <ActionButton onClick={startDraft} label="Tirar para empezar" dice />
            )}

            {draftState && !isComplete && !currentCountry && (
              <div className="space-y-3">
                <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.18em] text-ink2">
                  <span>{filled}/{total} puestos</span>
                  <button onClick={resetDraft} className="underline-offset-2 hover:underline">Reiniciar</button>
                </div>
                <ActionButton
                  onClick={rollCountry}
                  label={filled === 0 ? 'Tirar selección' : 'Tirar siguiente'}
                  dice
                  disabled={playableCountries.length === 0}
                />
              </div>
            )}

            {draftState && isComplete && (
              <div className="space-y-3 text-center">
                <p className="font-slab text-xl tracking-wide text-ink">ALINEACIÓN COMPLETA {filled}/{total}</p>
                <ActionButton
                  onClick={finalize}
                  label={isFinalizing ? 'Guardando...' : roomCode ? 'Finalizar mi selección' : 'Simular el Mundial'}
                  arrow
                  disabled={isFinalizing}
                />
                <button onClick={resetDraft} className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink2 underline-offset-2 hover:underline">Reiniciar draft</button>
              </div>
            )}

            {!draftState && (
              <p className="mt-3 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-ink2">
                Tirá para sortear una selección y un Mundial
              </p>
            )}
          </div>

          {tournamentMessage && !roomCode && (
            <div className="rounded-2xl border-2 border-grass bg-grass/10 p-4 text-center">
              <p className="text-sm font-semibold text-ink">{tournamentMessage}</p>
              {tournamentId && (
                <Link href="/tournament" className="mt-3 inline-block rounded-full bg-ink px-5 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-paper">
                  Ir a la campaña →
                </Link>
              )}
            </div>
          )}
        </aside>

        {/* ---------- CENTRO: la cancha ---------- */}
        <Pitch
          nodes={nodes}
          picks={draftState?.picks ?? {}}
          playersById={playersById}
          revealRatings={revealRatings}
        />

        {/* ---------- DERECHA: box score ---------- */}
        <BoxScore
          formation={activeFormation}
          picks={draftState?.picks ?? {}}
          playersById={playersById}
          filled={filled}
          total={total}
          boxScore={boxScore}
          revealRatings={revealRatings}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------
function ActionButton({ onClick, label, disabled, dice, arrow }: {
  onClick: () => void; label: string; disabled?: boolean; dice?: boolean; arrow?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group flex w-full items-center justify-center gap-2 rounded-xl border-2 border-ink bg-gradient-to-r from-celeste to-violeta px-5 py-4 font-slab text-lg uppercase tracking-wide text-white shadow-hardsm transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span>{label}</span>
      {dice && <span className="text-xl transition-transform duration-300 group-hover:rotate-[30deg] group-hover:scale-110">🎲</span>}
      {arrow && <span className="text-xl transition-transform group-hover:translate-x-1">→</span>}
    </button>
  )
}

function ConfigPanel({ formations, selectedFormationCode, onSelectFormation, selectedDifficulty, onSelectDifficulty, locked, difficultyLocked, difficultyHint }: {
  formations: DraftBootstrap['formations']
  selectedFormationCode: string
  onSelectFormation: (code: string) => void
  selectedDifficulty: DraftDifficultyMode
  onSelectDifficulty: (mode: DraftDifficultyMode) => void
  locked: boolean
  difficultyLocked?: boolean
  difficultyHint?: string
}) {
  const lockDifficulty = locked || difficultyLocked
  return (
    <div className="rounded-2xl border-2 border-ink bg-bone p-4 shadow-hardsm">
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-ink2">Formación</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {formations.map((f) => {
          const active = f.code === selectedFormationCode
          return (
            <button
              key={f.code}
              onClick={() => !locked && onSelectFormation(f.code)}
              disabled={locked && !active}
              className={`rounded-lg border-2 px-2 py-3 text-center font-slab text-sm tracking-wide transition ${
                active ? 'border-ink bg-ink text-paper' : 'border-line bg-paper2 text-ink hover:border-ink/50'
              } ${locked ? 'cursor-default' : ''}`}
            >
              {f.code}
            </button>
          )
        })}
      </div>

      <p className="mt-5 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.24em] text-ink2">
        <span>Modo · Dificultad</span>
        {difficultyHint && <span className="text-[9px] tracking-[0.14em] text-ink2/60">{difficultyHint}</span>}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {DIFFICULTY_OPTIONS.map((o) => {
          const active = o.value === selectedDifficulty
          return (
            <button
              key={o.value}
              onClick={() => !lockDifficulty && onSelectDifficulty(o.value)}
              disabled={lockDifficulty && !active}
              className={`rounded-lg border-2 px-3 py-2.5 text-center font-mono text-xs uppercase tracking-[0.12em] transition ${
                active ? 'border-ink bg-ink text-paper' : 'border-line bg-paper2 text-ink hover:border-ink/50'
              } ${lockDifficulty ? 'cursor-default' : ''}`}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CountryPicker({ country, players, rerollsLeft, difficulty, onAssign, onReroll, canReroll }: {
  country: DraftCountryGroup
  players: Array<DraftPlayer & { compatibleSlots: string[]; isDisabled: boolean; disabledReason: string | null }>
  rerollsLeft: number
  difficulty: DraftDifficultyMode
  onAssign: (playerId: string, slotCode: string) => void
  onReroll: () => void
  canReroll: boolean
}) {
  return (
    <div className="animate-slideIn rounded-2xl border-2 border-ink bg-bone p-4 shadow-hardsm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-vermillion">Selección del momento</p>
          <h2 className="font-slab text-2xl leading-tight tracking-wide text-ink">{country.country}</h2>
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink2">Rerolls {rerollsLeft}</p>
          <button
            onClick={onReroll}
            disabled={!canReroll}
            className="mt-1 rounded-full border border-ink px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink transition hover:bg-ink hover:text-paper disabled:opacity-30"
          >
            Saltar país
          </button>
        </div>
      </div>

      <div className="mt-4 max-h-[26rem] space-y-1.5 overflow-y-auto pr-1">
        {players.map((p) => (
          <div key={p.id} className={`rounded-lg border px-3 py-2 ${p.isDisabled ? 'border-line/60 bg-paper2/50 opacity-50' : 'border-line bg-paper2'}`}>
            <div className="flex items-center gap-2">
              <span className="w-9 shrink-0 rounded bg-ink/10 py-0.5 text-center font-mono text-[10px] uppercase text-ink2">{p.primaryPosition}</span>
              <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{p.name}</p>
              {difficulty === 'CLASSIC' && <span className="font-slab text-base text-vermillion">{p.ovr}</span>}
            </div>
            {!p.isDisabled && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {p.compatibleSlots.map((sc) => (
                  <button
                    key={sc}
                    onClick={() => onAssign(p.id, sc)}
                    className="rounded-md bg-ink px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-paper transition hover:bg-vermillion active:scale-90"
                  >
                    {posLabel(sc)}
                  </button>
                ))}
              </div>
            )}
            {p.disabledReason && <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ink2">{p.disabledReason}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

function Pitch({ nodes, picks, playersById, revealRatings }: {
  nodes: PitchNode[]
  picks: Record<string, string>
  playersById: Record<string, DraftPlayer>
  revealRatings: boolean
}) {
  return (
    <div className="relative mx-auto aspect-[3/4] w-full max-w-[480px] overflow-hidden rounded-2xl border-2 border-ink bg-grass shadow-hardsm">
      {/* Rayas del césped */}
      <div className="absolute inset-0" style={{
        backgroundImage: 'repeating-linear-gradient(180deg, rgba(255,255,255,0.05) 0 8.33%, transparent 8.33% 16.66%)',
      }} />
      {/* Líneas */}
      <div className="pointer-events-none absolute inset-3 rounded-md border-2 border-white/35" />
      <div className="pointer-events-none absolute left-3 right-3 top-1/2 h-[2px] -translate-y-1/2 bg-white/35" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/35" />
      <div className="pointer-events-none absolute left-1/2 top-3 h-16 w-36 -translate-x-1/2 border-2 border-t-0 border-white/35" />
      <div className="pointer-events-none absolute bottom-3 left-1/2 h-16 w-36 -translate-x-1/2 border-2 border-b-0 border-white/35" />

      {/* Nodos */}
      {nodes.map((node) => {
        const player = picks[node.code] ? playersById[picks[node.code]] : null
        return (
          <div
            key={node.code}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
          >
            {player ? (
              // key distinto fuerza el montaje al asignar → dispara el "pop"
              <div key="filled" className="flex animate-pop flex-col items-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bone text-ink shadow-hardsm">
                  <span className="font-slab text-[11px] leading-none">{posLabel(node.code)}</span>
                </div>
                <div className="mt-1 flex items-center gap-1 rounded bg-ink/85 px-1.5 py-0.5">
                  <span className="max-w-[68px] truncate font-mono text-[9px] uppercase tracking-wide text-paper">{surname(player.name)}</span>
                  {revealRatings && <span className="font-slab text-[10px] text-gold">{player.ovr}</span>}
                </div>
              </div>
            ) : (
              <div key="empty" className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-white/60 text-white/80">
                <span className="font-slab text-[10px] leading-none">{posLabel(node.code)}</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function BoxScore({ formation, picks, playersById, filled, total, boxScore, revealRatings }: {
  formation: DraftBootstrap['formations'][number] | undefined
  picks: Record<string, string>
  playersById: Record<string, DraftPlayer>
  filled: number
  total: number
  boxScore: { ovr: number | null; ataque: number | null; medio: number | null; defensa: number | null; arquero: number | null }
  revealRatings: boolean
}) {
  const show = (v: number | null) => (v != null && revealRatings ? String(v) : '—')
  const lines: Array<{ key: string; label: string; value: number | null; accent?: boolean }> = [
    { key: 'atk', label: 'Ataque', value: boxScore.ataque, accent: true },
    { key: 'med', label: 'Medio', value: boxScore.medio },
    { key: 'def', label: 'Defensa', value: boxScore.defensa },
    { key: 'gk', label: 'Arquero', value: boxScore.arquero },
  ]
  return (
    <aside className="rounded-2xl border-2 border-ink bg-bone p-4 shadow-hardsm">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink2">Box score · {filled}/{total}</p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink2/70">Media del equipo</p>
        </div>
        <span className="font-slab text-5xl leading-none text-ink">{show(boxScore.ovr)}</span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 border-b-2 border-ink/15 pb-3">
        {lines.map((l) => (
          <div key={l.key} className="text-center">
            <p className={`font-slab text-lg leading-none ${l.accent ? 'text-vermillion' : 'text-ink'}`}>{show(l.value)}</p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-ink2">{l.label}</p>
          </div>
        ))}
      </div>

      <ul className="mt-3 space-y-1">
        {(formation?.slots ?? []).map((slot) => {
          const player = picks[slot.code] ? playersById[picks[slot.code]] : null
          return (
            <li key={slot.code} className="flex items-center gap-2 border-b border-line/60 py-1.5 last:border-0">
              <span className="w-9 shrink-0 font-mono text-[10px] uppercase tracking-wide text-ink2">{posLabel(slot.code)}</span>
              <span className={`min-w-0 flex-1 truncate text-sm ${player ? 'font-medium text-ink' : 'text-ink2/60'}`}>
                {player ? player.name : '—'}
              </span>
              {player && revealRatings && <span className="font-slab text-sm text-vermillion">{player.ovr}</span>}
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
