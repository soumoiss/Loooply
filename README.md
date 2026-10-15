# Pacote de recuperação Loooply

Este pacote contém uma rotina de aplicação com pré-condições, teste de regressão e relatório. Foi preparado porque a integração do GitHub recusou a criação de branch com HTTP 403, então nenhuma alteração remota foi executada.

- `apply_recovery.py`: aplica as alterações à cópia de trabalho após conferir os trechos esperados e guarda cópias dos originais.
- `tests/test-cloud-config.mjs`: teste focado em URL/chave válidas e marcadores de configuração incompleta. Após aplicar o patch, execute `node /caminho/do/pacote/tests/test-cloud-config.mjs /caminho/para/Loooply` para indicar a cópia local do projeto.
- `RELATORIO.md`: causa raiz, evidências, escopo do patch, limitações e passos de validação.

Importante: o patch não faz deploy automático, não modifica o banco de produção e não cria senhas nem usuários. Leia o relatório antes de publicar.
