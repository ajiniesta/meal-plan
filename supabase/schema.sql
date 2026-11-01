-- Mesa · planificador semanal
-- Ejecuta este script en el SQL Editor de tu proyecto de Supabase.

create extension if not exists "pgcrypto";

create table if not exists public.weekly_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  season_mode text not null default 'auto'
    check (season_mode in ('auto', 'verano', 'invierno')),
  meals jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weekly_plans_user_week_unique unique (user_id, week_start)
);

create index if not exists weekly_plans_user_week_idx
  on public.weekly_plans (user_id, week_start desc);

alter table public.weekly_plans enable row level security;

-- Los usuarios anónimos de Supabase usan el rol authenticated.
grant select, insert, update, delete on public.weekly_plans to authenticated;

drop policy if exists "Cada persona lee sus semanas" on public.weekly_plans;
create policy "Cada persona lee sus semanas"
  on public.weekly_plans
  for select
  using (auth.uid() = user_id);

drop policy if exists "Cada persona crea sus semanas" on public.weekly_plans;
create policy "Cada persona crea sus semanas"
  on public.weekly_plans
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Cada persona actualiza sus semanas" on public.weekly_plans;
create policy "Cada persona actualiza sus semanas"
  on public.weekly_plans
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Cada persona borra sus semanas" on public.weekly_plans;
create policy "Cada persona borra sus semanas"
  on public.weekly_plans
  for delete
  using (auth.uid() = user_id);

-- Mantiene updated_at al día si se modifica una fila desde el panel de Supabase.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists weekly_plans_touch_updated_at on public.weekly_plans;
create trigger weekly_plans_touch_updated_at
  before update on public.weekly_plans
  for each row
  execute function public.touch_updated_at();
