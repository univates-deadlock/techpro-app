# Histórico de migrations

As pastas são aplicadas em ordem pelo Prisma:

1. `20260925141227_initial_database`: entidades e enums iniciais.
2. `20260925155124_better_auth_modifications`: adaptação para Better Auth.
3. `20260925162454_user_active`: campo `isActive`.
4. `20260926000000_user_management`: reintroduz perfil e default de email não verificado.
5. `20261116000000_quote_workflow_actors`: adiciona `sent_by` e `decided_by` opcionais ao orçamento, com chaves estrangeiras para usuário e `ON DELETE RESTRICT`. Registros anteriores podem conservar valores nulos.

A migration antiga de Better Auth remove campos antigos de usuário, incluindo
senha e perfil. Ela foi preservada; antes de aplicá-la em uma base antiga com
dados, planeje a migração desses dados. O histórico foi verificado em uma base
separada vazia, sem reset do banco de trabalho.

A migration de gestão de usuários atribui `TECHNICIAN` aos registros existentes. Não promove admins
automaticamente. O comando `admin:create` cria um admin quando ainda não há um
ativo, sem sobrescrever usuários. Os IDs gerados e o horário de edição são
controlados pelo Prisma, não por triggers adicionadas nessa migration.

O planejamento de visitas e o pós-serviço utilizam as tabelas existentes; os PRs correspondentes não exigiram novas migrations. A fonte de verdade é o [schema Prisma](../schema.prisma); consulte também o [DER atualizado](../../../docs/modelagem-dados.md).
