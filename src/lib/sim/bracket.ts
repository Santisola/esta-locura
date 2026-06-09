import type { BracketSlot, GroupStanding, ThirdPlaceRanking } from './types'

export const GROUP_CODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as const

export type BracketDefItem = {
  round: string
  matchId: string
  home: BracketSlot
  away: BracketSlot
  nextMatchId: string
  order: number
}

const R32: BracketDefItem[] = [
  { round: 'ROUND_OF_32', matchId: 'r32_01', home: { type: 'group_winner', group: 'A' }, away: { type: 'group_winner', group: 'B' }, nextMatchId: 'r16_01', order: 0 },
  { round: 'ROUND_OF_32', matchId: 'r32_02', home: { type: 'third_ranked', rank: 8 }, away: { type: 'group_runner_up', group: 'C' }, nextMatchId: 'r16_01', order: 1 },
  { round: 'ROUND_OF_32', matchId: 'r32_03', home: { type: 'group_winner', group: 'D' }, away: { type: 'group_winner', group: 'E' }, nextMatchId: 'r16_02', order: 2 },
  { round: 'ROUND_OF_32', matchId: 'r32_04', home: { type: 'third_ranked', rank: 7 }, away: { type: 'group_runner_up', group: 'F' }, nextMatchId: 'r16_02', order: 3 },
  { round: 'ROUND_OF_32', matchId: 'r32_05', home: { type: 'group_winner', group: 'G' }, away: { type: 'group_winner', group: 'H' }, nextMatchId: 'r16_03', order: 4 },
  { round: 'ROUND_OF_32', matchId: 'r32_06', home: { type: 'third_ranked', rank: 6 }, away: { type: 'group_runner_up', group: 'I' }, nextMatchId: 'r16_03', order: 5 },
  { round: 'ROUND_OF_32', matchId: 'r32_07', home: { type: 'group_winner', group: 'J' }, away: { type: 'group_winner', group: 'K' }, nextMatchId: 'r16_04', order: 6 },
  { round: 'ROUND_OF_32', matchId: 'r32_08', home: { type: 'third_ranked', rank: 5 }, away: { type: 'group_runner_up', group: 'L' }, nextMatchId: 'r16_04', order: 7 },
  { round: 'ROUND_OF_32', matchId: 'r32_09', home: { type: 'group_winner', group: 'C' }, away: { type: 'third_ranked', rank: 4 }, nextMatchId: 'r16_05', order: 8 },
  { round: 'ROUND_OF_32', matchId: 'r32_10', home: { type: 'group_runner_up', group: 'A' }, away: { type: 'group_runner_up', group: 'B' }, nextMatchId: 'r16_05', order: 9 },
  { round: 'ROUND_OF_32', matchId: 'r32_11', home: { type: 'group_winner', group: 'F' }, away: { type: 'third_ranked', rank: 3 }, nextMatchId: 'r16_06', order: 10 },
  { round: 'ROUND_OF_32', matchId: 'r32_12', home: { type: 'group_runner_up', group: 'D' }, away: { type: 'group_runner_up', group: 'E' }, nextMatchId: 'r16_06', order: 11 },
  { round: 'ROUND_OF_32', matchId: 'r32_13', home: { type: 'group_winner', group: 'I' }, away: { type: 'third_ranked', rank: 2 }, nextMatchId: 'r16_07', order: 12 },
  { round: 'ROUND_OF_32', matchId: 'r32_14', home: { type: 'group_runner_up', group: 'G' }, away: { type: 'group_runner_up', group: 'H' }, nextMatchId: 'r16_07', order: 13 },
  { round: 'ROUND_OF_32', matchId: 'r32_15', home: { type: 'group_winner', group: 'L' }, away: { type: 'third_ranked', rank: 1 }, nextMatchId: 'r16_08', order: 14 },
  { round: 'ROUND_OF_32', matchId: 'r32_16', home: { type: 'group_runner_up', group: 'J' }, away: { type: 'group_runner_up', group: 'K' }, nextMatchId: 'r16_08', order: 15 },
]

const R16_LINKS = [
  { matchId: 'r16_01', parentIds: ['r32_01', 'r32_02'], nextMatchId: 'qf_01' },
  { matchId: 'r16_02', parentIds: ['r32_03', 'r32_04'], nextMatchId: 'qf_01' },
  { matchId: 'r16_03', parentIds: ['r32_05', 'r32_06'], nextMatchId: 'qf_02' },
  { matchId: 'r16_04', parentIds: ['r32_07', 'r32_08'], nextMatchId: 'qf_02' },
  { matchId: 'r16_05', parentIds: ['r32_09', 'r32_10'], nextMatchId: 'qf_03' },
  { matchId: 'r16_06', parentIds: ['r32_11', 'r32_12'], nextMatchId: 'qf_03' },
  { matchId: 'r16_07', parentIds: ['r32_13', 'r32_14'], nextMatchId: 'qf_04' },
  { matchId: 'r16_08', parentIds: ['r32_15', 'r32_16'], nextMatchId: 'qf_04' },
]

const QF_LINKS = [
  { matchId: 'qf_01', parentIds: ['r16_01', 'r16_02'], nextMatchId: 'sf_01' },
  { matchId: 'qf_02', parentIds: ['r16_03', 'r16_04'], nextMatchId: 'sf_01' },
  { matchId: 'qf_03', parentIds: ['r16_05', 'r16_06'], nextMatchId: 'sf_02' },
  { matchId: 'qf_04', parentIds: ['r16_07', 'r16_08'], nextMatchId: 'sf_02' },
]

const SF_LINKS = [
  { matchId: 'sf_01', parentIds: ['qf_01', 'qf_02'], nextMatchId: 'final' },
  { matchId: 'sf_02', parentIds: ['qf_03', 'qf_04'], nextMatchId: 'final' },
]

const FINAL_LINK = [
  { matchId: 'final', parentIds: ['sf_01', 'sf_02'], nextMatchId: '' },
]

function buildRoundDef(
  links: Array<{ matchId: string; parentIds: string[]; nextMatchId: string }>,
  round: string,
): BracketDefItem[] {
  return links.map((link, i) => ({
    round,
    matchId: link.matchId,
    home: { type: 'match_winner' as const, matchId: link.parentIds[0] },
    away: { type: 'match_winner' as const, matchId: link.parentIds[1] },
    nextMatchId: link.nextMatchId,
    order: i,
  }))
}

export function getBracketDefs(): BracketDefItem[] {
  return [
    ...R32,
    ...buildRoundDef(R16_LINKS, 'ROUND_OF_16'),
    ...buildRoundDef(QF_LINKS, 'QUARTER_FINAL'),
    ...buildRoundDef(SF_LINKS, 'SEMI_FINAL'),
    ...buildRoundDef(FINAL_LINK, 'FINAL'),
  ]
}

export function resolveSlotToTeam(
  slot: BracketSlot,
  standingsByGroup: Map<string, { winner: GroupStanding; runnerUp: GroupStanding }>,
  qualifiedThird: ThirdPlaceRanking[],
): GroupStanding | null {
  if (slot.type === 'group_winner' && slot.group) {
    return standingsByGroup.get(slot.group)?.winner ?? null
  }
  if (slot.type === 'group_runner_up' && slot.group) {
    return standingsByGroup.get(slot.group)?.runnerUp ?? null
  }
  if (slot.type === 'third_ranked' && slot.rank) {
    return qualifiedThird[slot.rank - 1] ?? null
  }
  return null
}
