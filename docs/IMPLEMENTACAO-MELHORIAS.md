# Melhorias da galeria, playlists e temas

## Playlists por usuário
- Misol: `PLUZFdmgmipvI`
- Yara: `PLCn4CAsA_tiM`
- Patati: `PLE0tcB0gaSzM`
- Outros usuários continuam usando a playlist padrão anterior.

A página de músicas identifica o usuário pela chave `username` no `localStorage`. A página recarrega a lista ao detectar mudanças dessa chave em outra aba ou o evento `looply:user-changed`.

## Temas
O seletor fica em **Perfil > Preferências > Tema do aplicativo**. A escolha é salva em `localStorage` na chave `looply_theme` e aplicada por `assets/js/theme.js` em todas as páginas.

## Datas de mídias
O gerador grava `uploadedAt` com a data do primeiro commit que adicionou o arquivo, usando o histórico Git. O workflow usa `fetch-depth: 0` para disponibilizar o histórico. Se a data já existir no índice, ela é preservada; a data de geração do índice não deve substituir a data de upload. Em arquivos antigos cujo histórico não exista, usa-se uma data reconhecível no nome ou, por último, o `mtime` disponível.

## Mensagens publicadas na galeria
Para publicar uma mensagem compartilhada, crie junto à mídia um arquivo UTF-8 com o nome `MSG_<nome-completo-do-arquivo-de-mídia>.txt`. Exemplo: para `midia/foto.jpg`, crie `midia/MSG_foto.jpg.txt` e faça commit no repositório. A galeria busca esse arquivo e renderiza o conteúdo como texto simples (`textContent`), sem interpretar HTML. A interface não contém campo, botão ou formulário para visitantes escreverem comentários; somente arquivos versionados no GitHub são exibidos. Não coloque tokens do GitHub no frontend.

## Orientação de fotos e tela cheia
As imagens usam `image-orientation: from-image` para respeitar a orientação EXIF da câmera, sem deformar pixels. A grade mantém `object-fit` para enquadramento; a visualização ampliada usa `contain` para não cortar a foto. Fotos que já tenham os pixels gravados deitados e não possuam orientação EXIF correta precisam ser corrigidas no arquivo de origem: não existe forma confiável de inferir automaticamente a rotação pretendida apenas pela proporção da imagem. O botão ⛶ abre o painel no Fullscreen API do navegador, e o botão × fecha a visualização.

## Arquivos alterados
- `assets/js/music.js`
- `assets/js/theme.js` (novo)
- `assets/js/profile.js`
- `assets/js/gallery.js`
- `assets/css/app.css`
- `perfil.html`, `index.html`, `login.html`, `home.html`, `galeria.html`, `musicas.html`
- `scripts/gerar-midia-index.py`
- `.github/workflows/atualizar-galeria.yml`


## Alterações desta revisão
- `galeria.html`: botão acessível para alternar tela cheia no visualizador.
- `assets/js/gallery.js`: tela cheia nativa com fallback, sincronização de acessibilidade e mensagens somente leitura vindas de arquivos `MSG_*.txt`; removido o armazenamento local de anotações.
- `assets/css/app.css`: orientação EXIF explícita e enquadramento sem distorção na visualização ampliada.
- `.github/workflows/atualizar-galeria.yml`: tentativa de atualização/rebase antes do push, sem `--force`.


## Funcionalidade nova — Radar de Memórias (Memória Viva)

A galeria agora monta capítulos temporais a partir das datas válidas do índice de mídia. O componente destaca até cinco dias com mais fotografias e permite filtrar a galeria para revisitar um dia; o botão “Ver todas as memórias” remove o filtro. Datas explícitas no índice têm prioridade e, quando ausentes, o módulo tenta reconhecer `YYYY-MM-DD` ou `YYYYMMDD` no nome do arquivo, sem inventar datas.

O Radar é calculado localmente no navegador a partir dos metadados já carregados, não envia imagens para terceiros, não exige bibliotecas externas e aplica a mesma regra de visibilidade dos conteúdos exclusivos. O resumo contabiliza apenas fotografias que a sessão atual pode ver. Se a mídia não possuir data confiável, ela permanece acessível na galeria normal, mas não entra nos capítulos temporais.

Arquivos envolvidos: `galeria.html` (estrutura acessível), `assets/js/gallery.js` (inferência de data, agrupamento, filtro e interação) e `assets/css/app.css` (apresentação responsiva e respeito a movimento reduzido).
