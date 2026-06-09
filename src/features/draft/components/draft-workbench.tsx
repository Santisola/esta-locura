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

type DraftWorkbenchProps = DraftBootstrap

const STORAGE_KEY = 'esta-locura.singleplayer-draft.v1'
const DIFFICULTY_OPTIONS: Array<{ value: DraftDifficultyMode; title: string; detail: string }> = [
  {
    value: 'CLASSIC',
    title: 'Vision total',
    detail: 'Ves el potencial de cada carta y decidis con toda la informacion sobre la mesa.',
  },
  {
    value: 'MEMORY',
    title: 'Pulso ciego',
    detail: 'Elegis por intuicion. El verdadero impacto se revela despues.',
  },
]

const PITCH_ROWS: Record<string, { label: string; color: string }> = {
  GK: { label: 'Arquero', color: 'border-l-amber/40' },
  DEF: { label: 'Defensa', color: 'border-l-cyan/40' },
  MID: { label: 'Mediocampo', color: 'border-l-emerald/40' },
  ATT: { label: 'Ataque', color: 'border-l-red/40' },
}

// Parsea la respuesta como JSON de forma segura. Si el server devuelve HTML
// (404/500), evita el error cripto "Unexpected token '<'" y retorna null.
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

function formatSlotLabel(slotCode: string) {
  if (slotCode.startsWith('CB')) return 'Central'
  if (slotCode.startsWith('CM')) return 'Interior'
  if (slotCode.startsWith('ST')) return 'Delantero'
  const map: Record<string, string> = {
    GK: 'Arquero', LB: 'Lateral izq.', RB: 'Lateral der.',
    LM: 'Banda izq.', RM: 'Banda der.',
    LW: 'Extremo izq.', RW: 'Extremo der.',
  }
  return map[slotCode] ?? slotCode
}

