-- Consolida políticas permissivas equivalentes sem ampliar privilégios.
-- Usuários só leem o próprio perfil; admins podem ler todos. Usuários só alteram
-- o próprio perfil mantendo role=user; admins podem atualizar perfis.
drop policy if exists "profile owner reads own" on public.profiles;
drop policy if exists "admin reads all profiles" on public.profiles;
drop policy if exists "profiles read own or admin" on public.profiles;
create policy "profiles read own or admin" on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select private.is_loooply_admin()));

drop policy if exists "user updates own non-admin profile" on public.profiles;
drop policy if exists "admin updates profiles" on public.profiles;
drop policy if exists "profiles update own or admin" on public.profiles;
create policy "profiles update own or admin" on public.profiles for update to authenticated
using ((id = (select auth.uid()) and role = 'user') or (select private.is_loooply_admin()))
with check ((id = (select auth.uid()) and role = 'user') or (select private.is_loooply_admin()));
