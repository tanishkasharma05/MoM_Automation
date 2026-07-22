-- Phase 4 — Enterprise foundation: workspaces, per-user roles, audit log.
-- Run this in the Supabase SQL editor (or via `base44`/supabase CLI migration).

-- 1. Workspaces (multi-workspace support)
create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- 2. Profiles — one row per auth user, holding role + workspace membership.
--    Client-side RBAC checks read this table (auth.users itself can't be
--    queried directly from the browser).
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  workspace_id uuid references workspaces(id),
  role text not null default 'member' check (role in ('member', 'admin', 'owner')),
  created_at timestamptz not null default now()
);

-- Auto-create a profile row (default role 'member') whenever a new
-- auth user signs up, and give them their own workspace as the owner.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  new_workspace_id uuid;
begin
  insert into workspaces (name, created_by) values (coalesce(new.raw_user_meta_data->>'full_name', new.email) || '''s workspace', new.id)
    returning id into new_workspace_id;

  insert into profiles (id, workspace_id, role) values (new.id, new_workspace_id, 'owner');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. Audit log — append-only record of sensitive actions (role changes,
--    member removal, meeting deletion, etc). Never updated, only inserted.
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id),
  actor_id uuid references auth.users(id),
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- RLS
alter table profiles enable row level security;
alter table workspaces enable row level security;
alter table audit_logs enable row level security;

create policy "Users can read their own profile" on profiles
  for select using (auth.uid() = id);

create policy "Users can read profiles in their workspace" on profiles
  for select using (
    workspace_id in (select workspace_id from profiles where id = auth.uid())
  );

create policy "Admins/owners can update roles in their workspace" on profiles
  for update using (
    workspace_id in (
      select workspace_id from profiles where id = auth.uid() and role in ('admin', 'owner')
    )
  );

create policy "Users can read their own workspace" on workspaces
  for select using (
    id in (select workspace_id from profiles where id = auth.uid())
  );

create policy "Users can read audit logs in their workspace" on audit_logs
  for select using (
    workspace_id in (select workspace_id from profiles where id = auth.uid())
  );

create policy "Any authenticated user can insert audit logs" on audit_logs
  for insert with check (auth.uid() = actor_id);