export function DraftWorkbench({ summary, formations, countries }: DraftWorkbenchProps) {
  const [selectedFormationCode, setSelectedFormationCode] = useState(formations[0]?.code ?? '')
  const [selectedDifficulty, setSelectedDifficulty] = useState<DraftDifficultyMode>('CLASSIC')
  const [draftState, setDraftState] = useState<DraftSessionState | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)
  const [persistenceMode, setPersistenceMode] = useState<DraftPersistenceMode>('local-fallback')
  const [isFinalizing, setIsFinalizing] = useState(false)
  const [tournamentMessage, setTournamentMessage] = useState<string | null>(null)
  const [tournamentId, setTournamentId] = useState<string | null>(null)

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
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved) {
        try {
          const parsed = normalizeDraftState(JSON.parse(saved) as DraftSessionState)
          setDraftState(parsed)
          setSelectedFormationCode(parsed.formationCode)
          setSelectedDifficulty(parsed.difficulty)
        } catch { window.localStorage.removeItem(STORAGE_KEY) }
      }
      try {
        const res = await fetch('/api/draft/singleplayer', { cache: 'no-store' })
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
  }, [])

  useEffect(() => {
    if (!isHydrated) return
    if (draftState) { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draftState)); return }
    window.localStorage.removeItem(STORAGE_KEY)
  }, [draftState, isHydrated])

  useEffect(() => {
    if (!isHydrated || !draftState) return
    const timer = window.setTimeout(async () => {
      try {
        await fetch('/api/draft/singleplayer', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ draftState }),
        })
      } catch { setPersistenceMode('local-fallback') }
    }, 500)
    return () => window.clearTimeout(timer)
  }, [draftState, isHydrated])

  const activeFormation = useMemo(
    () => formations.find((f) => f.code === (draftState?.formationCode ?? selectedFormationCode)) ?? formations[0],
    [draftState?.formationCode, formations, selectedFormationCode],
  )

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
          const m: Record<string, number> = { GK: 0, DEF: 1, CB: 1, LB: 1, RB: 1, MID: 2, CM: 2, CDM: 2, CAM: 2, VOLANTES: 2, ATT: 3, ST: 3, LW: 3, RW: 3 }
          return m[p.listedPositionGroup] ?? m[p.primaryPosition] ?? 99
        }
        const d = pg(a) - pg(b)
        if (d !== 0) return d
        return b.ovr - a.ovr || a.name.localeCompare(b.name)
      })
      .map((p) => {
        const taken = draftState.usedPlayerIds.includes(p.id)
        const compat = taken ? [] : getCompatibleSlots(p, openSlotCodes)
        return { ...p, compatibleSlots: compat, isDisabled: !p.isDataReady || taken || compat.length === 0, disabledReason: taken ? 'Ya en tu equipo.' : !p.isDataReady ? 'No disponible.' : compat.length === 0 ? 'No encaja.' : null }
      })
  }, [currentCountry, draftState, openSlotCodes])

  const filled = draftState ? Object.keys(draftState.picks).length : 0
  const total = activeFormation?.slots.length ?? 0
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0
  const isComplete = Boolean(draftState && activeFormation && isDraftComplete(activeFormation.slots.map((s) => s.code), draftState.picks))

  function pickRandom(next: DraftCountryGroup[]) {
    return next.length > 0 ? next[Math.floor(Math.random() * next.length)]?.countrySlug ?? null : null
  }

  function startDraft() {
    setTournamentId(null)
    setTournamentMessage(null)
    setDraftState({
      formationCode: selectedFormationCode, difficulty: selectedDifficulty,
      rerollsLeft: 3, currentCountrySlug: null, usedCountrySlugs: [],
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
    try { await fetch('/api/draft/singleplayer', { method: 'DELETE' }) } catch { /* ignore */ }
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
      const res = await fetch('/api/tournaments/singleplayer', { method: 'POST' })
      const data = await readJsonSafe<{ error?: string; tournament?: { tournamentId: string } }>(res)
      if (!res.ok || !data) throw new Error(data?.error ?? `No se pudo abrir el Mundial (error ${res.status}).`)
      setTournamentId(data.tournament?.tournamentId ?? null)
      setTournamentMessage('Tu seleccion entro al Mundial. Segui la accion en el torneo.')
      setDraftState((s) => s ? { ...s, completedAt: s.completedAt ?? new Date().toISOString() } : s)
    } catch (e) { setTournamentMessage(e instanceof Error ? e.message : 'Error.') }
    finally { setIsFinalizing(false) }
  }

  if (!isHydrated) {
    return <div className="flex min-h-[60vh] items-center justify-center"><p className="text-sand/50">Preparando la sala...</p></div>
  }

  return (
    <>
      {/* Setup — before draft starts */}
      {!draftState && (
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <p className="font-mono text-xs uppercase tracking-[0.32em] text-cyan/90">Sala de draft</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">Elegi rapido, porque cada pais aparece una sola vez.</h1>
            <p className="mt-4 text-base leading-7 text-sand/70">
              Defini tu plan, deja que aparezcan las selecciones y arma un once con equilibrio y personalidad.
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <div className="space-y-3 rounded-2xl border border-white/10 bg-night/60 p-6">
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-cyan/85">Formacion</p>
              {formations.map((f) => (
                <button key={f.code} type="button" onClick={() => setSelectedFormationCode(f.code)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                    selectedFormationCode === f.code ? 'border-cyan bg-cyan/10' : 'border-white/10 bg-white/5 hover:border-white/25'
                  }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan/85">{f.code}</p>
                      <p className="mt-1 font-semibold">{f.name}</p>
                    </div>
                    <span className="rounded-full border border-white/10 px-3 py-1 font-mono text-xs text-sand/70">{f.slots.length} plazas</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="space-y-3 rounded-2xl border border-white/10 bg-night/60 p-6">
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-ember/85">Dificultad</p>
              {DIFFICULTY_OPTIONS.map((o) => (
                <button key={o.value} type="button" onClick={() => setSelectedDifficulty(o.value)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                    selectedDifficulty === o.value ? 'border-ember bg-ember/10' : 'border-white/10 bg-white/5 hover:border-white/25'
                  }`}>
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-ember/85">{o.value}</p>
                  <p className="mt-1 font-semibold">{o.title}</p>
                  <p className="mt-1 text-sm text-sand/60">{o.detail}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 text-center">
            <button type="button" onClick={startDraft}
              className="rounded-full bg-sand px-10 py-4 font-mono text-sm uppercase tracking-[0.3em] text-night transition hover:bg-white">
              Empezar mi seleccion
            </button>
          </div>
        </div>
      )}

      {/* Draft in progress */}
      {draftState && (
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          {/* Left column — main gameplay */}
          <div className="space-y-5">
            {/* Progress bar + actions */}
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-night/60 px-5 py-4">
              <div className="flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-xs uppercase tracking-[0.22em] text-cyan/85">{filled}/{total} puestos</p>
                  <span className="font-mono text-xs text-sand/50">{pct}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-cyan to-emerald transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={rollCountry}
                  disabled={playableCountries.length === 0}
                  className="rounded-full border border-cyan/30 px-4 py-2 font-mono text-xs uppercase tracking-[0.2em] text-cyan transition disabled:opacity-40 hover:border-cyan hover:bg-cyan/10">
                  Girar
                </button>
                <button type="button" onClick={finalize}
                  disabled={!isComplete || isFinalizing}
                  className="rounded-full bg-sand px-4 py-2 font-mono text-xs uppercase tracking-[0.2em] text-night transition disabled:opacity-40 hover:bg-white">
                  {isFinalizing ? 'Abriendo...' : 'Ir al Mundial'}
                </button>
                <button type="button" onClick={resetDraft}
                  className="rounded-full border border-white/15 px-4 py-2 font-mono text-xs uppercase tracking-[0.2em] text-sand/60 transition hover:border-white/30">
                  Reset
                </button>
              </div>
            </div>

            {/* Current country banner + players */}
            {currentCountry ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-night/60 px-5 py-4">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.22em] text-ember/85">Seleccion del momento</p>
                    <h2 className="mt-1 text-2xl font-bold">{currentCountry.country}</h2>
                    <p className="mt-1 text-sm text-sand/60">{currentCountry.readyPlayers} jugadores disponibles</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="rounded-full border border-white/10 px-3 py-1 font-mono text-xs text-sand/60">
                      Rerolls: {draftState.rerollsLeft}
                    </span>
                    <button type="button" onClick={reroll}
                      disabled={draftState.rerollsLeft <= 0 || playableCountries.length === 0}
                      className="rounded-full border border-ember/30 px-4 py-2 font-mono text-xs uppercase tracking-[0.2em] text-ember transition disabled:opacity-40 hover:border-ember hover:bg-ember/10">
                      Saltar pais
                    </button>
                  </div>
                </div>

                {/* Player cards — compact */}
                <div className="space-y-2">
                  {currentCountryPlayers.map((p) => (
                    <div key={p.id}
                      className={`rounded-xl border px-4 py-3 ${
                        p.isDisabled ? 'border-amber-300/15 bg-amber-100/5 opacity-50' : 'border-white/10 bg-white/5'
                      }`}>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="rounded border border-white/10 px-2 py-0.5 font-mono text-[11px] uppercase text-sand/50">{p.primaryPosition}</span>
                            <p className="truncate font-semibold">{p.name}</p>
                          </div>
                          <p className="mt-0.5 text-sm text-sand/50 truncate">{p.club ?? ''}{p.birthDate ? ` · ${new Date().getFullYear() - new Date(p.birthDate).getFullYear()} años` : ''}</p>
                        </div>
                        {draftState.difficulty === 'CLASSIC' && (
                          <span className="rounded-full border border-cyan/20 px-3 py-1 font-mono text-sm font-bold text-cyan">{p.ovr}</span>
                        )}
                        {!p.isDisabled && p.compatibleSlots.map((sc) => (
                          <button key={sc} type="button" onClick={() => assign(p.id, sc)}
                            className="rounded-full bg-cyan/15 px-3 py-1.5 font-mono text-xs uppercase tracking-[0.15em] text-cyan transition hover:bg-cyan/25">
                            {formatSlotLabel(sc)}
                          </button>
                        ))}
                      </div>
                      {p.disabledReason && <p className="mt-1.5 text-sm text-amber-100/70">{p.disabledReason}</p>}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-white/15 bg-white/5 px-6 py-16 text-center">
                <p className="text-lg font-semibold">Esperando la proxima seleccion</p>
                <p className="max-w-md text-sm text-sand/60">Toca "Girar" para descubrir un pais y elegir a tus jugadores.</p>
                {filled > 0 && (
                  <button type="button" onClick={rollCountry}
                    className="rounded-full bg-cyan/20 px-6 py-3 font-mono text-xs uppercase tracking-[0.25em] text-cyan transition hover:bg-cyan/30">
                    Girar siguiente pais
                  </button>
                )}
              </div>
            )}

            {/* Tournament created message */}
            {tournamentMessage && (
              <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/10 px-5 py-4 text-sm text-sand/80">
                <p>{tournamentMessage}</p>
                {tournamentId && (
                  <Link href="/tournament" className="mt-3 inline-block rounded-full border border-white/15 px-4 py-2 font-mono text-xs uppercase tracking-[0.2em] text-sand/80 transition hover:border-white/30">
                    Ir al torneo
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Right column — formation (compact) */}
          <div className="rounded-2xl border border-white/10 bg-night/60 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-cyan/85">Tu formacion</p>
              <p className="font-mono text-xs text-sand/50">{activeFormation?.name}</p>
            </div>

            <div className="mt-4 space-y-3">
              {(['GK', 'DEF', 'MID', 'ATT'] as const).map((lane) => {
                const laneSlots = activeFormation?.slots.filter((s) => s.lane === lane) ?? []
                if (laneSlots.length === 0) return null
                return (
                  <div key={lane} className={`border-l-2 pl-3 ${PITCH_ROWS[lane]?.color ?? 'border-l-white/20'}`}>
                    <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-sand/50">{PITCH_ROWS[lane]?.label ?? lane}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {laneSlots.map((slot) => {
                        const picked = draftState?.picks[slot.code] ? playersById[draftState.picks[slot.code]] : null
                        return (
                          <div key={slot.code}
                            className={`rounded-lg border px-3 py-2 text-center text-xs ${
                              picked ? 'border-cyan/30 bg-cyan/10' : 'border-dashed border-white/15 bg-white/5'
                            }`}>
                            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-sand/50">{slot.code}</p>
                            {picked ? (
                              <>
                                <p className="mt-1 text-sm font-semibold leading-tight">{picked.name}</p>
                                <p className="mt-0.5 text-[10px] text-sand/50">
                                  {draftState?.difficulty === 'CLASSIC' ? `IMP ${picked.ovr}` : '???'}
                                </p>
                              </>
                            ) : (
                              <p className="mt-1 text-sm text-sand/40">—</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {draftState?.completedAt && (
              <p className="mt-4 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-center font-mono text-xs uppercase tracking-[0.2em] text-emerald-200">
                Equipo completo
              </p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
