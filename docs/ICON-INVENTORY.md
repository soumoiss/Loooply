# Looply 3.0.1 — inventário de ícones (auditoria inicial)

> **Estado:** inventário inicial em andamento. Este documento não afirma que a padronização foi implementada. Nenhum ícone Icons8 foi substituído nesta etapa; as páginas individuais, os SVGs baixados e as respostas HTTP ainda precisam ser verificados antes de qualquer adoção.

## Escopo e evidência de origem

Auditoria estática inicial das seis páginas abaixo, obtidas da branch `main` antes de qualquer alteração. Os SHAs são os blobs consultados para tornar a linha de base reproduzível.

| Página | Blob SHA de origem | SVGs embutidos no HTML | Botões HTML | Módulos JS referenciados |
|---|---|---:|---:|---|
| `index.html` | `08a52e3390488fff41e95d33b5e49139dda7098e` | 1 | 0 | `assets/js/theme.js` + módulo inline |
| `login.html` | `38c95909c3777013417ad892c171108979f81511` | 2 | 2 | `assets/js/theme.js` + módulo inline |
| `home.html` | `2c2b952c7b4f2fc7ec381a9eed4b3746e23213cd` | 3 | 13 | `assets/js/theme.js`, `assets/js/home.js` |
| `galeria.html` | `d0209d93aaac419125a1b43a1754f23203932f11` | 1 | 8 | `assets/js/theme.js` + lógica inline |
| `musicas.html` | `421d1e2e0f01f416abf9274463bca0b8fb79f712` | 1 | 0 | `assets/js/theme.js` + lógica inline |
| `perfil.html` | `2505cc8aba97b161507c29bbe2b799cb03dd9847` | 1 | 2 | `assets/js/theme.js`, `assets/js/profile.js` |

**Limite da contagem:** os números acima contam apenas tags presentes no HTML estático. Não incluem SVGs, emojis, símbolos Unicode, imagens ou controles que possam ser criados dinamicamente por JavaScript, CSS `::before/::after`, nem componentes de páginas/modais adicionais. Portanto, não representam a contagem final de ícones do aplicativo.

## Linha de base dos módulos compartilhados inspecionados

| Arquivo | Responsabilidade observada | Implicação para a migração |
|---|---|---|
| `assets/css/app.css` | Estilos compartilhados de páginas e componentes | Definir tokens para tamanho, espessura, alinhamento, foco e contraste sem quebrar estilos existentes. |
| `assets/js/theme.js` | Temas globais persistentes | Ícones devem acompanhar superfícies claras/escuras via CSS, sem fundos opacos decorativos. |
| `assets/js/config.js` | Rotas e configuração da aplicação | Rotas atuais: `index.html`, `login.html`, `home.html`, `galeria.html`, `musicas.html`, `perfil.html`. |
| `assets/js/home.js` | Cartas, navegação e interações da home | Preservar eventos e estados ao substituir símbolos dos controles. |
| `assets/js/gallery.js` | Lógica de galeria e mídia | Inspecionar controles criados dinamicamente e seus eventos antes de trocar ícones. |
| `assets/js/music.js` | Playlist, player e comentários musicais | Separar visualmente play/pause, volume, voz, vídeo, anexar e enviar. |
| `assets/js/profile.js` | Perfil e preferências | Preservar formulários, estados e acessibilidade. |
| `assets/js/session.js`, `assets/js/cloud.js` | Sessão e integração de nuvem | Não alterar autenticação nem contratos da nuvem para padronizar ícones. |

## Mapeamento semântico a completar

