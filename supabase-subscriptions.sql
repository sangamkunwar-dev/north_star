-- Sajilo subscriptions, payments, usage, and admin controls
-- Paste this entire file into Supabase SQL Editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.subscription_plans (
  id text primary key,
  name text not null,
  monthly_price_npr integer not null check (monthly_price_npr >= 0),
  monthly_posts integer,
  ai_generations integer,
  destinations integer,
  media_per_post integer,
  features jsonb not null default '[]'::jsonb,
  active boolean not null default true
);

create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  plan_id text not null references public.subscription_plans(id),
  status text not null default 'active' check (status in ('trialing','active','past_due','cancelled','expired')),
  provider text check (provider in ('khalti','card','manual')),
  provider_reference text,
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscription_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null references public.subscription_plans(id),
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  review_note text,
  period_start timestamptz,
  period_end timestamptz
);

create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null references public.subscription_plans(id),
  provider text not null check (provider in ('khalti','card')),
  amount_npr integer not null check (amount_npr > 0),
  status text not null default 'pending' check (status in ('pending','verified','failed','refunded')),
  provider_reference text,
  checkout_url text,
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

create table if not exists public.usage_counters (
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  posts_created integer not null default 0,
  ai_generations integer not null default 0,
  primary key (user_id, period_start)
);

insert into public.subscription_plans (id,name,monthly_price_npr,monthly_posts,ai_generations,destinations,media_per_post,features) values
('free','Free',0,5,3,1,1,'["5 posts / month","3 AI generations","1 destination","Basic history"]'),
('creator','Creator',999,50,null,5,10,'["50 posts / month","Unlimited AI writing","5 destinations","Scheduling + analytics"]'),
('studio','Studio',2499,null,null,null,30,'["Unlimited posts","Unlimited AI writing","Unlimited destinations","Team workflows + priority support"]')
on conflict (id) do update set name=excluded.name, monthly_price_npr=excluded.monthly_price_npr, monthly_posts=excluded.monthly_posts, ai_generations=excluded.ai_generations, destinations=excluded.destinations, media_per_post=excluded.media_per_post, features=excluded.features;

alter table public.profiles enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.user_subscriptions enable row level security;
alter table public.payment_attempts enable row level security;
alter table public.subscription_requests enable row level security;

drop policy if exists "users read own subscription requests" on public.subscription_requests;
drop policy if exists "users create own subscription requests" on public.subscription_requests;
drop policy if exists "admins manage subscription requests" on public.subscription_requests;
create policy "users read own subscription requests" on public.subscription_requests for select to authenticated using ((select auth.uid()) = user_id);
create policy "users create own subscription requests" on public.subscription_requests for insert to authenticated with check ((select auth.uid()) = user_id and status = 'pending');
create policy "admins manage subscription requests" on public.subscription_requests for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
alter table public.usage_counters enable row level security;

-- Trusted admin authorization: raw_app_meta_data is server-controlled. Do not use raw_user_meta_data.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (u.raw_app_meta_data ->> 'is_admin')::boolean from auth.users u where u.id = (select auth.uid())), false)
    or coalesce((select u.email from auth.users u where u.id = (select auth.uid())), '') = 'sangamkunwar48@gmail.com';
$$;

-- Make this script safe to run more than once.
drop policy if exists "plans readable by everyone" on public.subscription_plans;
drop policy if exists "users read own profile" on public.profiles;
drop policy if exists "users read own subscription" on public.user_subscriptions;
drop policy if exists "users read own payments" on public.payment_attempts;
drop policy if exists "users read own usage" on public.usage_counters;
drop policy if exists "admins manage profiles" on public.profiles;
drop policy if exists "admins manage subscriptions" on public.user_subscriptions;
drop policy if exists "admins manage payments" on public.payment_attempts;

create policy "plans readable by everyone" on public.subscription_plans for select to anon, authenticated using (active = true);
create policy "users read own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "users read own subscription" on public.user_subscriptions for select to authenticated using ((select auth.uid()) = user_id);
create policy "users read own payments" on public.payment_attempts for select to authenticated using ((select auth.uid()) = user_id);
create policy "users read own usage" on public.usage_counters for select to authenticated using ((select auth.uid()) = user_id);
create policy "admins manage profiles" on public.profiles for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins manage subscriptions" on public.user_subscriptions for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins manage payments" on public.payment_attempts for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

grant execute on function public.is_admin() to authenticated;

-- Run this once after signing in, from a trusted server or Supabase SQL editor:
-- update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"is_admin": true}'::jsonb where email = 'sangamkunwar48@gmail.com';
-- Payment verification must be performed server-side with Khalti credentials or a hosted card provider. Never store raw card numbers.
