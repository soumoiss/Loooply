-- Publica comentários musicais para sincronização em tempo real via Supabase Realtime.
-- Idempotente: não adiciona a tabela novamente se ela já estiver publicada.
do $publication$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'music_comments') then
    alter publication supabase_realtime add table public.music_comments;
  end if;
end;
$publication$;
