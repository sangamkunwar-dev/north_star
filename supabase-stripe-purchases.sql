-- Paste into Supabase SQL Editor after supabase-subscriptions.sql.
-- This creates a secure webhook-ready purchase ledger and makes admin reads possible.

create table if not exists public.stripe_purchases (
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text not null unique,
  stripe_customer_id text,
  stripe_subscription_id text,
  customer_email text,
  user_id uuid references auth.users(id) on delete set null,
  plan_id text not null references public.subscription_plans(id),
  amount_npr integer not null check (amount_npr > 0),
  status text not null default 'paid' check (status in ('paid','refunded','failed')),
  created_at timestamptz not null default now()
);

create index if not exists stripe_purchases_created_at_idx on public.stripe_purchases(created_at desc);
create index if not exists stripe_purchases_email_idx on public.stripe_purchases(lower(customer_email));
alter table public.stripe_purchases enable row level security;

drop policy if exists "admins read stripe purchases" on public.stripe_purchases;
create policy "admins read stripe purchases" on public.stripe_purchases for select to authenticated using ((select public.is_admin()));

create or replace function public.record_stripe_purchase(
  p_session_id text,
  p_customer_id text,
  p_subscription_id text,
  p_customer_email text,
  p_plan_id text,
  p_amount_npr integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.stripe_purchases (stripe_session_id, stripe_customer_id, stripe_subscription_id, customer_email, user_id, plan_id, amount_npr, status)
  select p_session_id, p_customer_id, p_subscription_id, p_customer_email, u.id, p_plan_id, p_amount_npr, 'paid'
  from auth.users u
  where lower(u.email) = lower(p_customer_email)
  on conflict (stripe_session_id) do update set status = 'paid', stripe_subscription_id = excluded.stripe_subscription_id;
end;
$$;

grant execute on function public.record_stripe_purchase(text, text, text, text, text, integer) to anon, authenticated;

-- Optional helper view for the admin panel.
create or replace view public.admin_purchase_summary as
select p.id, p.customer_email, p.plan_id, p.amount_npr, p.status, p.stripe_session_id, p.created_at
from public.stripe_purchases p;

-- Required manual configuration outside SQL:
-- 1. In Stripe, add a webhook endpoint: https://YOUR_DOMAIN/api/stripe/webhook
-- 2. Subscribe to checkout.session.completed and checkout.session.async_payment_succeeded.
-- 3. Add the endpoint signing secret as STRIPE_WEBHOOK_SECRET in Vercel/project Vars.
-- 4. The current webhook logs verified Stripe events; connect it to your server-side Supabase service-role worker before activating plans.
