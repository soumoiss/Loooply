-- Loooply: esquema idempotente de perfis, comentários e fotografias privadas.
create extension if not exists pgcrypto;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text not null unique,
 display_name text not null,
 profile_pic text,
 role text not null default 'user' check (role in ('user','admin')),
 created_at timestamptz not null default now()
);
create table if not exists public.music_comments (
 id uuid primary key default gen_random_uuid(),
 thread_key text not null,
 user_id uuid not null references auth.users(id) on delete cascade,
 author_name text not null,
 body text not null default '',
 attachments jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now(),
 constraint music_comment_has_content check (length(trim(body)) > 0 or jsonb_array_length(attachments) > 0)
);
create index if not exists music_comments_thread_created_idx on public.music_comments(thread_key,created_at);
create index if not exists music_comments_user_idx on public.music_comments(user_id);
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create or replace function private.is_loooply_admin()
returns boolean language sql stable security definer set search_path=''
as $fn$ select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'); $fn$;
revoke all on function private.is_loooply_admin() from public, anon;
grant execute on function private.is_loooply_admin() to authenticated;
create or replace function public.handle_new_loooply_user()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare base_username text; chosen_display_name text;
begin
 base_username := lower(coalesce(nullif(new.raw_user_meta_data->>'username',''),nullif(split_part(coalesce(new.email,''),'@',1),''),'usuario'));
 chosen_display_name := coalesce(nullif(new.raw_user_meta_data->>'display_name',''),nullif(new.raw_user_meta_data->>'username',''),nullif(split_part(coalesce(new.email,''),'@',1),''),'Usuário');
 insert into public.profiles(id,username,display_name,role)
 values(new.id,base_username,chosen_display_name,'user')
 on conflict(id) do update set username=excluded.username,display_name=excluded.display_name,role=public.profiles.role;
 return new;
end;
$fn$;
revoke all on function public.handle_new_loooply_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_loooply on auth.users;
create trigger on_auth_user_created_loooply after insert on auth.users for each row execute function public.handle_new_loooply_user();
alter table public.profiles enable row level security;
alter table public.music_comments enable row level security;
grant select,insert,update on public.profiles to authenticated;
grant select,insert,update,delete on public.music_comments to authenticated;
drop policy if exists "profile owner reads own" on public.profiles;
drop policy if exists "admin reads all profiles" on public.profiles;
drop policy if exists "profiles read own or admin" on public.profiles;
create policy "profiles read own or admin" on public.profiles for select to authenticated
using(id=(select auth.uid()) or (select private.is_loooply_admin()));
drop policy if exists "user creates own non-admin profile" on public.profiles;
create policy "user creates own non-admin profile" on public.profiles for insert to authenticated with check(id=(select auth.uid()) and role='user');
drop policy if exists "user updates own non-admin profile" on public.profiles;
drop policy if exists "admin updates profiles" on public.profiles;
drop policy if exists "profiles update own or admin" on public.profiles;
create policy "profiles update own or admin" on public.profiles for update to authenticated
using((id=(select auth.uid()) and role='user') or (select private.is_loooply_admin()))
with check((id=(select auth.uid()) and role='user') or (select private.is_loooply_admin()));
drop policy if exists "signed in users read music comments" on public.music_comments;
create policy "signed in users read music comments" on public.music_comments for select to authenticated using(true);
drop policy if exists "users publish as themselves" on public.music_comments;
create policy "users publish as themselves" on public.music_comments for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists "users update own music comments" on public.music_comments;
create policy "users update own music comments" on public.music_comments for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists "admins delete music comments" on public.music_comments;
create policy "admins delete music comments" on public.music_comments for delete to authenticated using((select private.is_loooply_admin()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('music-comment-photos','music-comment-photos',false,12582912,array['image/jpeg','image/png','image/webp','image/gif','image/avif'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "signed in users read music comment photos" on storage.objects;
create policy "signed in users read music comment photos" on storage.objects for select to authenticated using(bucket_id='music-comment-photos');
drop policy if exists "users upload own music comment photos" on storage.objects;
create policy "users upload own music comment photos" on storage.objects for insert to authenticated with check(bucket_id='music-comment-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "users delete own music comment photos" on storage.objects;
create policy "users delete own music comment photos" on storage.objects for delete to authenticated using(bucket_id='music-comment-photos' and ((storage.foldername(name))[1]=(select auth.uid())::text or (select private.is_loooply_admin())));
-- Do not grant admin privileges to a hard-coded UUID in a reusable schema script.
-- Promote the verified owner account separately after checking its Auth identity.

-- Enable live comment updates. Safe to rerun if the table is already published.
do $publication$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'music_comments') then
    alter publication supabase_realtime add table public.music_comments;
  end if;
end;
$publication$;
