CREATE TYPE "public"."connection_status" AS ENUM('ONLINE', 'OFFLINE');--> statement-breakpoint
CREATE TYPE "public"."difficulty_mode" AS ENUM('CLASSIC', 'MEMORY');--> statement-breakpoint
CREATE TYPE "public"."drafted_team_status" AS ENUM('BUILDING', 'COMPLETED', 'LOCKED');--> statement-breakpoint
CREATE TYPE "public"."match_event_type" AS ENUM('KICKOFF', 'GOAL', 'YELLOW_CARD', 'RED_CARD', 'INJURY', 'PENALTY_GOAL', 'PENALTY_MISS', 'FULL_TIME');--> statement-breakpoint
CREATE TYPE "public"."match_round" AS ENUM('GROUP', 'ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL');--> statement-breakpoint
CREATE TYPE "public"."match_side" AS ENUM('HOME', 'AWAY', 'NEUTRAL');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('PENDING', 'LIVE', 'FINISHED');--> statement-breakpoint
CREATE TYPE "public"."participant_draft_status" AS ENUM('WAITING', 'CHOOSING', 'COMPLETED', 'DISCONNECTED');--> statement-breakpoint
CREATE TYPE "public"."room_status" AS ENUM('LOBBY', 'DRAFT', 'TOURNAMENT', 'FINISHED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."tournament_entry_type" AS ENUM('HUMAN_DRAFTED', 'REAL_TEAM');--> statement-breakpoint
CREATE TYPE "public"."tournament_status" AS ENUM('PENDING', 'GROUP_STAGE', 'ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL', 'FINISHED');--> statement-breakpoint
CREATE TYPE "public"."tournament_type" AS ENUM('SINGLEPLAYER', 'MULTIPLAYER');--> statement-breakpoint
CREATE TABLE "drafted_team_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"drafted_team_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"slot_code" text NOT NULL,
	"source_national_team_id" uuid NOT NULL,
	"picked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drafted_teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid,
	"user_id" uuid NOT NULL,
	"formation_id" uuid NOT NULL,
	"difficulty_mode" "difficulty_mode" NOT NULL,
	"rerolls_left" integer DEFAULT 3 NOT NULL,
	"status" "drafted_team_status" DEFAULT 'BUILDING' NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "formations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"slots" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_standings" (
	"tournament_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"group_code" text NOT NULL,
	"played" integer DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"draws" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"goals_for" integer DEFAULT 0 NOT NULL,
	"goals_against" integer DEFAULT 0 NOT NULL,
	"goal_difference" integer DEFAULT 0 NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"rank" integer,
	CONSTRAINT "group_standings_tournament_id_entry_id_pk" PRIMARY KEY("tournament_id","entry_id")
);
--> statement-breakpoint
CREATE TABLE "match_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"minute" integer NOT NULL,
	"side" "match_side" DEFAULT 'NEUTRAL' NOT NULL,
	"event_type" "match_event_type" NOT NULL,
	"player_name" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"round" "match_round" NOT NULL,
	"stage_order" integer NOT NULL,
	"group_code" text,
	"home_entry_id" uuid NOT NULL,
	"away_entry_id" uuid NOT NULL,
	"home_score" integer DEFAULT 0 NOT NULL,
	"away_score" integer DEFAULT 0 NOT NULL,
	"home_penalties" integer,
	"away_penalties" integer,
	"went_to_penalties" boolean DEFAULT false NOT NULL,
	"winner_entry_id" uuid,
	"status" "match_status" DEFAULT 'PENDING' NOT NULL,
	"simulation_seed" integer,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "national_teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"confederation" text NOT NULL,
	"group_seed" integer,
	"flag_url" text,
	"crest_url" text,
	"attack" integer NOT NULL,
	"midfield" integer NOT NULL,
	"defense" integer NOT NULL,
	"goalkeeping" integer NOT NULL,
	"ovr" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"national_team_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"shirt_number" integer,
	"primary_position" text NOT NULL,
	"secondary_positions" text[] DEFAULT '{}' NOT NULL,
	"attack" integer NOT NULL,
	"midfield" integer NOT NULL,
	"defense" integer NOT NULL,
	"goalkeeping" integer NOT NULL,
	"ovr" integer NOT NULL,
	"is_captain" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"nickname_snapshot" text NOT NULL,
	"is_host" boolean DEFAULT false NOT NULL,
	"is_ready" boolean DEFAULT false NOT NULL,
	"connection_status" "connection_status" DEFAULT 'ONLINE' NOT NULL,
	"draft_status" "participant_draft_status" DEFAULT 'WAITING' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"host_user_id" uuid NOT NULL,
	"status" "room_status" DEFAULT 'LOBBY' NOT NULL,
	"difficulty_mode" "difficulty_mode" NOT NULL,
	"rerolls_per_player" integer DEFAULT 3 NOT NULL,
	"max_human_players" integer DEFAULT 8 NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournament_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"entry_type" "tournament_entry_type" NOT NULL,
	"display_name" text NOT NULL,
	"drafted_team_id" uuid,
	"national_team_id" uuid,
	"group_code" text,
	"seed_position" integer,
	"computed_attack" integer NOT NULL,
	"computed_midfield" integer NOT NULL,
	"computed_defense" integer NOT NULL,
	"computed_goalkeeping" integer NOT NULL,
	"computed_ovr" integer NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid,
	"type" "tournament_type" NOT NULL,
	"status" "tournament_status" DEFAULT 'PENDING' NOT NULL,
	"current_round" "match_round",
	"champion_entry_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nickname" text NOT NULL,
	"session_token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "drafted_team_players" ADD CONSTRAINT "drafted_team_players_drafted_team_id_drafted_teams_id_fk" FOREIGN KEY ("drafted_team_id") REFERENCES "public"."drafted_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafted_team_players" ADD CONSTRAINT "drafted_team_players_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafted_team_players" ADD CONSTRAINT "drafted_team_players_source_national_team_id_national_teams_id_fk" FOREIGN KEY ("source_national_team_id") REFERENCES "public"."national_teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafted_teams" ADD CONSTRAINT "drafted_teams_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafted_teams" ADD CONSTRAINT "drafted_teams_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafted_teams" ADD CONSTRAINT "drafted_teams_formation_id_formations_id_fk" FOREIGN KEY ("formation_id") REFERENCES "public"."formations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_standings" ADD CONSTRAINT "group_standings_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_standings" ADD CONSTRAINT "group_standings_entry_id_tournament_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."tournament_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_home_entry_id_tournament_entries_id_fk" FOREIGN KEY ("home_entry_id") REFERENCES "public"."tournament_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_away_entry_id_tournament_entries_id_fk" FOREIGN KEY ("away_entry_id") REFERENCES "public"."tournament_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_entry_id_tournament_entries_id_fk" FOREIGN KEY ("winner_entry_id") REFERENCES "public"."tournament_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_national_team_id_national_teams_id_fk" FOREIGN KEY ("national_team_id") REFERENCES "public"."national_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_participants" ADD CONSTRAINT "room_participants_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_participants" ADD CONSTRAINT "room_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_host_user_id_users_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_entries" ADD CONSTRAINT "tournament_entries_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_entries" ADD CONSTRAINT "tournament_entries_drafted_team_id_drafted_teams_id_fk" FOREIGN KEY ("drafted_team_id") REFERENCES "public"."drafted_teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_entries" ADD CONSTRAINT "tournament_entries_national_team_id_national_teams_id_fk" FOREIGN KEY ("national_team_id") REFERENCES "public"."national_teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "drafted_team_players_team_slot_idx" ON "drafted_team_players" USING btree ("drafted_team_id","slot_code");--> statement-breakpoint
CREATE UNIQUE INDEX "drafted_team_players_team_player_idx" ON "drafted_team_players" USING btree ("drafted_team_id","player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "formations_code_idx" ON "formations" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "national_teams_slug_idx" ON "national_teams" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "national_teams_code_idx" ON "national_teams" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "players_team_slug_idx" ON "players" USING btree ("national_team_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "room_participants_room_user_idx" ON "room_participants" USING btree ("room_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rooms_code_idx" ON "rooms" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "users_session_token_idx" ON "users" USING btree ("session_token");