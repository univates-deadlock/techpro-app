# Backups e recuperação — PostgreSQL TechPro (RNF09)

O `docker-compose.yml` inclui o serviço `db-backup`, isolado do proxy
reverso, que executa `pg_dump` diariamente em formato customizado. O primeiro
backup ocorre ao iniciar o serviço, e os seguintes a cada 24 horas.
O script usa nomes UTC, mantém **no mínimo 7 cópias diárias** distintas
(`BACKUP_RETENTION`, padrão 7) e só publica o arquivo após a leitura de
metadados do dump ter sido validada.

O backup usa o volume nomeado `db_backups`, separado de `postgres_data`.
Esse volume precisa de armazenamento protegido e monitoramento de capacidade.
Os arquivos são criados com `umask 077`; não colocar backups no Git,
nem em diretórios servidos pelo Caddy.

## Antes de qualquer deploy

1. Confirmar CI verde no commit que irá para a `main`.
2. Confirmar variáveis existentes no host, sem substituí-las por exemplos.
3. Confirmar backup recente, com data e tamanho não nulo.
4. Registrar o commit atual para rollback do **código**.
5. Executar migrations somente depois de checar compatibilidade retroativa.
6. No pós-deploy, validar `/api/health`, login, criação/consulta e logs.
7. Rodar `sh scripts/smoke-check.sh https://app.matbdev.com` para verificar HTTP, proxy e 401 sem sessão.
8. Não usar `docker compose down -v`: isso removeria volumes de dados.

O fluxo GitHub Actions → `deadlock-deploy` → runner → Caddy central
permanece inalterado. Esta alteração não publica PRs em draft.

## Operação e retenção

```bash
docker compose ps db db-backup
docker compose logs --tail=100 db-backup
docker compose exec db-backup sh -c 'ls -lh /backups/techpro-*.dump'
```

O container usa `restart: unless-stopped`. Se o dump falhar, ele reinicia
e tenta de novo; um backup já feito no mesmo dia é revalidado em vez de
duplicado. O administrador deve verificar periodicamente se houve backup
nas últimas 24–36 horas e se o volume não está cheio. O script não envia
dados a armazenamentos externos. Volumes na mesma VM não protegem contra
perda integral da VM; cópia externa protegida precisa ser planejada à parte.

## Testar restauração sem tocar o banco de produção

Primeiro, copie uma única cópia do volume para um caminho temporário privado:

```bash
docker compose exec -T db-backup cat /backups/techpro-AAAAMMDD.dump > /tmp/techpro-verify.dump
chmod 600 /tmp/techpro-verify.dump
sh scripts/verify-backup.sh /tmp/techpro-verify.dump
rm -f /tmp/techpro-verify.dump
```

Troque `AAAAMMDD` pela data efetiva. O verificador cria um PostgreSQL
17 **descartável, sem rede**, restaura em `techpro_verify`, verifica a
existência de tabelas e remove o container. Não conecta ao banco real.
A validação de lista de arquivos durante o backup **não substitui**
esta restauração periódica.

## Rollback e dados

Rollback de código: selecionar o commit/tag aprovado anterior pelo fluxo
central; reverter via novo PR de correção (nunca forçar a branch `main`).
Uma migration que altera o esquema pode não ser reversível com rollback
de código. Reconciliar as migrations e preservar os volumes antes de voltar
uma versão. Restauração de dados é uma operação destrutiva que exige
janela de manutenção e autorização específica; não é executada pelo
script de verificação.

A evidência de aprovação, quando habilitada, reside em volume próprio
(`evidence_data`) e necessita backup independente. Este script cobre
**somente o PostgreSQL**.
