create table if not exists public.game_state (
  room_id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.game_state enable row level security;

-- Public read/write policy for quick family prototype.
-- For production, tighten this with auth and per-user rules.
drop policy if exists "game_state_public_rw" on public.game_state;
create policy "game_state_public_rw"
  on public.game_state
  for all
  to anon
  using (true)
  with check (true);
