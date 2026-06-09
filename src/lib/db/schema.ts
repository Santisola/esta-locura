import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const difficultyModeEnum = pgEnum('difficulty_mode', ['CLASSIC', 'MEMORY'])
export const roomStatusEnum = pgEnum('room_status', [
  'LOBBY',
  'DRAFT',
  'TOURNAMENT',
  'FINISHED',
  'CANCELLED',
])
export const participantDraftStatusEnum = pgEnum('participant_draft_status', [
  'WAITING',
  'CHOOSING',
  'COMPLETED',
  'DISCONNECTED',
])
export const connectionStatusEnum = pgEnum('connection_status', ['ONLINE', 'OFFLINE'])
export const draftedTeamStatusEnum = pgEnum('drafted_team_status', [
  'BUILDING',
  'COMPLETED',
  'LOCKED',
])
export const tournamentTypeEnum = pgEnum('tournament_type', ['SINGLEPLAYER', 'MULTIPLAYER'])
export const tournamentStatusEnum = pgEnum('tournament_status', [
  'PENDING',
  'GROUP_STAGE',
  'ROUND_OF_32',
  'ROUND_OF_16',
  'QUARTER_FINAL',
  'SEMI_FINAL',
  'FINAL',
  'FINISHED',
])
export const tournamentEntryTypeEnum = pgEnum('tournament_entry_type', [
  'HUMAN_DRAFTED',
  'REAL_TEAM',
])
export const matchRoundEnum = pgEnum('match_round', [
  'GROUP',
  'ROUND_OF_32',
  'ROUND_OF_16',
  'QUARTER_FINAL',
  'SEMI_FINAL',
  'FINAL',
])
export const matchStatusEnum = pgEnum('match_status', ['PENDING', 'LIVE', 'FINISHED'])
export const matchEventTypeEnum = pgEnum('match_event_type', [
  'KICKOFF',
  'GOAL',
  'YELLOW_CARD',
  'RED_CARD',
  'INJURY',
  'PENALTY_GOAL',
  'PENALTY_MISS',
  'FULL_TIME',
])
export const matchSideEnum = pgEnum('match_side', ['HOME', 'AWAY', 'NEUTRAL'])

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    nickname: text('nickname').notNull(),
    sessionToken: text('session_token').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sessionTokenIdx: uniqueIndex('users_session_token_idx').on(table.sessionToken),
  })
)

export const nationalTeams = pgTable(
  'national_teams',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    code: text('code').notNull(),
    confederation: text('confederation').notNull(),
    groupSeed: integer('group_seed'),
    flagUrl: text('flag_url'),
    crestUrl: text('crest_url'),
    attack: integer('attack').notNull(),
    midfield: integer('midfield').notNull(),
    defense: integer('defense').notNull(),
    goalkeeping: integer('goalkeeping').notNull(),
    ovr: integer('ovr').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex('national_teams_slug_idx').on(table.slug),
    codeIdx: uniqueIndex('national_teams_code_idx').on(table.code),
  })
)

export const players = pgTable(
  'players',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    nationalTeamId: uuid('national_team_id')
      .notNull()
      .references(() => nationalTeams.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    shirtNumber: integer('shirt_number'),
    club: text('club'),
    birthDate: text('birth_date'),
    primaryPosition: text('primary_position').notNull(),
    secondaryPositions: text('secondary_positions').array().default([]).notNull(),
    attack: integer('attack').notNull(),
    midfield: integer('midfield').notNull(),
    defense: integer('defense').notNull(),
    goalkeeping: integer('goalkeeping').notNull(),
    ovr: integer('ovr').notNull(),
    isCaptain: boolean('is_captain').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    teamSlugIdx: uniqueIndex('players_team_slug_idx').on(table.nationalTeamId, table.slug),
  })
)

export const formations = pgTable(
  'formations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    slots: jsonb('slots').$type<Array<{ code: string; lane: 'GK' | 'DEF' | 'MID' | 'ATT'; order: number }>>().notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    codeIdx: uniqueIndex('formations_code_idx').on(table.code),
  })
)

export const rooms = pgTable(
  'rooms',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: text('code').notNull(),
    hostUserId: uuid('host_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    status: roomStatusEnum('status').default('LOBBY').notNull(),
    difficultyMode: difficultyModeEnum('difficulty_mode').notNull(),
    rerollsPerPlayer: integer('rerolls_per_player').default(3).notNull(),
    maxHumanPlayers: integer('max_human_players').default(8).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    codeIdx: uniqueIndex('rooms_code_idx').on(table.code),
  })
)

export const roomParticipants = pgTable(
  'room_participants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    nicknameSnapshot: text('nickname_snapshot').notNull(),
    isHost: boolean('is_host').default(false).notNull(),
    isReady: boolean('is_ready').default(false).notNull(),
    connectionStatus: connectionStatusEnum('connection_status').default('ONLINE').notNull(),
    draftStatus: participantDraftStatusEnum('draft_status').default('WAITING').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    roomUserIdx: uniqueIndex('room_participants_room_user_idx').on(table.roomId, table.userId),
  })
)

