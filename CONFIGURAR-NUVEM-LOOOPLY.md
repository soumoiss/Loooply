# Configuração da nuvem do Loooply e conta Peixinho

## O que esta integração usa

- Supabase Auth para login persistente e seguro.
- PostgreSQL para perfis e comentários por música.
- Supabase Storage privado para fotografias anexadas aos comentários.
- Políticas RLS para que o navegador nunca receba uma chave administrativa secreta.

**Estado verificado em 14/10/2026:** o projeto Supabase `Loooply` já existe e está ativo. A URL e a chave publicável estão configuradas em `assets/js/cloud-config.js`. Foi corrigido um defeito de validação que rejeitava esses próprios valores, desativando a integração. A tabela de comentários também já está publicada em `supabase_realtime`.

## 1. Conferir a configuração do projeto Supabase

1. Entre em https://supabase.com/ e abra o projeto `Loooply`.
2. Em **Project Settings → API**, confira a **Project URL** e a chave publicável. Compare com `assets/js/cloud-config.js` sem copiar chaves secretas para o navegador.
3. Nunca cole no front-end a chave `service_role`/secret do Supabase. Ela ignora as políticas de segurança e daria controle total do banco a qualquer pessoa que inspecionasse o site.
4. Não crie um segundo projeto sem necessidade: use o projeto existente e revise o ambiente antes de aplicar migrações.

## 2. Criar tabelas e políticas

No Supabase, abra **SQL Editor → New query**, cole todo o conteúdo de `supabase/schema.sql` e execute. O script cria os perfis, os comentários, índices, regras RLS e o bucket privado das fotografias.

## 3. Criar a conta de administrador Peixinho

Não é seguro definir uma senha real dentro dos arquivos do projeto. A senha será escolhida por você no painel de autenticação.

A conta `peixinho` já foi encontrada no banco com perfil `Peixinho`, papel `admin`, identidade Auth confirmada e sem banimento ativo. Não crie uma segunda conta com o mesmo apelido. A senha inicial solicitada ainda precisa ser definida por um fluxo administrativo de Auth seguro, pois a ferramenta usada nesta recuperação não oferece a operação oficial de redefinição de senha.

Se precisar provisionar a conta em outro ambiente, siga estes passos:

1. No Supabase, abra **Authentication → Users → Add user → Create new user**.
2. Use o e-mail interno `peixinho@loooply.app` e defina uma senha forte pelo painel administrativo.
3. Se houver a opção de confirmar o e-mail, marque o usuário como confirmado. Esse e-mail é um identificador interno para o login por apelido; não é uma caixa postal real.
4. Copie o UUID desse usuário na lista Authentication → Users.
5. No SQL Editor, execute o comando abaixo substituindo `UUID-DO-USUARIO` pelo UUID real:

```sql
update public.profiles
set username = 'peixinho', display_name = 'Peixinho', role = 'admin'
where id = 'UUID-DO-USUARIO';
```

6. Confirme que a consulta atualizou exatamente uma linha. A função de administrador é validada no banco; mudar o nome localmente não concede privilégios.

## 4. Criar os usuários comuns

Para cada usuário, abra **Authentication → Users → Add user → Create new user**. O identificador de login segue o formato `apelido@loooply.app`; por exemplo, `misol@loooply.app`, `yara@loooply.app`, `patati@loooply.app` e `lilika@loooply.app`. Escolha uma senha inicial segura para cada pessoa e entregue-a de forma privada. Não reutilize a sua senha de administrador.

Os usuários digitam somente o apelido (sem `@loooply.app`) e a senha na tela de login existente. A configuração inicial usa esse domínio sintético, portanto não é necessário receber e-mails reais. No painel Supabase, configure a autenticação para não exigir confirmação por e-mail para essas contas internas, ou confirme manualmente cada conta criada. Não ative cadastro público sem decidir primeiro como vai controlar quem pode entrar.

A integração cria automaticamente o perfil de cada conta com função `user`. Para manter compatibilidade com as cartas e fotos antigas, os nomes já conhecidos (Misol, Yara, Patati e Lilika) continuam sendo normalizados para os nomes usados pelo projeto.

## 5. Como os comentários funcionam

- Cada thread de música usa o identificador da playlist e do vídeo, para que comentários não se misturem entre faixas.
- Texto e metadados das fotos ficam no banco; os arquivos das fotos são enviados ao bucket privado.
- O app gera links temporários para mostrar as fotografias a usuários autenticados.
- O painel `admin.html` consulta todos os perfis e até os 500 comentários mais recentes, incluindo anexos. A busca filtra usuário, faixa e texto.
- O histórico antigo guardado no IndexedDB não é migrado automaticamente para a nuvem. Ele continuará no dispositivo antigo, a menos que seja copiado/importado em uma etapa separada.

## 6. Publicação, migrações e testes

Publique os arquivos modificados no mesmo local em que o Loooply já é hospedado. As migrações versionadas em `supabase/migrations/` foram aplicadas ao projeto remoto durante esta recuperação; `supabase/schema.sql` documenta o esquema reproduzível para ambientes novos. Não reaplique migrações fora de ordem nem crie um segundo projeto sem revisar o estado atual.

Use HTTPS para que o Supabase Auth funcione corretamente. Antes de declarar a validação ponta a ponta, teste com duas contas Auth reais em dois navegadores: publicar um comentário com uma foto no primeiro, confirmar o registro no banco, observar a atualização em tempo real no segundo, recarregar e conferir a persistência. Em seguida, entre como Peixinho e confira o painel administrador.

## Limitações conhecidas e segurança

- O projeto e a configuração pública já existem, e a publicação Realtime foi verificada. Ainda falta o teste funcional de duas sessões autenticadas e a configuração da senha inicial de Peixinho.
- A chave pública/anon é projetada para ficar no front-end; a segurança depende das políticas RLS do SQL. Nunca use `service_role` no navegador.
- O acesso de administrador é somente de leitura no painel desta entrega, exceto que o SQL permite ao administrador ajustar perfis e excluir comentários. A interface ainda não expõe esses controles de moderação.
- A chave da YouTube Data API que já existia no arquivo de músicas está visível no código público. No Google Cloud, restrinja-a por HTTP referrer aos domínios do app e apenas à YouTube Data API; se ela já foi publicada sem restrições, revogue-a e gere outra.
