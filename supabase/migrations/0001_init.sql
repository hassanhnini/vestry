-- Vestry schema: private, per-user wardrobe data protected by row-level security.
-- Apply with the Supabase CLI (`supabase db push`) or paste into the SQL editor.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users). style_profile holds onboarding preferences.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  style_profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Clothing items
-- ---------------------------------------------------------------------------
create table if not exists public.clothing_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  category text not null check (category in (
    't-shirt','tank-top','shirt','blouse','knitwear','cardigan','sweatshirt',
    'jeans','trousers','wide-leg-trousers','skirt','shorts','leggings',
    'dress','jumpsuit','blazer','jacket','leather-jacket','coat','trench',
    'sneakers','heels','flats','loafers','boots','sandals',
    'handbag','tote','crossbody','clutch','backpack',
    'belt','scarf','jewelry','hat','sunglasses','other')),
  colors text[] not null default '{}' check (cardinality(colors) <= 6),
  color_hex text[] not null default '{}' check (cardinality(color_hex) <= 6),
  pattern text not null default 'solid' check (pattern in (
    'solid','striped','checked','floral','polka-dot','animal','graphic','abstract','denim','textured')),
  material text check (char_length(material) <= 60),
  fit text check (fit in ('fitted','regular','relaxed','oversized')),
  styles text[] not null default '{}',
  seasons text[] not null default '{}',
  occasions text[] not null default '{}',
  formality smallint not null default 2 check (formality between 1 and 5),
  brand text check (char_length(brand) <= 80),
  notes text check (char_length(notes) <= 1000),
  favorite boolean not null default false,
  archived boolean not null default false,
  image_original text not null,
  image_cutout text,
  image_hash text,
  ai jsonb not null default '{}'::jsonb,
  wear_count integer not null default 0 check (wear_count >= 0),
  last_worn_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists clothing_items_user_created_idx on public.clothing_items (user_id, created_at desc);
create index if not exists clothing_items_user_category_idx on public.clothing_items (user_id, category);
create index if not exists clothing_items_user_hash_idx on public.clothing_items (user_id, image_hash);

-- ---------------------------------------------------------------------------
-- Outfits and their items (many-to-many)
-- ---------------------------------------------------------------------------
create table if not exists public.outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  style text,
  occasion text,
  explanation text not null default '' check (char_length(explanation) <= 2000),
  notes text check (char_length(notes) <= 1000),
  favorite boolean not null default false,
  source text not null default 'manual' check (source in ('rules','claude','gemini','manual')),
  wear_count integer not null default 0 check (wear_count >= 0),
  last_worn_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists outfits_user_created_idx on public.outfits (user_id, created_at desc);

create table if not exists public.outfit_items (
  outfit_id uuid not null references public.outfits (id) on delete cascade,
  item_id uuid not null references public.clothing_items (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  position smallint not null default 0,
  primary key (outfit_id, item_id)
);
create index if not exists outfit_items_item_idx on public.outfit_items (item_id);
create index if not exists outfit_items_user_idx on public.outfit_items (user_id);

-- ---------------------------------------------------------------------------
-- Planner and wear history
-- ---------------------------------------------------------------------------
create table if not exists public.planner_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  outfit_id uuid not null references public.outfits (id) on delete cascade,
  event text check (char_length(event) <= 120),
  worn boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists planner_entries_user_date_idx on public.planner_entries (user_id, date);

create table if not exists public.wear_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  outfit_id uuid references public.outfits (id) on delete set null,
  item_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists wear_logs_user_date_idx on public.wear_logs (user_id, date desc);

-- updated_at triggers
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists clothing_items_updated_at on public.clothing_items;
create trigger clothing_items_updated_at before update on public.clothing_items for each row execute function public.set_updated_at();
drop trigger if exists outfits_updated_at on public.outfits;
create trigger outfits_updated_at before update on public.outfits for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security: users can only ever see and change their own rows.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.clothing_items enable row level security;
alter table public.outfits enable row level security;
alter table public.outfit_items enable row level security;
alter table public.planner_entries enable row level security;
alter table public.wear_logs enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "own items" on public.clothing_items;
create policy "own items" on public.clothing_items for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own outfits" on public.outfits;
create policy "own outfits" on public.outfits for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own outfit items" on public.outfit_items;
create policy "own outfit items" on public.outfit_items for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.outfits o where o.id = outfit_id and o.user_id = auth.uid())
    and exists (select 1 from public.clothing_items c where c.id = item_id and c.user_id = auth.uid())
  );

drop policy if exists "own planner" on public.planner_entries;
create policy "own planner" on public.planner_entries for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.outfits o where o.id = outfit_id and o.user_id = auth.uid())
  );

drop policy if exists "own wear logs" on public.wear_logs;
create policy "own wear logs" on public.wear_logs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Private storage bucket. Objects live under "<user id>/..." and are only reachable
-- by their owner (the app displays them through short-lived signed URLs).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wardrobe', 'wardrobe', false, 15728640, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false;

drop policy if exists "wardrobe owner read" on storage.objects;
create policy "wardrobe owner read" on storage.objects for select to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "wardrobe owner insert" on storage.objects;
create policy "wardrobe owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "wardrobe owner update" on storage.objects;
create policy "wardrobe owner update" on storage.objects for update to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "wardrobe owner delete" on storage.objects;
create policy "wardrobe owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);
