# Looply 3.0.1 — Etapa 2: auditoria de chat, WebRTC, notificações e jogo

## Estado e base de trabalho

Auditoria estática realizada no repositório `soumoiss/Loooply`, branch `main` e arquivos relacionados. Foi criada a branch `audit/etapa-2-chat-webrtc` baseada na branch de trabalho `audit/icons-looply-3.0.1`, para preservar as alterações da Etapa 1 sem publicar nem alterar `main`.

**Esta etapa não está implementada nem validada funcionalmente.** O código atual não contém a base necessária para corrigir os recursos pedidos sem criar arquitetura nova e testar com dois dispositivos. O relatório documenta essa constatação para evitar alegar que chamadas ou mensagens funcionam quando não há implementação encontrada.

## Evidências da auditoria

### Arquivos e módulos localizados

A árvore de código consultada contém estas páginas: `admin.html`, `galeria.html`, `home.html`, `index.html`, `login.html`, `musicas.html`, `perfil.html`. Não há `chat.html`, `conversa.html` nem outra página HTML identificável como chat/jogo.

Módulos JS identificados: `assets/js/admin.js`, `app-core.js`, `cards.js`, `cloud-config.js`, `cloud.js`, `comments-store.js`, `config.js`, `date-parser.js`, `gallery.js`, `home.js`, `media-normalizer.js`, `music.js`, `navigation.js`, `profile.js`, `session.js`, `storage.js`, `theme.js`, `users.js`.

### Chat e mensagens

- A busca no código padrão por `RTCPeerConnection`, `getUserMedia`, `createOffer`, `serviceWorker`, `emoji picker` e termos de jogo não encontrou resultados.
- O esquema `supabase/schema.sql` declara `profiles` e `music_comments`, mas não tabelas de conversas, mensagens, participantes, anexos de mensagens, sinalização de chamadas ou partidas/placar do jogo.
- `assets/js/cloud.js` oferece funções para login/perfis e comentários de música; não é um sistema de mensagens diretas.
- Não foi possível auditar associação de mensagens/conversas, estados de entrega/leitura, anexos de chat ou seletor de emoji porque os recursos correspondentes não foram encontrados no código consultado.

### Perfis

- O registro local em `assets/js/users.js` tem caminhos de fotos locais para os quatro usuários definidos.
- O esquema de perfil no Supabase tem `profile_pic`, mas não há lista de conversas na qual verificar renderização de fotos de participantes.
- Portanto, não é possível declarar corrigida a lista de conversas ou a associação entre uma conversa e a foto real do outro usuário.

### Chamadas e notificações

- Não foi encontrada implementação WebRTC, sinalização, captura de microfone/câmera, elementos de áudio/vídeo de chamada ou tratamento de candidatos ICE.
- Não foi encontrado service worker registrado para chamadas/notificações. O manifesto existente não substitui um servidor de sinalização nem implementação Web Push.
- Sem implementação existente, não há base para afirmar que áudio/vídeo unilateral foi corrigido, que a câmera frontal/traseira funciona, ou que o destinatário pode atender chamadas fora da página atual.
- Uma solução real exigirá sinalização autenticada e persistente, controle de acesso a chamadas, TURN para redes restritivas, gestão de ciclo de vida da chamada e testes em dois dispositivos. Notificações externas também exigem service worker, consentimento, assinatura Push e componente servidor seguro; uma página estática sozinha não consegue garantir que o navegador encerrado desperte ou toque indefinidamente.

### Jogo da velha

- Não foi encontrada página, módulo, tabela ou RPC do jogo da velha.
- Não há mecanismo persistente de pontuação por usuário, nem chave de idempotência/transação que evite contabilizar duas vezes uma vitória.

## Testes executados

1. Inspeção da árvore GitHub do branch `main` e das páginas/módulos encontrados.
2. Leitura estática de `supabase/schema.sql`, `assets/js/cloud-config.js`, `assets/js/cloud.js`, `assets/js/users.js`, `assets/js/profile.js`, `assets/js/config.js` e `home.html`.
3. Busca indexada do repositório por símbolos WebRTC, service worker, seletor de emoji e termos de jogo; sem resultados correspondentes.
4. Nenhum teste de navegador, autenticação integrada, mensagens, anexos, emojis, WebRTC, Push ou jogo foi executado. Não foram usados dois dispositivos reais.

## Resultado e próximo marco

Esta entrega é uma auditoria com evidências, não uma implementação do chat, das chamadas, das notificações nem do jogo. Nenhum esquema Supabase foi aplicado ou alterado nesta etapa, nenhum segredo foi criado, nenhuma chamada foi simulada como sucesso e nada foi publicado no GitHub Pages.

Antes de implementar e testar esses recursos, será necessário criar os módulos ausentes, definir migrações/RLS e sinalização segura, e validar os fluxos com duas contas em dois dispositivos. A Etapa 1 permanece em seu PR rascunho separado e também não está publicada.
