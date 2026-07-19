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
 *   has_seen_vignettes_mode boolean not null default false,
 *   keyword text,
 *   updated_at timestamptz not null default now()
 * );
 *
 * -- Existing databases: add columns once.
 * -- alter table public.players
 * --   add column if not exists has_seen_vignettes_mode boolean not null default false;
 * -- alter table public.players
 * --   add column if not exists keyword text;
 *
 * -- Case-insensitive uniqueness: Pipow and pipow cannot both exist.
 * create unique index if not exists players_username_lower_idx
 *   on public.players (lower(username));
 *
 * alter table public.players enable row level security;
 */
