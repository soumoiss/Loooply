# Looply — reconstrução modular

Projeto estático em HTML, CSS e JavaScript modular, preservando os contratos observados na base original.

## Contratos preservados

- `isLoggedIn`, `username` e `profilePic` continuam sendo usados para compatibilidade com a versão anterior.
- O estado de leitura continua em `moissworld_cartas_lidas_<encodeURIComponent(username)>`.
- As cartas continuam sendo procuradas como `${username}cartaN.txt`, com N de 1 a 50.
- O login mantém os quatro usuários existentes, mas passa a comparar SHA-256 no cliente em vez de manter as senhas em texto puro no HTML.
- As rotas `home.html`, `galeria.html` e `musicas.html` permanecem compatíveis com os alvos já referenciados na Home anterior.

## Estrutura

`assets/js/` contém os contratos centrais e módulos de domínio; `assets/css/app.css` concentra a identidade visual; `data/` guarda índices; `midia/` recebe as mídias; `scripts/` contém geração e testes; `.github/workflows/` atualiza o índice da Galeria sem force push.

## Importante sobre autenticação

A aplicação continua sendo uma aplicação estática client-side. Mover os hashes para JavaScript reduz a exposição de senhas em texto puro, mas não cria autenticação forte. Para proteção real de credenciais, o próximo passo deve ser um backend ou provedor de autenticação.

## Mídias

Coloque fotos, vídeos e áudios em `midia/`. Rode `python scripts/gerar-midia-index.py` para gerar `data/midia-index.json`. O workflow `atualizar-galeria.yml` executa o mesmo processo automaticamente quando a pasta é alterada.

## Testes

`node scripts/test-static.mjs` valida a estrutura e os JSON. `python scripts/smoke_test.py` executa um fluxo real de navegador com Chromium/Playwright.


### Radar de Memórias
A galeria inclui o “Radar de Memórias”, que agrupa fotos por dia e permite reabrir rapidamente os capítulos com mais registros. O agrupamento usa datas explícitas no índice ou datas reconhecíveis no nome do arquivo. Todo o processamento é local no navegador e respeita a visibilidade dos itens exclusivos. Consulte `docs/IMPLEMENTACAO-MELHORIAS.md`.


## Comentários da Galeria e das músicas

- Comentários legados das fotografias seguem a convenção `MSG_<nome completo do arquivo>.txt`, junto da mídia. O comentário abre em uma janela temática; no visualizador, o botão de comentário não fecha a fotografia nem reinicia seu zoom.
- Os vídeos musicais são reproduzidos em um player incorporado no aplicativo. Cada música tem uma thread própria de comentários, com anexos de fotografias.
- Comentários e anexos das músicas são guardados no IndexedDB do navegador atual. Por ser uma aplicação estática, essa persistência é local ao dispositivo/navegador e não sincroniza entre dispositivos.
- `python scripts/smoke_test.py` verifica as interações com Chromium quando o navegador e a navegação HTTP local estão disponíveis. `node scripts/test-static.mjs --source-only` valida a estrutura mesmo quando o ZIP de trabalho não inclui todos os arquivos de mídia; o teste completo sem essa opção verifica também a presença física de cada mídia indexada.

## Nuvem, comentários musicais e painel Peixinho

A integração opcional com Supabase está em `assets/js/cloud.js` e `assets/js/cloud-config.js`. Para ativá-la, siga o passo a passo completo em `CONFIGURAR-NUVEM-LOOOPLY.md` e execute `supabase/schema.sql` no projeto Supabase. Sem URL/chave configuradas e contas criadas no Supabase, os comentários continuam no IndexedDB local e não sincronizam entre aparelhos. O painel `admin.html` exige perfil com `role='admin'` no banco; não basta alterar o nome local.
