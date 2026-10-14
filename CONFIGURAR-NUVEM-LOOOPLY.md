# Configuração da nuvem do Loooply e conta Peixinho

## O que esta integração usa

- Supabase Auth para login persistente e seguro.
- PostgreSQL para perfis e comentários por música.
- Supabase Storage privado para fotografias anexadas aos comentários.
- Políticas RLS para que o navegador nunca receba uma chave administrativa secreta.

**Importante:** esta integração só passa a sincronizar de verdade depois de configurar o projeto Supabase e suas credenciais. Enquanto `assets/js/cloud-config.js` estiver com os textos de exemplo, o app continua no modo local anterior. Não existe ainda um projeto Supabase provisionado por este código.

## 1. Criar o projeto Supabase

1. Entre em https://supabase.com/ e crie um projeto para o Loooply.
2. Guarde a senha do banco em um gerenciador de senhas; ela não é a senha de login do Loooply.
3. Em **Project Settings → API**, copie a **Project URL** e a chave **anon/public** (ou publishable).
4. Abra `assets/js/cloud-config.js` e substitua `COLE_AQUI_A_URL_DO_SUPABASE` e `COLE_AQUI_A_CHAVE_ANON_PUBLICA` pelos dois valores.
5. Nunca cole no front-end a chave `service_role`/secret do Supabase. Ela ignora as políticas de segurança e daria controle total do banco a qualquer pessoa que inspecionasse o site.

## 2. Criar tabelas e políticas

No Supabase, abra **SQL Editor → New query**, cole todo o conteúdo de `supabase/schema.sql` e execute. O script cria os perfis, os comentários, índices, regras RLS e o bucket privado das fotografias.

## 3. Criar a conta de administrador Peixinho

Não é seguro definir uma senha real dentro dos arquivos do projeto. A senha será escolhida por você no painel de autenticação.

1. No Supabase, abra **Authentication → Users → Add user → Create new user**.
2. Crie o usuário com e-mail `peixinho@loooply.app` e escolha uma senha forte que só você conheça.
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

## 6. Publicação e testes

Publique todos os arquivos modificados no mesmo local em que o Loooply já é hospedado, incluindo `admin.html`, `assets/js/cloud.js`, `assets/js/cloud-config.js`, `assets/js/comments-store.js` e `supabase/schema.sql` (o SQL também precisa ser executado no painel Supabase; apenas publicar o arquivo não cria tabelas).

Use HTTPS para que o Supabase Auth funcione corretamente. Teste com duas contas e dois dispositivos: publicar um comentário com uma foto no primeiro, sair, entrar no segundo e abrir a mesma música. Em seguida, entre como Peixinho e confira o painel administrador.

## Limitações conhecidas e segurança

- Não é possível confirmar a sincronização real sem uma URL e uma chave válidas de um projeto Supabase, contas criadas e SQL executado.
- A chave pública/anon é projetada para ficar no front-end; a segurança depende das políticas RLS do SQL. Nunca use `service_role` no navegador.
- O acesso de administrador é somente de leitura no painel desta entrega, exceto que o SQL permite ao administrador ajustar perfis e excluir comentários. A interface ainda não expõe esses controles de moderação.
- A chave da YouTube Data API que já existia no arquivo de músicas está visível no código público. No Google Cloud, restrinja-a por HTTP referrer aos domínios do app e apenas à YouTube Data API; se ela já foi publicada sem restrições, revogue-a e gere outra.
