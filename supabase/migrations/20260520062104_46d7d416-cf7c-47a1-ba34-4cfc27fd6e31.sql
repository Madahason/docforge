
-- thumbnails
create table if not exists public.thumbnails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  project_id uuid not null,
  concepts jsonb not null default '[]'::jsonb,
  selected_concept_index integer,
  custom_title_copy text,
  status text not null default 'generated',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id)
);
alter table public.thumbnails enable row level security;
create policy "thumbnails_select_own" on public.thumbnails for select using (auth.uid() = user_id);
create policy "thumbnails_insert_own" on public.thumbnails for insert with check (auth.uid() = user_id);
create policy "thumbnails_update_own" on public.thumbnails for update using (auth.uid() = user_id);
create policy "thumbnails_delete_own" on public.thumbnails for delete using (auth.uid() = user_id);
create trigger tg_thumbnails_updated_at before update on public.thumbnails
  for each row execute function public.tg_set_updated_at();

-- video_metadata
create table if not exists public.video_metadata (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  project_id uuid not null,
  titles jsonb not null default '[]'::jsonb,
  selected_title text,
  description text,
  tags jsonb not null default '[]'::jsonb,
  chapters jsonb not null default '[]'::jsonb,
  hashtags jsonb not null default '[]'::jsonb,
  platform_variations jsonb not null default '{}'::jsonb,
  status text not null default 'generated',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id)
);
alter table public.video_metadata enable row level security;
create policy "video_metadata_select_own" on public.video_metadata for select using (auth.uid() = user_id);
create policy "video_metadata_insert_own" on public.video_metadata for insert with check (auth.uid() = user_id);
create policy "video_metadata_update_own" on public.video_metadata for update using (auth.uid() = user_id);
create policy "video_metadata_delete_own" on public.video_metadata for delete using (auth.uid() = user_id);
create trigger tg_video_metadata_updated_at before update on public.video_metadata
  for each row execute function public.tg_set_updated_at();
