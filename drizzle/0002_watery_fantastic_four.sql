ALTER TABLE "room_participants" ADD COLUMN "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "reveal_stage_index" integer DEFAULT -1 NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "reveal_updated_at" timestamp with time zone;