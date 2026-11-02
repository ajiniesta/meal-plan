-- Mesa · planificador semanal
-- Ejecuta este script en el SQL Editor de tu proyecto de Supabase.
-- Es idempotente: puedes volver a ejecutarlo para actualizar políticas y funciones.

create extension if not exists "pgcrypto";

-- ── Planificaciones semanales ─────────────────────────────────────────────

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

grant select, insert, update, delete on public.weekly_plans to authenticated;

drop policy if exists "Cada persona lee sus semanas" on public.weekly_plans;
drop policy if exists "Cada persona lee sus semanas y las compartidas" on public.weekly_plans;
drop policy if exists "Cada persona crea sus semanas" on public.weekly_plans;
drop policy if exists "Cada persona crea sus semanas y las compartidas" on public.weekly_plans;
drop policy if exists "Cada persona actualiza sus semanas" on public.weekly_plans;
drop policy if exists "Cada persona actualiza sus semanas y las compartidas" on public.weekly_plans;
drop policy if exists "Cada persona borra sus semanas" on public.weekly_plans;

-- ── Planificaciones compartidas ───────────────────────────────────────────

create table if not exists public.plan_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  viewer_id uuid not null references auth.users (id) on delete cascade,
  owner_email text not null,
  viewer_email text not null,
  created_at timestamptz not null default now(),
  constraint plan_shares_unique unique (owner_id, viewer_id),
  constraint plan_shares_not_self check (owner_id <> viewer_id)
);

create index if not exists plan_shares_viewer_idx
  on public.plan_shares (viewer_id);

alter table public.plan_shares enable row level security;

grant select, delete on public.plan_shares to authenticated;

drop policy if exists "Cada persona ve sus comparticiones" on public.plan_shares;
create policy "Cada persona ve sus comparticiones"
  on public.plan_shares
  for select
  using (auth.uid() = owner_id or auth.uid() = viewer_id);

drop policy if exists "Quien comparte puede retirar el acceso" on public.plan_shares;
create policy "Quien comparte puede retirar el acceso"
  on public.plan_shares
  for delete
  using (auth.uid() = owner_id or auth.uid() = viewer_id);

-- Una persona ve sus semanas y también las que le han compartido. Quien
-- recibe el acceso es colaborador: puede leer y editar, pero no borrar la
-- semana ni cambiar de dueño.
create policy "Cada persona lee sus semanas y las compartidas"
  on public.weekly_plans
  for select
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.plan_shares as shared
      where shared.owner_id = weekly_plans.user_id
        and shared.viewer_id = auth.uid()
    )
  );

create policy "Cada persona crea sus semanas y las compartidas"
  on public.weekly_plans
  for insert
  with check (
    auth.uid() = user_id
    or exists (
      select 1
      from public.plan_shares as shared
      where shared.owner_id = weekly_plans.user_id
        and shared.viewer_id = auth.uid()
    )
  );

create policy "Cada persona actualiza sus semanas y las compartidas"
  on public.weekly_plans
  for update
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.plan_shares as shared
      where shared.owner_id = weekly_plans.user_id
        and shared.viewer_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    or exists (
      select 1
      from public.plan_shares as shared
      where shared.owner_id = weekly_plans.user_id
        and shared.viewer_id = auth.uid()
    )
  );

create policy "Cada persona borra sus semanas"
  on public.weekly_plans
  for delete
  using (auth.uid() = user_id);

-- Un colaborador nunca puede quedarse una semana cambiando su dueño.
create or replace function public.protect_plan_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.user_id <> old.user_id then
    raise exception 'PLAN_OWNER_IMMUTABLE';
  end if;
  return new;
end;
$$;

drop trigger if exists weekly_plans_protect_owner on public.weekly_plans;
create trigger weekly_plans_protect_owner
  before update on public.weekly_plans
  for each row
  execute function public.protect_plan_owner();

-- Comparte todas las semanas de una persona, con permiso de edición, con la
-- cuenta indicada por correo. Se resuelve el correo en auth.users sin exponer
-- la lista de cuentas al cliente.
create or replace function public.share_plan_with_email(target_email text)
returns public.plan_shares
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(target_email));
  owner uuid := auth.uid();
  owner_email text;
  viewer uuid;
  viewer_email text;
  result public.plan_shares;
begin
  if owner is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if normalized_email is null or normalized_email = '' then
    raise exception 'EMAIL_REQUIRED';
  end if;

  select email into owner_email
  from auth.users
  where id = owner;

  select id, lower(email) into viewer, viewer_email
  from auth.users
  where lower(email) = normalized_email
  limit 1;

  if viewer is null then
    raise exception 'USER_NOT_FOUND';
  end if;

  if viewer = owner then
    raise exception 'CANNOT_SHARE_WITH_SELF';
  end if;

  insert into public.plan_shares (
    owner_id,
    viewer_id,
    owner_email,
    viewer_email
  )
  values (
    owner,
    viewer,
    coalesce(owner_email, ''),
    viewer_email
  )
  on conflict (owner_id, viewer_id) do update
    set owner_email = excluded.owner_email,
        viewer_email = excluded.viewer_email
  returning * into result;

  return result;
end;
$$;

revoke all on function public.share_plan_with_email(text) from public;
grant execute on function public.share_plan_with_email(text) to authenticated;

-- ── Recetario global ──────────────────────────────────────────────────────

-- Una única fila compartida por todas las cuentas. Las recetas propias, las
-- ediciones de recetas base y las recetas retiradas son comunes.
create table if not exists public.recipe_catalog (
  id text primary key default 'global' check (id = 'global'),
  data jsonb not null default '{"custom":[],"overrides":{},"hiddenIds":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.recipe_catalog (id)
values ('global')
on conflict (id) do nothing;

alter table public.recipe_catalog enable row level security;

grant select, insert, update, delete on public.recipe_catalog to authenticated;

drop policy if exists "El recetario es común" on public.recipe_catalog;
create policy "El recetario es común"
  on public.recipe_catalog
  for select
  to authenticated
  using (true);

drop policy if exists "Las cuentas crean el recetario común" on public.recipe_catalog;
create policy "Las cuentas crean el recetario común"
  on public.recipe_catalog
  for insert
  to authenticated
  with check (true);

drop policy if exists "Las cuentas actualizan el recetario común" on public.recipe_catalog;
create policy "Las cuentas actualizan el recetario común"
  on public.recipe_catalog
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Las cuentas borran del recetario común" on public.recipe_catalog;
create policy "Las cuentas borran del recetario común"
  on public.recipe_catalog
  for delete
  to authenticated
  using (true);

-- Migración desde la versión anterior: si existía un recetario por usuario,
-- se usa el más reciente como semilla del recetario global (solo si el global
-- sigue vacío). Después se retira la tabla personal.
do $$
declare
  source jsonb;
begin
  if to_regclass('public.recipe_books') is null then
    return;
  end if;

  select data into source
  from public.recipe_books
  order by updated_at desc
  limit 1;

  if source is not null then
    update public.recipe_catalog
    set data = source,
        updated_at = now()
    where id = 'global'
      and data = '{"custom":[],"overrides":{},"hiddenIds":[]}'::jsonb;
  end if;
end;
$$;

drop table if exists public.recipe_books;

-- ── Mantiene updated_at al día ────────────────────────────────────────────

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

drop trigger if exists recipe_catalog_touch_updated_at on public.recipe_catalog;
create trigger recipe_catalog_touch_updated_at
  before update on public.recipe_catalog
  for each row
  execute function public.touch_updated_at();
