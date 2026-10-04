# Looply — arquitetura e decisões da reconstrução

## O que foi observado na base recebida

A base efetivamente disponível tinha três páginas: `index.html`, `login.html` e `home.html`.

`index.html` funcionava como splash e fazia a decisão inicial usando `localStorage.isLoggedIn`.
`login.html` mantinha quatro usuários no JavaScript, autenticava localmente e persistia `isLoggedIn`, `username` e `profilePic`.
`home.html` era um monólito de HTML/CSS/JS, com 50 cartas, leitura persistente por usuário, filtros, calendário, parser de datas, modal, acessibilidade e links para `galeria.html` e `musicas.html`, que não vieram no conjunto recebido.

Também não foram recebidos os arquivos de cartas `.txt`, imagens de perfil, `Quillen.otf`, índice de mídia ou workflow.

## Problemas corrigidos na reconstrução

### Guarda de autenticação inconsistente

**Causa:** a Home aceitava qualquer valor não vazio em `isLoggedIn`, enquanto o Login exigia exatamente `"true"`.

**Correção:** `session.js` valida `isLoggedIn`, `username` contra o registro de usuários e normaliza `profilePic`, mantendo as chaves legadas.

**Impacto:** rotas protegidas deixam de depender de uma condição de verdade fraca.

### Credenciais espalhadas no HTML

**Causa:** senhas apareciam em texto puro dentro de `login.html`.

**Correção:** o registro foi centralizado em `assets/js/users.js` e a autenticação compara SHA-256 no cliente.

**Impacto:** reduz exposição acidental em HTML, mas não transforma uma aplicação estática em autenticação segura. Backend/provedor continua sendo necessário para segurança real.

### Home monolítica

**Causa:** aproximadamente 141 KB em uma única página, com domínio, persistência, calendário, modal, navegação e carregamento de cartas misturados.

**Correção:** módulos independentes para configuração, usuários, sessão, storage, navegação, parser de datas, cartas, galeria, músicas e perfil.

**Impacto:** menor acoplamento, manutenção mais segura e contratos compartilhados explícitos.

### Carga de 50 cartas

**Causa:** a Home anterior disparava carregamentos de cartas diretamente em um laço.

**Correção:** `CardRepository` usa concorrência controlada e coalescência de requisições pendentes.

**Impacto:** menos pressão simultânea de rede/CPU e menor chance de leituras duplicadas quando uma carta é aberta durante o carregamento.

### Navegação duplicada

**Causa:** coexistiam helpers como `abrirGaleria`/`navegarParaGaleria` e equivalentes de Músicas.

**Correção:** `navigation.js` concentra o contrato e preserva aliases globais somente para compatibilidade externa.

### Conteúdo textual das cartas

**Causa:** títulos e textos dependiam de arquivos externos que não foram entregues.

**Correção:** o novo código mantém exatamente o padrão `${username}cartaN.txt`, marca ausência de arquivo com estado visível e continua sem inserir o conteúdo de carta em `innerHTML`.

## Arquitetura final

`index.html` → `session.js` → `login.html` → `home.html`.

A Home compartilha contratos com `galeria.html`, `musicas.html` e `perfil.html` por meio de `config.js`, `session.js`, `storage.js` e `navigation.js`, sem dependências artificiais entre páginas.

A Galeria consome `data/midia-index.json`. O workflow `atualizar-galeria.yml` reconstrói esse índice a partir de `midia/` e publica somente um commit normal; não usa force push.

## Arquivos entregues

- `index.html`
- `login.html`
- `home.html`
- `galeria.html`
- `musicas.html`
- `perfil.html`
- `manifest.webmanifest`
- `assets/css/app.css`
- `assets/js/app-core.js`
- `assets/js/config.js`
- `assets/js/users.js`
- `assets/js/storage.js`
- `assets/js/session.js`
- `assets/js/navigation.js`
- `assets/js/date-parser.js`
- `assets/js/cards.js`
- `assets/js/home.js`
- `assets/js/gallery.js`
- `assets/js/music.js`
- `assets/js/profile.js`
- `data/midia-index.json`
- `data/musicas-index.json`
- `scripts/gerar-midia-index.py`
- `scripts/test-static.mjs`
- `scripts/smoke_test.py`
- `.github/workflows/atualizar-galeria.yml`
- `.gitignore`
- `README.md`

## Arquivos que continuam faltando do material de origem

Os binários e conteúdos ausentes não foram inventados: `Quillen.otf`, as quatro imagens de perfil e os arquivos de cartas `.txt`. A estrutura nova é compatível com esses caminhos quando eles forem recolocados no repositório.
