# Loooply — diagnóstico e pacote de recuperação

## Causa confirmada

A validação em `assets/js/cloud-config.js` foi alterada no commit `26e5067e3381155b61afc3093095dd6dcb1b17ae` para rejeitar a própria URL e a própria chave que estão configuradas no objeto. Como cada valor necessariamente contém a si mesmo, `CLOUD_CONFIG.enabled()` retorna `false`. Isso desativa a autenticação Supabase, o painel administrativo e a fonte de comentários na nuvem.

Referência: https://github.com/soumoiss/Loooply/commit/26e5067e3381155b61afc3093095dd6dcb1b17ae

## Evidências examinadas

- Repositório público `soumoiss/Loooply`, branch principal `main`.
- O Supabase identificou o projeto Loooply como `ACTIVE_HEALTHY`.
- O perfil `peixinho` existe, tem papel `admin`, está associado a um usuário Auth confirmado e não está banido.
- O estado atual do banco é: 1 usuário Auth, 1 perfil, 0 comentários musicais e 0 objetos no bucket de anexos.
- O código local mantém quatro identidades legadas; portanto, ativar a nuvem sem separar os modos de sessão bloquearia esses logins.
- No banco ativo as políticas chamam `private.is_loooply_admin()`, enquanto `supabase/schema.sql` ainda criava `public.is_loooply_admin()`. Isso é divergência entre a configuração reproduzível do repositório e o estado atual.
- O painel do Supabase reportou a proteção contra senhas comprometidas desativada. Há também avisos de políticas permissivas duplicadas para perfis.
- O projeto contém uma chave da YouTube Data API no JavaScript público. Ela não autentica usuários, mas precisa de restrição por domínio/API ou rotação no Google Cloud.

## O que o pacote prepara

1. Corrige a validação para verificar marcadores de configuração não preenchida, em vez de rejeitar valores reais.
2. Mantém os logins legados no modo local, enquanto identidades não presentes no cadastro legado usam Supabase Auth.
3. Escolhe a persistência de comentários pela sessão autenticada, evitando que usuários locais tentem acessar tabelas da nuvem sem sessão.
4. Faz o painel administrativo exigir uma sessão autenticada pelo Supabase, além da checagem de papel já feita no banco.
5. Ajusta o teste estático e o teste de navegador para validar explicitamente o modo local com a nuvem configurada.
6. Alinha o SQL de instalação com a função administrativa do esquema `private` utilizado no banco ativo.

## Limitações e tarefas ainda não concluídas

- **Nenhuma alteração foi escrita no GitHub ou no banco de produção.** A criação da branch foi recusada pela integração GitHub com HTTP 403 (`Resource not accessible by integration`). Para evitar commits intermediários diretamente em `main`, o pacote prepara as mudanças para aplicação controlada.
- Os quatro usuários legados ainda não têm contas Supabase demonstradas no banco. Enquanto não forem migrados de forma segura, seus comentários continuam locais e não sincronizam entre dispositivos. O histórico do IndexedDB não deve ser apagado nem será migrado automaticamente por este pacote.
- Não foi possível comprovar login real via navegador, upload remoto, sincronização entre dois dispositivos nem teste negativo com duas contas distintas, pois a integração atual não dá acesso de escrita ao repositório e não foi disponibilizado um ambiente local completo.
- A proteção contra senhas comprometidas precisa ser habilitada no painel de autenticação do Supabase; as ferramentas disponíveis nesta sessão não expõem essa configuração.
- A chave do YouTube precisa ser restringida ou rotacionada por alguém com acesso às configurações do Google Cloud.

## Aplicação e verificação

Execute o script de aplicação contra uma cópia local atualizada do repositório. Ele valida todos os trechos esperados antes de alterar arquivos e grava os originais em `.loooply-recovery-backup/`.

```bash
python apply_recovery.py /caminho/para/Loooply
cd /caminho/para/Loooply
node scripts/test-static.mjs --source-only
python scripts/smoke_test.py
```

O teste de navegador exige Playwright e Chromium disponíveis. O pacote inclui um teste de regressão específico para a lógica da configuração. Execute também `node /caminho/do/pacote/tests/test-cloud-config.mjs /caminho/para/Loooply`, revise as alterações e execute os testes antes de publicar o resultado.
