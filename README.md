# Loooply — pacote de recuperação

Este pacote contém o aplicativo estático existente, correções de configuração do Supabase, sincronização Realtime de comentários musicais, esquema SQL alinhado ao ambiente atual, testes e utilitário para restaurar mídias que foram intencionalmente omitidas do ZIP.

## Começar

1. Extraia o ZIP.
2. Abra `CONFIGURAR-NUVEM-LOOOPLY.md` para os requisitos de autenticação e hospedagem.
3. Em um ambiente com Python 3 e acesso à internet, execute `python scripts/restaurar-midias-github.py --dry-run` para conferir os arquivos que faltam e, em seguida, `python scripts/restaurar-midias-github.py` para baixá-los do repositório público `soumoiss/Loooply`.
4. Sirva a pasta por HTTP/HTTPS (não por `file://`) e abra `index.html`. A autenticação Supabase depende de rede e da configuração pública já presente no módulo de nuvem.

## Testes locais

```bash
node scripts/test-static.mjs --source-only
node tests/test-cloud-config.mjs
python scripts/restaurar-midias-github.py --dry-run
python scripts/smoke_test.py
```

O teste estático completo (`node scripts/test-static.mjs`) também verifica a presença física das mídias; ele continuará falhando até que o utilitário de restauração recupere os arquivos ausentes. O teste Playwright exige Chromium funcional e pode ser bloqueado por políticas do ambiente.

## Estado da nuvem

O projeto Supabase `Loooply` está ativo. O perfil `Peixinho` existe com papel `admin` e identidade Auth confirmada. A validação local da configuração tinha um defeito que desabilitava a nuvem mesmo com URL e chave públicas válidas; isso foi corrigido. A publicação `supabase_realtime` agora inclui `public.music_comments`, e a migração correspondente está em `supabase/migrations/`.

A senha inicial solicitada não foi redefinida por este pacote: as ferramentas disponíveis permitem consultar e migrar o banco, mas não oferecem o endpoint administrativo de Auth necessário para alterar a senha com segurança. Não há senha administrativa embutida no frontend ou no ZIP. Defina-a no Supabase Auth usando o procedimento administrativo autorizado antes de considerar o login aprovado.

## Limitações conhecidas

- O ZIP não inclui 248 arquivos binários de mídia omitidos para reduzir seu tamanho; os caminhos e registros do índice foram preservados. O utilitário de restauração os recupera do GitHub em ambiente com acesso à internet.
- Os quatro usuários legados continuam autenticando pelo mecanismo local existente. Como o banco atual só contém a identidade Auth de Peixinho, a migração dos demais usuários para autenticação na nuvem requer provisionamento seguro e redefinição/validação de credenciais; não foram criadas senhas nem contas fictícias.
- O código atual não contém uma implementação de chat entre usuários; esse recurso não foi inventado ou apresentado como corrigido.
- Não foi possível concluir testes de navegador nem uma troca real de comentários entre duas sessões nesta execução. Veja `RELATORIO.md` para a classificação detalhada.
