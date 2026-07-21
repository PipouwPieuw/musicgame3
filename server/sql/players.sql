/**

 * Expected schema for the `players` table (Supabase SQL editor).

 * RLS can stay enabled: the Express server uses the service_role key, which bypasses RLS.

 *

 * create table if not exists public.players (

 *   username text primary key,

 *   initials text not null,

 *   liked_tracks jsonb not null default '[]'::jsonb,

 *   games_played jsonb not null default '{}'::jsonb,

 *   good_answers jsonb not null default '{}'::jsonb,

 *   wrong_answers jsonb not null default '{}'::jsonb,

 *   scores jsonb not null default '[]'::jsonb,

 *   found_tracks_ids jsonb not null default '[]'::jsonb,

 *   seen_unlocks jsonb not null default '{}'::jsonb,

 *   has_seen_vignettes_mode boolean not null default false,

 *   keyword text,

 *   updated_at timestamptz not null default now()

 * );

 *

 * -- Existing databases: add columns once.

 * -- alter table public.players

 * --   add column if not exists has_seen_vignettes_mode boolean not null default false;

 * -- alter table public.players

 * --   add column if not exists seen_unlocks jsonb not null default '{}'::jsonb;

 * -- Backfill from legacy boolean (optional; also done at read time in store.js):

 * -- update public.players

 * --   set seen_unlocks = coalesce(seen_unlocks, '{}'::jsonb) || '{"vignettes": true}'::jsonb

 * --   where has_seen_vignettes_mode = true

 * --     and coalesce(seen_unlocks->>'vignettes', 'false') <> 'true';

 * -- alter table public.players

 * --   add column if not exists keyword text;

 *

 * -- alter table public.players

 * --   add column if not exists unlocked_achievements jsonb not null default '[]'::jsonb;

 *

 * -- alter table public.players

 * --   add column if not exists last_held_global_trophies jsonb not null default '[]'::jsonb;

 *

 * -- Case-insensitive uniqueness: Pipow and pipow cannot both exist.

 * create unique index if not exists players_username_lower_idx

 *   on public.players (lower(username));

 *

 * alter table public.players enable row level security;

 */