export const draftedTeams = pgTable('drafted_teams', {
  id: uuid('id').defaultRandom().primaryKey(),
  roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'set null' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  formationId: uuid('formation_id')
    .notNull()
    .references(() => formations.id, { onDelete: 'restrict' }),
  difficultyMode: difficultyModeEnum('difficulty_mode').notNull(),
  rerollsLeft: integer('rerolls_left').default(3).notNull(),
  status: draftedTeamStatusEnum('status').default('BUILDING').notNull(),
  displayName: text('display_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const draftedTeamPlayers = pgTable(
  'drafted_team_players',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    draftedTeamId: uuid('drafted_team_id')
      .notNull()
      .references(() => draftedTeams.id, { onDelete: 'cascade' }),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict' }),
    slotCode: text('slot_code').notNull(),
    sourceNationalTeamId: uuid('source_national_team_id')
      .notNull()
      .references(() => nationalTeams.id, { onDelete: 'restrict' }),
    pickedAt: timestamp('picked_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    teamSlotIdx: uniqueIndex('drafted_team_players_team_slot_idx').on(table.draftedTeamId, table.slotCode),
    teamPlayerIdx: uniqueIndex('drafted_team_players_team_player_idx').on(table.draftedTeamId, table.playerId),
  })
)

export const tournaments = pgTable('tournaments', {
  id: uuid('id').defaultRandom().primaryKey(),
  roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'set null' }),
  type: tournamentTypeEnum('type').notNull(),
  status: tournamentStatusEnum('status').default('PENDING').notNull(),
  currentRound: matchRoundEnum('current_round'),
  championEntryId: uuid('champion_entry_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  endedAt: timestamp('ended_at', { withTimezone: true }),
})

export const tournamentEntries = pgTable('tournament_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  tournamentId: uuid('tournament_id')
    .notNull()
    .references(() => tournaments.id, { onDelete: 'cascade' }),
  entryType: tournamentEntryTypeEnum('entry_type').notNull(),
  displayName: text('display_name').notNull(),
  draftedTeamId: uuid('drafted_team_id').references(() => draftedTeams.id, { onDelete: 'set null' }),
  nationalTeamId: uuid('national_team_id').references(() => nationalTeams.id, { onDelete: 'set null' }),
  groupCode: text('group_code'),
  seedPosition: integer('seed_position'),
  computedAttack: integer('computed_attack').notNull(),
  computedMidfield: integer('computed_midfield').notNull(),
  computedDefense: integer('computed_defense').notNull(),
  computedGoalkeeping: integer('computed_goalkeeping').notNull(),
  computedOvr: integer('computed_ovr').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
})

export const groupStandings = pgTable(
  'group_standings',
  {
    tournamentId: uuid('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    entryId: uuid('entry_id')
      .notNull()
      .references(() => tournamentEntries.id, { onDelete: 'cascade' }),
    groupCode: text('group_code').notNull(),
    played: integer('played').default(0).notNull(),
    wins: integer('wins').default(0).notNull(),
    draws: integer('draws').default(0).notNull(),
    losses: integer('losses').default(0).notNull(),
    goalsFor: integer('goals_for').default(0).notNull(),
    goalsAgainst: integer('goals_against').default(0).notNull(),
    goalDifference: integer('goal_difference').default(0).notNull(),
    points: integer('points').default(0).notNull(),
    rank: integer('rank'),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.tournamentId, table.entryId] }),
  })
)

export const matches = pgTable('matches', {
  id: uuid('id').defaultRandom().primaryKey(),
  tournamentId: uuid('tournament_id')
    .notNull()
    .references(() => tournaments.id, { onDelete: 'cascade' }),
  round: matchRoundEnum('round').notNull(),
  stageOrder: integer('stage_order').notNull(),
  groupCode: text('group_code'),
  homeEntryId: uuid('home_entry_id')
    .notNull()
    .references(() => tournamentEntries.id, { onDelete: 'cascade' }),
  awayEntryId: uuid('away_entry_id')
    .notNull()
    .references(() => tournamentEntries.id, { onDelete: 'cascade' }),
  homeScore: integer('home_score').default(0).notNull(),
  awayScore: integer('away_score').default(0).notNull(),
  homePenalties: integer('home_penalties'),
  awayPenalties: integer('away_penalties'),
  wentToPenalties: boolean('went_to_penalties').default(false).notNull(),
  winnerEntryId: uuid('winner_entry_id').references(() => tournamentEntries.id, { onDelete: 'set null' }),
  status: matchStatusEnum('status').default('PENDING').notNull(),
  simulationSeed: integer('simulation_seed'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const matchEvents = pgTable('match_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  matchId: uuid('match_id')
    .notNull()
    .references(() => matches.id, { onDelete: 'cascade' }),
  minute: integer('minute').notNull(),
  side: matchSideEnum('side').default('NEUTRAL').notNull(),
  eventType: matchEventTypeEnum('event_type').notNull(),
  playerName: text('player_name'),
  payload: jsonb('payload').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type InsertUser = typeof users.$inferInsert
export type SelectUser = typeof users.$inferSelect
export type InsertNationalTeam = typeof nationalTeams.$inferInsert
export type SelectNationalTeam = typeof nationalTeams.$inferSelect
export type InsertPlayer = typeof players.$inferInsert
export type SelectPlayer = typeof players.$inferSelect
export type InsertDraftedTeam = typeof draftedTeams.$inferInsert
export type SelectDraftedTeam = typeof draftedTeams.$inferSelect
export type InsertTournament = typeof tournaments.$inferInsert
export type SelectTournament = typeof tournaments.$inferSelect
