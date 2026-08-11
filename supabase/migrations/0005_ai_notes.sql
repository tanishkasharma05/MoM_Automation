-- Phase 5 — AI Notes: quick voice-to-text notes with AI-extracted highlights,
-- separate from full Minutes-of-Meeting. Lets a user record or upload a short
-- voice memo and get back a transcript plus the important points/action
-- items/questions the AI picked out of it.

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled Note',
  source text not null default 'voice' check (source in ('voice', 'upload', 'text')),
  audio_url text,
  transcript text,
  duration_seconds integer default 0,
  summary text,
  highlights jsonb not null default '[]'::jsonb, -- [{ type: 'important'|'action'|'decision'|'question'|'idea', text }]
  tags text[] default '{}',
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_user_id_idx on notes (user_id, created_at desc);

alter table notes enable row level security;

create policy "Users can read their own notes" on notes
  for select using (auth.uid() = user_id);

create policy "Users can insert their own notes" on notes
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own notes" on notes
  for update using (auth.uid() = user_id);

create policy "Users can delete their own notes" on notes
  for delete using (auth.uid() = user_id);

-- Keep updated_at current on every edit.
create or replace function public.set_notes_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists notes_set_updated_at on notes;
create trigger notes_set_updated_at
  before update on notes
  for each row execute function public.set_notes_updated_at();
