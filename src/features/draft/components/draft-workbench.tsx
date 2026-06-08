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
    detail: 'Ves el potencial de cada carta y podés decidir con toda la información sobre la mesa.',
  },
  {
    value: 'MEMORY',
    title: 'Pulso ciego',
    detail: 'Elegís por intuición, reputación y encaje. El verdadero impacto se revela después.',
  },
]

const POSITION_GROUP_ORDER: Record<string, number> = {
  ARQUEROS: 0,
  GK: 0,
  DEFENSORES: 1,
  DEF: 1,
  CB: 1,
  LB: 1,
  RB: 1,
  MEDIOCAMPISTAS: 2,
  MID: 2,
  CM: 2,
  CDM: 2,
  CAM: 2,
  VOLANTES: 2,
  DELANTEROS: 3,
  ATT: 3,
  ST: 3,
  LW: 3,
  RW: 3,
}

function formatLaneLabel(lane: string) {
  switch (lane) {
    case 'GK':
      return 'Arco'
    case 'DEF':
      return 'Defensa'
    case 'MID':
      return 'Mediocampo'
    case 'ATT':
      return 'Ataque'
    default:
      return lane
  }
}

function formatSlotLabel(slotCode: string) {
  if (slotCode.startsWith('CB')) {
    return 'Central'
  }

  if (slotCode.startsWith('CM')) {
    return 'Interior'
  }

  if (slotCode.startsWith('ST')) {
    return 'Delantero'
  }

  const map: Record<string, string> = {
    GK: 'Arquero',
    LB: 'Lateral izquierdo',
    RB: 'Lateral derecho',
    LM: 'Banda izquierda',
    RM: 'Banda derecha',
    LW: 'Extremo izquierdo',
    RW: 'Extremo derecho',
  }

  return map[slotCode] ?? slotCode
}

function formatAge(birthDate: string | null) {
  if (!birthDate) {
    return null
  }

  const date = new Date(birthDate)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  const today = new Date()
  let age = today.getUTCFullYear() - date.getUTCFullYear()
  const monthDelta = today.getUTCMonth() - date.getUTCMonth()

  if (monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < date.getUTCDate())) {
    age -= 1
  }

  return age
}

