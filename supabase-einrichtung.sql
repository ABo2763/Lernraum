-- Im Supabase SQL Editor ausführen, nachdem das Projekt erstellt wurde.
-- Jede angemeldete Person darf nur ihre eigenen Lernraum-Daten lesen/schreiben.
create table if not exists public.lernraum_sync (
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 kind text not null check (kind in ('cards','plan')),
 revision uuid not null,
 payload jsonb not null,
 updated_at timestamptz not null default now(),
 primary key (user_id,kind)
);
alter table public.lernraum_sync enable row level security;
create policy "Lernraum eigene Daten lesen" on public.lernraum_sync for select to authenticated using ((select auth.uid())=user_id);
create policy "Lernraum eigene Daten anlegen" on public.lernraum_sync for insert to authenticated with check ((select auth.uid())=user_id);
create policy "Lernraum eigene Daten ändern" on public.lernraum_sync for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
-- Kein öffentliches Lesen und keine Freigabe an andere Nutzer.
