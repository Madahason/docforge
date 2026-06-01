
-- profiles table (replaces "users" - we use auth.users for identity)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  subscription_tier text not null default 'free',
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users update own profile" on public.profiles for update using (auth.uid() = id);

-- style_profiles
create table public.style_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  content_type text,
  editing_style text,
  visual_style text,
  color_temperature text,
  cut_density text,
  text_overlay_frequency text,
  music_profile text,
  clip_source_ratio text not null default 'youtube_first',
  youtube_source_priority jsonb not null default '[]'::jsonb,
  pacing_intensity integer not null default 5,
  music_intensity text not null default 'moderate',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.style_profiles enable row level security;

create policy "Users manage own style_profiles select" on public.style_profiles for select using (auth.uid() = user_id);
create policy "Users manage own style_profiles insert" on public.style_profiles for insert with check (auth.uid() = user_id);
create policy "Users manage own style_profiles update" on public.style_profiles for update using (auth.uid() = user_id);
create policy "Users manage own style_profiles delete" on public.style_profiles for delete using (auth.uid() = user_id);

-- projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  status text not null default 'draft',
  content_type text,
  target_duration text,
  platform_targets jsonb not null default '[]'::jsonb,
  script_raw text,
  script_parsed jsonb,
  style_profile_id uuid references public.style_profiles(id) on delete set null,
  opening_structure text,
  pacing_intensity integer,
  music_on boolean not null default true,
  music_intensity text,
  text_overlay_frequency text,
  clip_source text not null default 'youtube_first',
  completion_percent integer not null default 0,
  thumbnail_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;

create policy "Users manage own projects select" on public.projects for select using (auth.uid() = user_id);
create policy "Users manage own projects insert" on public.projects for insert with check (auth.uid() = user_id);
create policy "Users manage own projects update" on public.projects for update using (auth.uid() = user_id);
create policy "Users manage own projects delete" on public.projects for delete using (auth.uid() = user_id);

create index projects_user_idx on public.projects(user_id, updated_at desc);
create index style_profiles_user_idx on public.style_profiles(user_id);

-- updated_at trigger
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_updated before update on public.profiles for each row execute function public.tg_set_updated_at();
create trigger style_profiles_updated before update on public.style_profiles for each row execute function public.tg_set_updated_at();
create trigger projects_updated before update on public.projects for each row execute function public.tg_set_updated_at();

-- handle_new_user trigger - create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''))
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
