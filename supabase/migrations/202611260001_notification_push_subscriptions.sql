-- Push subscriptions only. No notification payloads or delivery history are stored.
create table if not exists public.notification_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_push_subscriptions enable row level security;

create policy "Users manage their own push subscriptions"
on public.notification_push_subscriptions
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists notification_push_subscriptions_user_id_idx
on public.notification_push_subscriptions(user_id);

comment on table public.notification_push_subscriptions is
'Web Push endpoints only. Do not store notification messages, payloads, or history here.';
