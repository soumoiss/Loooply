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
