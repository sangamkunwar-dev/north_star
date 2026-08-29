-- Run this in the Supabase SQL editor.
-- It creates the table expected by Northstar Social and secures rows per signed-in user.

create extension if not exists pgcrypto;

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  caption text not null,
  hashtags text not null default '',
  call_to_action text not null default '',
  platforms text[] not null default '{}',
  status text not null default 'published' check (status in ('draft', 'scheduled', 'published')),
  scheduled_for timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.social_posts enable row level security;

drop policy if exists "social_posts_select_own" on public.social_posts;
drop policy if exists "social_posts_insert_own" on public.social_posts;
drop policy if exists "social_posts_update_own" on public.social_posts;
drop policy if exists "social_posts_delete_own" on public.social_posts;

create policy "social_posts_select_own" on public.social_posts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "social_posts_insert_own" on public.social_posts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "social_posts_update_own" on public.social_posts
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "social_posts_delete_own" on public.social_posts
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.social_posts to authenticated;

create index if not exists social_posts_user_created_idx
  on public.social_posts (user_id, created_at desc);

-- Required for Facebook/Instagram publishing.
create table if not exists public.social_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('facebook', 'instagram')),
  account_name text not null default '',
  account_handle text not null,
  access_token text not null,
  connected boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.social_connections add column if not exists access_token text;
alter table public.social_connections enable row level security;
drop policy if exists "social_connections_own" on public.social_connections;
create policy "social_connections_own" on public.social_connections for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.social_connections to authenticated;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'Support' check (type in ('Support','Complaint','Feature request','Other')),
  subject text not null,
  message text not null,
  status text not null default 'pending' check (status in ('pending','in_progress','resolved','closed')),
  created_at timestamptz not null default now()
);
alter table public.support_tickets enable row level security;
alter table public.support_tickets drop constraint if exists support_tickets_status_check;
alter table public.support_tickets add constraint support_tickets_status_check check (status in ('pending','in_progress','resolved','closed'));
drop policy if exists "support_tickets_own" on public.support_tickets;
drop policy if exists "support_tickets_admin" on public.support_tickets;
create policy "support_tickets_own" on public.support_tickets for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "support_tickets_admin" on public.support_tickets for all to authenticated using ((select auth.jwt() ->> 'email') = 'sangamkunwar48@gmail.com') with check ((select auth.jwt() ->> 'email') = 'sangamkunwar48@gmail.com');
grant select, insert, update on public.support_tickets to authenticated;

-- If support_tickets already existed before this script, run this migration too.
-- Drop the old constraint first; it may reject the new pending default.
alter table public.support_tickets drop constraint if exists support_tickets_status_check;
alter table public.support_tickets add column if not exists type text not null default 'Support';
alter table public.support_tickets add column if not exists message text not null default '';
alter table public.support_tickets add column if not exists status text not null default 'pending';
alter table public.support_tickets add column if not exists created_at timestamptz not null default now();
update public.support_tickets set status = 'pending' where status is null or status = 'open';
alter table public.support_tickets add constraint support_tickets_status_check check (status in ('pending','in_progress','resolved','closed'));

-- Optional: verify the table definition after running this script.
select column_name, is_nullable, column_default, is_identity
from information_schema.columns
where table_schema = 'public' and table_name = 'social_posts'
order by ordinal_position;
