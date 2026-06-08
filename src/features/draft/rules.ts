import type { DraftPlayer } from '@/features/draft/types'

export function isPlayerReadyForMvp(player: {
  enrichmentStatus: string
  wikidataId: string | null
  primaryPosition: string | null
  ovr: number | null
  attack: number | null
  midfield: number | null
  defense: number | null
  goalkeeping: number | null
}) {
  return (
    player.enrichmentStatus === 'matched' &&
    Boolean(player.wikidataId) &&
    Boolean(player.primaryPosition) &&
    typeof player.ovr === 'number' &&
    typeof player.attack === 'number' &&
    typeof player.midfield === 'number' &&
    typeof player.defense === 'number' &&
    typeof player.goalkeeping === 'number'
  )
}

export function getPlayerLockReason(player: {
  enrichmentStatus: string
  wikidataId: string | null
  primaryPosition: string | null
  ovr: number | null
  attack: number | null
  midfield: number | null
  defense: number | null
  goalkeeping: number | null
}) {
  if (player.enrichmentStatus !== 'matched' || !player.wikidataId) {
    return 'Pendiente de validacion automatica para el MVP.'
  }

  if (!player.primaryPosition) {
    return 'Todavia no tiene posicion primaria confiable.'
  }

  if (
    typeof player.ovr !== 'number' ||
    typeof player.attack !== 'number' ||
    typeof player.midfield !== 'number' ||
    typeof player.defense !== 'number' ||
    typeof player.goalkeeping !== 'number'
  ) {
    return 'Todavia no tiene ratings minimos para jugar el draft.'
  }

  return null
}

export function getAllowedPositionsForSlot(slotCode: string) {
  if (slotCode === 'GK') {
    return ['GK']
  }

  if (slotCode === 'LB') {
    return ['LB', 'LWB', 'CB']
  }

  if (slotCode === 'RB') {
    return ['RB', 'RWB', 'CB']
  }

  if (slotCode.startsWith('CB')) {
    return ['CB', 'SW']
  }

  if (slotCode === 'LM') {
    return ['LM', 'LW', 'CM', 'CAM']
  }

  if (slotCode === 'RM') {
    return ['RM', 'RW', 'CM', 'CAM']
  }

  if (slotCode.startsWith('CM')) {
    return ['CM', 'CDM', 'CAM']
  }

  if (slotCode.startsWith('CDM')) {
    return ['CDM', 'CM']
  }

  if (slotCode.startsWith('CAM')) {
    return ['CAM', 'CM', 'CF']
  }

  if (slotCode === 'LW') {
    return ['LW', 'LF', 'ST', 'LM']
  }

  if (slotCode === 'RW') {
    return ['RW', 'RF', 'ST', 'RM']
  }

  if (slotCode.startsWith('ST')) {
    return ['ST', 'CF', 'LF', 'RF']
  }

  return ['CM', 'CB', 'ST']
}

export function getCompatibleSlots(player: DraftPlayer, openSlotCodes: string[]) {
  const playerPositions = [player.primaryPosition, ...player.secondaryPositions]

  return openSlotCodes.filter((slotCode) => {
    const allowedPositions = getAllowedPositionsForSlot(slotCode)

    return playerPositions.some((position) => allowedPositions.includes(position))
  })
}

export function isDraftComplete(requiredSlotCodes: string[], picks: Record<string, string>) {
  return requiredSlotCodes.every((slotCode) => Boolean(picks[slotCode]))
}
