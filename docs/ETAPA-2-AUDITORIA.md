# Looply — Etapa 2: auditoria de chat, WebRTC, notificações e jogo

## Resultado da inspeção (18/10/2026)

**Estado: bloqueada para implementação funcional segura até existir arquitetura de chat/sinalização identificável.** Foi criada a branch `audit/etapa-2-chat-webrtc-jogo`, baseada na branch de trabalho da Etapa 1. Nenhuma chamada, notificação externa ou jogo é declarado implementado.

## Repositório inspecionado

Árvore da branch consultada contém as páginas `admin.html`, `galeria.html`, `home.html`, `index.html`, `login.html`, `musicas.html` e `perfil.html`. Não há `chat.html`, `conversa.html` nem arquivos com nomes relacionados a chat, mensagens ou chamadas na árvore obtida.

Arquivos relevantes lidos:
- `assets/js/config.js`: rotas atuais são index, login, home, gallery, music e profile.
- `assets/js/navigation.js`: navegação por `data-route`; não há rota de chat.
- `assets/js/session.js`: permite autenticação local legada para usuários conhecidos, além do fluxo Supabase.
- `assets/js/cloud.js`: cliente Supabase e autenticação; não há API de chat ou sinalização WebRTC neste módulo.
- `assets/js/users.js`: lista local de usuários com imagens locais configuradas.
- `supabase/schema.sql`: perfis e comentários de músicas, sem modelo geral de conversas, mensagens, anexos de chat, chamadas ou jogo.

## Verificação do projeto Supabase ativo

Projeto `kgrxvsizfmaxlosiitec` (Loooply), status reportado como ativo saudável.

A listagem de tabelas no schema `public` retornou:
- `profiles` — 4 linhas, RLS habilitado.
- `music_comments` — 0 linhas, RLS habilitado.
- `admin_messages` — 0 linhas, RLS habilitado.

A listagem de Edge Functions retornou nenhuma função.

Esses resultados não mostram infraestrutura de chat geral, presença, registro de chamadas, placar ou servidor de push. A tabela `admin_messages` tem remetente/destinatário e texto, mas pelo nome, schema e escopo não é seguro reutilizá-la como chat privado entre usuários sem verificar e redesenhar as políticas de acesso.

## Bloqueios técnicos que impedem declarar os requisitos concluídos

1. **Chat e anexos:** não há página nem schema de conversas/mensagens/anexos de chat identificado. Precisamos definir tabelas, associação entre participantes, RLS, políticas de Storage e eventos Realtime.
2. **Fotos de perfil:** o cadastro local contém nomes de arquivos como `user1_perf.png`; isso não prova que os arquivos existam nem resolve a URL de fotos do perfil Supabase. A associação real deve ser resolvida a partir dos perfis/autenticação e URLs verificáveis.
3. **Emoji:** não existe seletor de emojis no código de chat porque não foi encontrado módulo de chat. Não foi substituído por um ícone estático.
4. **WebRTC:** não foram encontrados `RTCPeerConnection`, `getUserMedia`, oferta/resposta SDP ou troca de ICE no código obtido. Sem sinalização bilateral e credenciais/autorização de chamadas, não há como corrigir áudio/vídeo unilateral nem testar chamadas reais.
5. **Chamadas globais:** nenhuma tabela/canal de chamadas foi identificado. Para chamadas em segundo plano, também são necessários serviço de push, VAPID, endpoint de envio protegido e service worker; a página web sozinha não pode garantir despertar/toque contínuo quando o navegador foi encerrado ou o SO restringe execução.
6. **Jogo da velha:** nenhum módulo ou tabela de partidas/placar foi identificado. Um placar sincronizado e idempotente requer transação ou função de servidor com chave única por partida/rodada; localStorage não atende ao requisito.
7. **Autenticação mista:** `session.js` mantém autenticação local legada para usuários cadastrados no código. Ela não fornece identidade Supabase autenticada para autorizar conversas, chamadas, push ou placar entre dispositivos. O fluxo precisa definir como os usuários legados serão migrados/autenticados sem enfraquecer RLS.

## Testes realmente realizados

- Leitura estática de arquivos de rotas, sessão, cliente Supabase, registro local de usuários e schema SQL.
- Inspeção da árvore de arquivos da branch.
- Consulta ao Supabase para listar tabelas públicas e Edge Functions.
- Nenhum teste de navegador, mensagem entre duas contas, anexo, emoji, chamada WebRTC entre dispositivos, câmera, reconexão, push ou jogo foi executado.

## Próximas ações necessárias

1. Definir o modelo de identidade para todas as contas (Supabase Auth, sem bypass local para recursos multiusuário).
2. Criar migração revisável para conversas, participantes, mensagens, anexos, estado de leitura, presença, chamadas e partidas/placar; definir RLS e políticas Storage antes de aplicar no projeto ativo.
3. Implementar páginas e módulos reais e adicionar as rotas ao mapa existente.
4. Implementar sinalização WebRTC autenticada (oferta/resposta/ICE), tratamento de glare/reconexão, permissões, dispositivos e estados de mídia.
5. Implementar Web Push com service worker e serviço de envio protegido, documentando limitações de navegador/Android.
6. Adicionar testes automatizados e realizar teste manual com duas contas e dois dispositivos reais.
7. Só então declarar concluídos os requisitos correspondentes.

## Relação com a Etapa 1

A Etapa 1 está apenas parcialmente implementada na branch-base e permanece em PR de rascunho. A navegação e o cabeçalho do chat não podem ser verificados porque a página de chat não existe na árvore inspecionada. Este relatório não declara a Etapa 1 concluída.
