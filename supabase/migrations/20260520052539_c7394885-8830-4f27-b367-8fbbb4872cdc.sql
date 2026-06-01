
create table if not exists public.manifests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  project_id uuid not null,
  version integer not null default 1,
  status text not null default 'draft',
  manifest_data jsonb not null,
  total_scenes integer,
  total_duration_seconds numeric,
  real_footage_seconds numeric,
  motion_graphic_scenes integer,
  ai_image_scenes integer,
  stock_scenes integer,
  youtube_scenes integer,
  hera_scenes integer,
  caption_scenes integer,
  graphic_scenes integer,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists manifests_project_idx on public.manifests(project_id, version desc);
create index if not exists manifests_user_idx on public.manifests(user_id);

alter table public.manifests enable row level security;

create policy manifests_select_own on public.manifests
  for select using (auth.uid() = user_id);
create policy manifests_insert_own on public.manifests
  for insert with check (auth.uid() = user_id);
create policy manifests_update_own on public.manifests
  for update using (auth.uid() = user_id);
create policy manifests_delete_own on public.manifests
  for delete using (auth.uid() = user_id);

create trigger manifests_set_updated_at
before update on public.manifests
for each row execute function public.tg_set_updated_at();