function getPlayerGroupOrder(player: DraftPlayer) {
  return POSITION_GROUP_ORDER[player.listedPositionGroup] ?? POSITION_GROUP_ORDER[player.primaryPosition] ?? 99
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

export function DraftWorkbench({ summary, formations, countries }: DraftWorkbenchProps) {
  const [selectedFormationCode, setSelectedFormationCode] = useState(formations[0]?.code ?? '')
  const [selectedDifficulty, setSelectedDifficulty] = useState<DraftDifficultyMode>('CLASSIC')
  const [draftState, setDraftState] = useState<DraftSessionState | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)
  const [persistenceMode, setPersistenceMode] = useState<DraftPersistenceMode>('local-fallback')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isFinalizing, setIsFinalizing] = useState(false)
  const [tournamentMessage, setTournamentMessage] = useState<string | null>(null)
  const [tournamentId, setTournamentId] = useState<string | null>(null)

  const countriesBySlug = useMemo(
    () => Object.fromEntries(countries.map((country) => [country.countrySlug, country])),
    [countries]
  )

  const playersById = useMemo(
    () =>
      Object.fromEntries(
        countries.flatMap((country) => country.players.map((player) => [player.id, player]))
      ) as Record<string, DraftPlayer>,
    [countries]
  )

  useEffect(() => {
    async function bootstrapDraft() {
      const savedDraft = window.localStorage.getItem(STORAGE_KEY)

      if (savedDraft) {
        try {
          const parsed = normalizeDraftState(JSON.parse(savedDraft) as DraftSessionState)

          setDraftState(parsed)
          setSelectedFormationCode(parsed.formationCode)
          setSelectedDifficulty(parsed.difficulty)
        } catch {
          window.localStorage.removeItem(STORAGE_KEY)
        }
      }

      try {
        const response = await fetch('/api/draft/singleplayer', {
          cache: 'no-store',
        })

        if (!response.ok) {
          throw new Error('No se pudo cargar la partida guardada.')
        }

        const payload = (await response.json()) as {
          draftState: DraftSessionState | null
          persistenceMode: DraftPersistenceMode
          lastSavedAt: string | null
        }

        setPersistenceMode(payload.persistenceMode)
        setLastSavedAt(payload.lastSavedAt)

        if (payload.draftState) {
          const normalizedRemoteState = normalizeDraftState(payload.draftState)

          setDraftState(normalizedRemoteState)
          setSelectedFormationCode(normalizedRemoteState.formationCode)
          setSelectedDifficulty(normalizedRemoteState.difficulty)
        }
      } catch {
        setPersistenceMode('local-fallback')
      }

      setIsHydrated(true)
    }

    void bootstrapDraft()
  }, [])

  useEffect(() => {
    if (!isHydrated) {
      return
    }

    if (draftState) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draftState))
      return
    }

    window.localStorage.removeItem(STORAGE_KEY)
  }, [draftState, isHydrated])

  useEffect(() => {
    if (!isHydrated || !draftState) {
      return
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        setIsSaving(true)

        const response = await fetch('/api/draft/singleplayer', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({ draftState }),
        })

        if (!response.ok) {
          throw new Error('No se pudo guardar la partida.')
        }

        const payload = (await response.json()) as {
          persistenceMode: DraftPersistenceMode
          lastSavedAt: string | null
        }

        setPersistenceMode(payload.persistenceMode)
        setLastSavedAt(payload.lastSavedAt)
      } catch {
        setPersistenceMode('local-fallback')
      } finally {
        setIsSaving(false)
      }
    }, 500)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [draftState, isHydrated])

  const activeFormation = useMemo(
    () => formations.find((formation) => formation.code === (draftState?.formationCode ?? selectedFormationCode)) ?? formations[0],
    [draftState?.formationCode, formations, selectedFormationCode]
  )

  const usedCountrySlugs = draftState?.usedCountrySlugs ?? []

  const openSlotCodes = useMemo(() => {
    if (!draftState || !activeFormation) {
      return []
    }

    return activeFormation.slots
      .map((slot) => slot.code)
      .filter((slotCode) => !draftState.picks[slotCode])
  }, [activeFormation, draftState])

  const playableCountries = useMemo(() => {
    if (!draftState || !activeFormation) {
      return []
    }

    return countries.filter((country) =>
      !usedCountrySlugs.includes(country.countrySlug) &&
      country.players.some(
        (player) =>
          player.isDataReady &&
          !draftState.usedPlayerIds.includes(player.id) &&
          getCompatibleSlots(player, openSlotCodes).length > 0
      )
    )
  }, [activeFormation, countries, draftState, openSlotCodes, usedCountrySlugs])

  const currentCountry = draftState?.currentCountrySlug ? countriesBySlug[draftState.currentCountrySlug] : null

  const currentCountryPlayers = useMemo(() => {
    if (!currentCountry || !draftState) {
      return []
    }

    return [...currentCountry.players]
      .sort((left, right) => {
        const groupDelta = getPlayerGroupOrder(left) - getPlayerGroupOrder(right)

        if (groupDelta !== 0) {
          return groupDelta
        }

        const positionDelta = left.primaryPosition.localeCompare(right.primaryPosition)

        if (positionDelta !== 0) {
          return positionDelta
        }

        return right.ovr - left.ovr || left.name.localeCompare(right.name)
      })
      .map((player) => {
        const isAlreadyPicked = draftState.usedPlayerIds.includes(player.id)
        const compatibleSlots = isAlreadyPicked ? [] : getCompatibleSlots(player, openSlotCodes)
        const isDisabled = !player.isDataReady || isAlreadyPicked || compatibleSlots.length === 0
        const disabledReason = isAlreadyPicked
          ? 'Ya ocupa un lugar en tu equipo.'
          : !player.isDataReady
            ? 'Todavía no está disponible para entrar al draft.'
            : compatibleSlots.length === 0
              ? 'No encaja con los espacios que te quedan por cubrir.'
              : null

        return {
          ...player,
          compatibleSlots,
          isDisabled,
          disabledReason,
        }
      })
  }, [currentCountry, draftState, openSlotCodes])

  const filledSlots = draftState ? Object.keys(draftState.picks).length : 0
  const progressPercentage = activeFormation
    ? Math.round((filledSlots / activeFormation.slots.length) * 100)
    : 0
  const isComplete = Boolean(
    draftState && activeFormation && isDraftComplete(activeFormation.slots.map((slot) => slot.code), draftState.picks)
  )

  function pickRandomCountry(nextPool: DraftCountryGroup[]) {
    if (nextPool.length === 0) {
      return null
    }

    const randomIndex = Math.floor(Math.random() * nextPool.length)
    return nextPool[randomIndex]?.countrySlug ?? null
  }

  function startDraft() {
    if (!activeFormation) {
      return
    }

    setTournamentId(null)
    setTournamentMessage(null)
    setDraftState({
      formationCode: selectedFormationCode,
      difficulty: selectedDifficulty,
      rerollsLeft: 3,
      currentCountrySlug: null,
      usedCountrySlugs: [],
      picks: {},
      usedPlayerIds: [],
      startedAt: new Date().toISOString(),
      completedAt: null,
    })
  }

  function rollCountry() {
    if (!draftState) {
      return
    }

    const nextCountrySlug = pickRandomCountry(playableCountries)

    setDraftState((current) =>
      current
        ? {
            ...current,
            currentCountrySlug: nextCountrySlug,
            usedCountrySlugs: nextCountrySlug
              ? [...new Set([...current.usedCountrySlugs, nextCountrySlug])]
              : current.usedCountrySlugs,
          }
        : current
    )
  }

  function rerollCountry() {
    if (!draftState || draftState.rerollsLeft <= 0) {
      return
    }

    const nextCountrySlug = pickRandomCountry(playableCountries)

    setDraftState((current) =>
      current
        ? {
            ...current,
            rerollsLeft: Math.max(0, current.rerollsLeft - 1),
            currentCountrySlug: nextCountrySlug,
            usedCountrySlugs: nextCountrySlug
              ? [...new Set([...current.usedCountrySlugs, nextCountrySlug])]
              : current.usedCountrySlugs,
          }
        : current
    )
  }

  function assignPlayer(playerId: string, slotCode: string) {
    if (!draftState || !activeFormation) {
      return
    }

    setDraftState((current) => {
      if (!current) {
        return current
      }

      const nextPicks = {
        ...current.picks,
        [slotCode]: playerId,
      }
      const nextUsedPlayers = [...current.usedPlayerIds, playerId]
      const isCompleted = activeFormation.slots.every((slot) => nextPicks[slot.code])

      return {
        ...current,
        picks: nextPicks,
        usedPlayerIds: nextUsedPlayers,
        currentCountrySlug: null,
        completedAt: isCompleted ? new Date().toISOString() : null,
      }
    })
  }

  async function resetDraft() {
    try {
      await fetch('/api/draft/singleplayer', {
        method: 'DELETE',
      })
    } catch {
      setPersistenceMode('local-fallback')
    }

    setDraftState(null)
    setLastSavedAt(null)
    setTournamentId(null)
    setTournamentMessage(null)
    setSelectedFormationCode(formations[0]?.code ?? '')
    setSelectedDifficulty('CLASSIC')
  }

  async function finalizeDraftAndCreateTournament() {
    if (!draftState || !isComplete) {
      return
    }

    try {
      setIsFinalizing(true)
      setTournamentMessage(null)

      const response = await fetch('/api/tournaments/singleplayer', {
        method: 'POST',
      })

      const payload = (await response.json()) as {
        error?: string
        tournament?: { tournamentId: string; reused?: boolean }
      }

      if (!response.ok) {
        throw new Error(payload.error ?? 'No se pudo iniciar tu Mundial.')
      }

      setTournamentId(payload.tournament?.tournamentId ?? null)
      setTournamentMessage(
        payload.tournament?.reused
          ? 'Tu camino ya estaba en marcha. Entrá y seguí desde donde lo dejaste.'
          : 'Tu selección ya quedó dentro del Mundial. La aventura sigue en el torneo.'
      )
      setDraftState((current) =>
        current
          ? {
              ...current,
              completedAt: current.completedAt ?? new Date().toISOString(),
            }
          : current
      )
    } catch (error) {
      setTournamentMessage(error instanceof Error ? error.message : 'No se pudo abrir el torneo.')
    } finally {
      setIsFinalizing(false)
    }
  }

  const persistenceLabel = persistenceMode === 'remote' ? 'Partida sincronizada' : 'Partida guardada en este dispositivo'
  const availableCountriesCount = draftState ? playableCountries.length : summary.totalCountries

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="space-y-6 rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-card backdrop-blur sm:p-8">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <p className="font-mono text-xs uppercase tracking-[0.32em] text-cyan/90">
              Sala de draft
            </p>
            <h1 className="text-4xl font-semibold leading-none sm:text-5xl">
              Elegí rápido, porque cada país aparece una sola vez.
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-sand/75 sm:text-base">
              Definí tu plan, dejá que aparezcan las selecciones y armá un once con equilibrio,
              personalidad y momentos de intuición. Lo que no tomás, desaparece del camino.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <article className="rounded-3xl border border-cyan/20 bg-night/70 p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-cyan/85">Jugadores listos</p>
              <p className="mt-2 text-3xl font-semibold">{summary.readyPlayers}</p>
              <p className="mt-1 text-sm text-sand/60">Cartas activas para construir tu selección.</p>
            </article>
            <article className="rounded-3xl border border-white/10 bg-[#111f34]/80 p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-ember/85">Selecciones en juego</p>
              <p className="mt-2 text-3xl font-semibold">{availableCountriesCount}</p>
              <p className="mt-1 text-sm text-sand/60">Cada una puede aparecer solo una vez durante la run.</p>
            </article>
          </div>
        </div>

        {!draftState ? (
          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-4 rounded-3xl border border-white/10 bg-night/60 p-5">
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-sand/60">Tu idea de juego</p>
              <div className="grid gap-3">
                {formations.map((formation) => (
                  <button
                    key={formation.code}
                    type="button"
                    onClick={() => setSelectedFormationCode(formation.code)}
                    className={`rounded-2xl border px-4 py-4 text-left transition ${
                      selectedFormationCode === formation.code
                        ? 'border-cyan bg-cyan/10'
                        : 'border-white/10 bg-white/5 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-mono text-xs uppercase tracking-[0.24em] text-cyan/85">
                          {formation.code}
                        </p>
                        <h2 className="mt-2 text-xl font-semibold">{formation.name}</h2>
                      </div>
                      <span className="rounded-full border border-white/10 px-3 py-1 font-mono text-xs text-sand/70">
                        {formation.slots.length} lugares
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4 rounded-3xl border border-white/10 bg-night/60 p-5">
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-sand/60">Sensación de partida</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {DIFFICULTY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSelectedDifficulty(option.value)}
                    className={`rounded-2xl border px-4 py-4 text-left transition ${
                      selectedDifficulty === option.value
                        ? 'border-ember bg-ember/10'
                        : 'border-white/10 bg-white/5 hover:border-white/25'
                    }`}
                  >
                    <p className="font-mono text-xs uppercase tracking-[0.24em] text-ember/85">
                      {option.value}
                    </p>
                    <h2 className="mt-2 text-xl font-semibold">{option.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-sand/65">{option.detail}</p>
                  </button>
                ))}
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-cyan/85">Cómo funciona</p>
                <p className="mt-3 text-sm leading-7 text-sand/70">
                  Un país aparece, revisás su plantel y decidís. Después desaparece para siempre en esa partida.
                  Si querés buscar otra opción, podés quemar un reroll y seguir adelante.
                </p>
              </div>

              <button
                type="button"
                onClick={startDraft}
                className="w-full rounded-full bg-sand px-5 py-4 font-mono text-xs uppercase tracking-[0.3em] text-night transition hover:bg-white"
              >
                Empezar mi selección
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-3xl border border-white/10 bg-night/60 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.24em] text-cyan/85">Tu selección</p>
                    <h2 className="mt-2 text-2xl font-semibold">
                      {filledSlots} de {activeFormation?.slots.length ?? 0} puestos cubiertos
                    </h2>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={resetDraft}
                      className="rounded-full border border-white/15 px-4 py-2 font-mono text-xs uppercase tracking-[0.22em] text-sand/75 transition hover:border-white/35"
                    >
                      Empezar de nuevo
                    </button>
                    <button
                      type="button"
                      onClick={rollCountry}
                      disabled={playableCountries.length === 0}
                      className="rounded-full border border-cyan/30 px-4 py-2 font-mono text-xs uppercase tracking-[0.22em] text-cyan transition disabled:cursor-not-allowed disabled:opacity-40 hover:border-cyan hover:bg-cyan/10"
                    >
                      Mostrar selección
                    </button>
                    <button
                      type="button"
                      onClick={finalizeDraftAndCreateTournament}
                      disabled={!isComplete || isFinalizing}
                      className="rounded-full bg-sand px-4 py-2 font-mono text-xs uppercase tracking-[0.22em] text-night transition disabled:cursor-not-allowed disabled:opacity-40 hover:bg-white"
                    >
                      {isFinalizing ? 'Abriendo torneo...' : 'Ir al Mundial'}
                    </button>
                  </div>
                </div>

                <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan to-emerald-300 transition-all"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-sand/55">Estilo</p>
                    <p className="mt-2 text-lg font-semibold">{draftState.difficulty === 'CLASSIC' ? 'Vision total' : 'Pulso ciego'}</p>
                  </article>
                  <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-sand/55">Rerolls</p>
                    <p className="mt-2 text-lg font-semibold">{draftState.rerollsLeft}</p>
                  </article>
                  <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-sand/55">Selecciones restantes</p>
                    <p className="mt-2 text-lg font-semibold">{playableCountries.length}</p>
                  </article>
                  <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-sand/55">Partida</p>
                    <p className="mt-2 text-lg font-semibold">{persistenceLabel}</p>
                  </article>
                </div>

                {tournamentMessage ? (
                  <div className="mt-4 rounded-3xl border border-emerald-300/15 bg-emerald-300/10 p-4 text-sm leading-7 text-sand/80">
                    <p>{tournamentMessage}</p>
                    {tournamentId ? (
                      <div className="mt-3 flex flex-wrap gap-3">
                        <Link
                          href="/tournament"
                          className="rounded-full border border-white/15 px-4 py-2 font-mono text-xs uppercase tracking-[0.22em] text-sand/80 transition hover:border-white/30"
                        >
                          Entrar al torneo
                        </Link>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="rounded-3xl border border-white/10 bg-[#0d1728]/85 p-5">
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-ember/85">Selección del momento</p>
                {currentCountry ? (
                  <>
                    <h2 className="mt-3 text-3xl font-semibold">{currentCountry.country}</h2>
                    <p className="mt-2 text-sm leading-6 text-sand/70">
                      Tenés una sola oportunidad para elegir desde este plantel antes de seguir adelante.
                    </p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-sand/55">Jugables</p>
                        <p className="mt-2 text-2xl font-semibold">{currentCountry.readyPlayers}</p>
                      </article>
                      <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-sand/55">Fuera de juego</p>
                        <p className="mt-2 text-2xl font-semibold">{currentCountry.blockedPlayers}</p>
                      </article>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={rerollCountry}
                        disabled={draftState.rerollsLeft <= 0 || playableCountries.length === 0}
                        className="rounded-full border border-ember/30 px-4 py-2 font-mono text-xs uppercase tracking-[0.22em] text-ember transition disabled:cursor-not-allowed disabled:opacity-40 hover:border-ember hover:bg-ember/10"
                      >
                        Buscar otra selección
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="mt-3 text-3xl font-semibold">Esperando la próxima selección</h2>
                    <p className="mt-2 text-sm leading-6 text-sand/70">
                      Tocá “Mostrar selección” para descubrir un nuevo país y seguir dándole forma a tu equipo.
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-3xl border border-white/10 bg-night/60 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.22em] text-cyan/85">Cancha</p>
                    <h2 className="mt-2 text-2xl font-semibold">{activeFormation?.name}</h2>
                  </div>

                  {draftState.completedAt ? (
                    <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 font-mono text-xs uppercase tracking-[0.22em] text-emerald-200">
                      Equipo listo
                    </span>
                  ) : null}
                </div>

                <div className="mt-5 space-y-4">
                  {(['GK', 'DEF', 'MID', 'ATT'] as const).map((lane) => {
                    const laneSlots = activeFormation?.slots.filter((slot) => slot.lane === lane) ?? []

                    if (laneSlots.length === 0) {
                      return null
                    }

                    return (
                      <div key={lane} className="rounded-3xl border border-white/10 bg-emerald-400/5 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-mono text-xs uppercase tracking-[0.22em] text-emerald-200/80">
                            {formatLaneLabel(lane)}
                          </p>
                          <span className="text-xs text-sand/55">{laneSlots.length} lugares</span>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {laneSlots.map((slot) => {
                            const pickedPlayer = draftState.picks[slot.code]
                              ? playersById[draftState.picks[slot.code]]
                              : null

                            return (
                              <article
                                key={slot.code}
                                className={`rounded-2xl border p-4 ${
                                  pickedPlayer
                                    ? 'border-cyan/30 bg-cyan/10'
                                    : 'border-dashed border-white/15 bg-white/5'
                                }`}
                              >
                                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-sand/55">
                                  {slot.code}
                                </p>
                                <h3 className="mt-2 text-lg font-semibold">{formatSlotLabel(slot.code)}</h3>
                                {pickedPlayer ? (
                                  <>
                                    <p className="mt-3 text-base text-sand">{pickedPlayer.name}</p>
                                    <p className="mt-1 text-sm text-sand/65">{pickedPlayer.country}</p>
                                    <p className="mt-2 font-mono text-xs uppercase tracking-[0.2em] text-cyan/85">
                                      {draftState.difficulty === 'CLASSIC' ? `Impacto ${pickedPlayer.ovr}` : 'Impacto oculto'}
                                    </p>
                                  </>
                                ) : (
                                  <p className="mt-3 text-sm leading-6 text-sand/60">
                                    Este lugar sigue esperando a su nombre ideal.
                                  </p>
                                )}
                              </article>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-night/60 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.22em] text-cyan/85">Plantel disponible</p>
                    <h2 className="mt-2 text-2xl font-semibold">
                      {currentCountry ? currentCountry.country : 'Esperando la próxima selección'}
                    </h2>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {currentCountryPlayers.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-6 text-sm leading-7 text-sand/65">
                      Descubrí una selección para revisar sus nombres y ver si alguno encaja en el equipo que estás armando.
                    </div>
                  ) : (
                    currentCountryPlayers.map((player) => {
                      const age = formatAge(player.birthDate)

                      return (
                        <article
                          key={player.id}
                          className={`rounded-3xl border p-4 ${
                            player.isDisabled
                              ? 'border-amber-300/15 bg-amber-100/5'
                              : 'border-white/10 bg-white/5'
                          }`}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-sand/55">
                                {player.primaryPosition} · {player.listedPositionGroup}
                              </p>
                              <h3 className="mt-2 text-xl font-semibold">{player.name}</h3>
                              <p className="mt-1 text-sm text-sand/60">
                                {player.club ?? 'Selección nacional'}
                                {age ? ` · ${age} años` : ''}
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <span
                                className={`rounded-full px-3 py-1 font-mono text-xs uppercase tracking-[0.2em] ${
                                  player.isDataReady
                                    ? 'border border-emerald-300/25 bg-emerald-300/10 text-emerald-200'
                                    : 'border border-amber-300/25 bg-amber-300/10 text-amber-100'
                                }`}
                              >
                                {player.isDataReady ? 'Disponible' : 'Fuera de juego'}
                              </span>
                              <span className="rounded-full border border-white/10 px-3 py-1 font-mono text-xs uppercase tracking-[0.2em] text-cyan/85">
                                {draftState.difficulty === 'CLASSIC' ? `Impacto ${player.ovr}` : 'Impacto oculto'}
                              </span>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2 text-xs text-sand/60">
                            <span className="rounded-full border border-white/10 px-3 py-1">
                              Principal: {player.primaryPosition}
                            </span>
                            {player.secondaryPositions.map((position) => (
                              <span key={position} className="rounded-full border border-white/10 px-3 py-1">
                                Alternativa: {position}
                              </span>
                            ))}
                          </div>

                          {draftState.difficulty === 'CLASSIC' ? (
                            <div className="mt-4 grid gap-2 sm:grid-cols-5">
                              {[
                                ['Ataque', player.attack],
                                ['Juego', player.midfield],
                                ['Cierre', player.defense],
                                ['Arco', player.goalkeeping],
                                ['Impacto', player.ovr],
                              ].map(([label, value]) => (
                                <div key={label} className="rounded-2xl border border-white/10 bg-night/50 px-3 py-3">
                                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-sand/55">{label}</p>
                                  <p className="mt-2 text-lg font-semibold">{value}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-4 rounded-2xl border border-white/10 bg-night/50 px-4 py-3 text-sm text-sand/65">
                              En este modo elegís por intuición. El verdadero peso de la carta se revela al usarla.
                            </div>
                          )}

                          <div className="mt-4 flex flex-wrap gap-2">
                            {player.compatibleSlots.map((slotCode) => (
                              <button
                                key={`${player.id}-${slotCode}`}
                                type="button"
                                onClick={() => assignPlayer(player.id, slotCode)}
                                disabled={player.isDisabled}
                                className="rounded-full border border-cyan/30 px-3 py-2 font-mono text-xs uppercase tracking-[0.2em] text-cyan transition disabled:cursor-not-allowed disabled:opacity-40 hover:border-cyan hover:bg-cyan/10"
                              >
                                Llevar a {slotCode}
                              </button>
                            ))}
                          </div>

                          {player.disabledReason ? (
                            <p className="mt-4 text-sm leading-6 text-amber-100/85">{player.disabledReason}</p>
                          ) : null}
                        </article>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      <aside className="space-y-6 rounded-[2rem] border border-white/10 bg-[#0d1728]/88 p-6 shadow-card backdrop-blur sm:p-8">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-ember/85">Noche de draft</p>
          <h2 className="mt-3 text-3xl font-semibold">La tensión está en cada aparición</h2>
          <p className="mt-3 text-sm leading-7 text-sand/70">
            El draft mezcla planificación y oportunidad. Algunas selecciones te resuelven una línea entera; otras apenas te regalan una decisión difícil.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <article className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-cyan/85">Progreso</p>
            <p className="mt-3 text-sm leading-7 text-sand/70">
              Tu armado queda guardado para que puedas volver a una partida en marcha cuando quieras.
            </p>
            <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.22em] text-sand/55">
              {persistenceLabel}
              {isSaving ? ' · guardando' : ''}
              {lastSavedAt ? ` · ${new Date(lastSavedAt).toLocaleTimeString('es-AR')}` : ''}
            </p>
          </article>

          <article className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-cyan/85">Riesgo</p>
            <p className="mt-3 text-sm leading-7 text-sand/70">
              Los nombres que todavía no entran al juego siguen visibles para que sientas todo lo que queda en suspenso.
            </p>
          </article>
        </div>

        <div className="space-y-3">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-sand/55">Panorama general</p>
          <div className="grid gap-3">
            {countries.slice(0, 8).map((country) => (
              <article key={country.countrySlug} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold">{country.country}</h3>
                  <span className="font-mono text-xs uppercase tracking-[0.2em] text-cyan/85">
                    {country.readyPlayers}/{country.totalPlayers}
                  </span>
                </div>
                <p className="mt-2 text-sm text-sand/65">
                  {country.blockedPlayers > 0
                    ? `${country.blockedPlayers} nombres todavía esperan entrar al juego.`
                    : 'Plantel completo listo para aparecer en una ronda.'}
                </p>
              </article>
            ))}
          </div>
        </div>
      </aside>
    </div>
  )
}