A pesquisa do catálogo deve ser feita no estilo indicado pelo usuário: [Icons8 — catálogo Stroke 1](https://icons8.com.br/icons/all--stroke-1). A licença precisa ser confirmada para cada uso e a atribuição exigida deve ser incluída conforme a licença aplicável: [licença Icons8](https://icons8.com.br/license).

| Página/componente | Função | Nome semântico a pesquisar | Origem individual / URL de arquivo | Estado | Evidência |
|---|---|---|---|---|---|
| Splash / marca | Marca gráfica | Marca do Looply (não substituir automaticamente por ícone genérico) | Não selecionada | Pendente | HTML inspecionado; validar se é marca ou ícone funcional |
| Login | Mostrar/ocultar senha | `eye` / `eye-off` | Não selecionada | Pendente | HTML e módulo inline precisam de revisão de eventos |
| Home / navegação | Abrir galeria | `images` / `gallery` | Não selecionada | Pendente | SVG inline presente em `home.html` |
| Home / navegação | Abrir músicas | `music` / `music-note` | Não selecionada | Pendente | SVG inline presente em `home.html` |
| Home / perfil | Abrir perfil | `user-round` / `circle-user` | Não selecionada | Pendente | Link com avatar/fallback; preservar navegação |
| Home / filtros | Filtrar por data | `calendar` | Não selecionada | Pendente | SVG inline presente em `home.html` |
| Home / calendário | Mês anterior / próximo mês | `chevron-left` / `chevron-right` | Não selecionada | Pendente | Hoje usa caracteres ‹ e ›; validar foco e ação |
| Home / modal de carta | Carta anterior / próxima | `chevron-left` / `chevron-right` | Não selecionada | Pendente | Hoje usa caracteres ‹ e ›; preservar navegação |
| Home / modal de carta | Fechar modal | `x` | Não selecionada | Pendente | Hoje usa ×; preservar fechamento e foco |
| Home / sessão | Sair | `log-out` | Não selecionada | Pendente | Botão existente; ação deve permanecer |
| Galeria | Fechar, navegar, zoom, tela cheia, baixar, comentar | Pesquisar cada função separadamente | Não selecionada | Pendente | Controles estáticos e dinâmicos ainda precisam de inventário integral |
| Músicas / player | Play/pause, faixa anterior/próxima, volume | `play`, `pause`, `skip-back`, `skip-forward`, `volume-2`, `volume-x` | Não selecionada | Pendente | Verificar markup dinâmico e handlers em `assets/js/music.js` |
| Músicas / comentários | Comentar, anexar imagem, enviar, fechar | `message-circle`, `paperclip`, `send`, `x` | Não selecionada | Pendente | Não reutilizar ícones de telefone/câmera/microfone |
| Perfil | Editar, salvar, configurações | `pencil`, `check`, `settings` | Não selecionada | Pendente | Preservar formulários e estados |
| Componentes globais | Carregando, erro, vazio, sucesso | `loader-circle`, `alert-circle`, `inbox`, `check-circle` | Não selecionada | Pendente | Validar estados de feedback e movimento reduzido |
| Chat/chamadas/jogo da velha | Mensagem, voz, vídeo, microfone, alto-falante, jogo | Pesquisar símbolos distintos por ação | Não selecionada | Bloqueado / confirmar existência | Não presumir que funcionalidades ausentes existam; revisar arquitetura completa antes de mapear |

## Critérios para marcar um ícone como implementado ou validado

Um registro só pode avançar para **Implementado** após a página individual e o arquivo SVG/PNG real terem sido abertos/verificados, a licença ter sido conferida e o componente de produção ter sido alterado preservando seu evento e seu estado. Só pode avançar para **Validado** depois de testes de carregamento, acessibilidade, estados visuais, responsividade e regressão. Inspeção estática isolada não comprova funcionamento no navegador.

## Próximas etapas da auditoria

1. Enumerar todos os arquivos HTML/CSS/JS, módulos, modais e componentes dinâmicos do repositório.
2. Buscar SVG inline, `<img>`, emojis, Unicode, fontes de ícones, pseudo-elementos CSS e URLs de recursos.
3. Associar cada ocorrência ao seu evento/handler e ao componente real.
4. Selecionar ícones individuais Stroke 1 com URLs verificadas e registrar formato, cor, licença e atribuição.
5. Implementar em branch separada e executar testes estáticos/automatizados; testes reais de navegador devem ser reportados separadamente.
