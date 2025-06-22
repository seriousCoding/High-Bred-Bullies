
-- Create a user_notifications table to store notification events for users.

create table public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null,  -- e.g., 'litter', 'birthday', 'health_tip'
  title text not null,
  message text not null,
  is_read boolean not null default false,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Enable RLS for user_notifications
alter table public.user_notifications enable row level security;

-- Allow users to select only their own notifications
create policy "Users see their own notifications"
on public.user_notifications for select
    using (auth.uid() = user_id);

-- Allow users to insert their own notifications (optional, may want functions for admin/batch instead)
create policy "Users can insert their own notifications"
on public.user_notifications for insert
    with check (auth.uid() = user_id);

-- Allow users to update is_read status for their own notifications
create policy "Users can mark their notifications read"
on public.user_notifications for update
    using (auth.uid() = user_id);

-- Allow users to delete their notifications (optional)
create policy "Users can delete their notifications"
on public.user_notifications for delete
    using (auth.uid() = user_id);
