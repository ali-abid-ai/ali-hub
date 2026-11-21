-- ALI HUB database setup. Run this entire file in Supabase SQL Editor.
create table if not exists public.records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  section text not null check (section in ('books','knowledge','quizzes','assignments','websites','repositories','documents','projects','tasks','events')),
  title text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists records_user_section_created_idx on public.records(user_id, section, created_at desc);

-- Keep updated_at accurate whenever a record is edited.
create or replace function public.set_ali_hub_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists set_ali_hub_records_updated_at on public.records;
create trigger set_ali_hub_records_updated_at
before update on public.records
for each row execute function public.set_ali_hub_updated_at();
alter table public.records enable row level security;
drop policy if exists "Users can view their own records" on public.records;
create policy "Users can view their own records" on public.records for select using (auth.uid() = user_id);
drop policy if exists "Users can insert their own records" on public.records;
create policy "Users can insert their own records" on public.records for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update their own records" on public.records;
create policy "Users can update their own records" on public.records for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete their own records" on public.records;
create policy "Users can delete their own records" on public.records for delete using (auth.uid() = user_id);

-- Private document bucket. File paths must begin with the authenticated user's UUID.
insert into storage.buckets (id, name, public, file_size_limit)
values ('ali-hub-documents', 'ali-hub-documents', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;
drop policy if exists "Users can read own ALI HUB files" on storage.objects;
create policy "Users can read own ALI HUB files" on storage.objects for select to authenticated using (bucket_id = 'ali-hub-documents' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users can upload own ALI HUB files" on storage.objects;
create policy "Users can upload own ALI HUB files" on storage.objects for insert to authenticated with check (bucket_id = 'ali-hub-documents' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users can update own ALI HUB files" on storage.objects;
create policy "Users can update own ALI HUB files" on storage.objects for update to authenticated using (bucket_id = 'ali-hub-documents' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'ali-hub-documents' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users can delete own ALI HUB files" on storage.objects;
create policy "Users can delete own ALI HUB files" on storage.objects for delete to authenticated using (bucket_id = 'ali-hub-documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- Explicit table privileges for authenticated workspace users.
grant select, insert, update, delete on table public.records to authenticated;
