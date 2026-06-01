
create table public.scenes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null,
  scene_index integer not null,
  script_text text not null default '',
  emotional_temperature text,
  visual_job text,
  estimated_seconds integer default 0,
  captions_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, scene_index)
);

create table public.voiceovers (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.scenes(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null,
  status text not null default 'pending',
  audio_url text,
  duration_seconds integer,
  voice_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clips (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.scenes(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null,
  status text not null default 'pending',
  source_type text,
  source_url text,
  thumbnail_url text,
  duration_seconds integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.scenes enable row level security;
alter table public.voiceovers enable row level security;
alter table public.clips enable row level security;

create policy "scenes_select_own" on public.scenes for select using (auth.uid() = user_id);
create policy "scenes_insert_own" on public.scenes for insert with check (auth.uid() = user_id);
create policy "scenes_update_own" on public.scenes for update using (auth.uid() = user_id);
create policy "scenes_delete_own" on public.scenes for delete using (auth.uid() = user_id);

create policy "voiceovers_select_own" on public.voiceovers for select using (auth.uid() = user_id);
create policy "voiceovers_insert_own" on public.voiceovers for insert with check (auth.uid() = user_id);
create policy "voiceovers_update_own" on public.voiceovers for update using (auth.uid() = user_id);
create policy "voiceovers_delete_own" on public.voiceovers for delete using (auth.uid() = user_id);

create policy "clips_select_own" on public.clips for select using (auth.uid() = user_id);
create policy "clips_insert_own" on public.clips for insert with check (auth.uid() = user_id);
create policy "clips_update_own" on public.clips for update using (auth.uid() = user_id);
create policy "clips_delete_own" on public.clips for delete using (auth.uid() = user_id);

create trigger trg_scenes_updated before update on public.scenes
  for each row execute function public.tg_set_updated_at();
create trigger trg_voiceovers_updated before update on public.voiceovers
  for each row execute function public.tg_set_updated_at();
create trigger trg_clips_updated before update on public.clips
  for each row execute function public.tg_set_updated_at();

create index scenes_project_idx on public.scenes(project_id);
create index voiceovers_project_idx on public.voiceovers(project_id);
create index clips_project_idx on public.clips(project_id);
