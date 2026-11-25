# Prisma e banco de dados

`schema.prisma` descreve entidades, campos, relações e enums do banco PostgreSQL. A presença de um modelo no schema não significa que seus endpoints HTTP já existam:

- **Autenticação (Better Auth):** `User` (perfil e atividade, sem senha), `Account` (credencial com hash de senha), `Session` (sessão persistida, token e expiração) e `Verification` (estrutura da biblioteca para fluxos futuros de verificação).
- **Negócio integrado à interface e API:** `Client`, `Quote`, `QuoteItem`, `Service`, `Warranty`, `Revision` (além da administração de `User`). `ServiceVisit` e `VisitTechnician` possuem API integrada; componentes de interface preservados, mas tela retirada da entrega.
- **Execução de visitas:** consulta individual por vínculo, início/fim real e status registrados pela API; agenda visual pós-MVP. Nenhuma migration adicional é necessária para esses fluxos.
- **Modelagem atual:** [DER, dicionário e integridade](../../docs/modelagem-dados.md).

Comandos executados a partir da raiz do repositório:

```bash
npm run db:validate --prefix api
npm run db:generate --prefix api
npm run db:migrate --prefix api
```

Migrations já aplicadas não devem ser reescritas. Para futuras alterações, ajuste o schema e crie uma migration nova em um banco de desenvolvimento:

```bash
cd api
npx prisma migrate dev --name descricao_da_alteracao
```

Revise o SQL antes de compartilhar. `migrate deploy` aplica migrations existentes, mas não cria novas. Não use `reset` em um banco que contém dados importantes. `uuid()` e `@updatedAt` são gerenciados pelo cliente Prisma. Consulte também o [histórico de migrations](migrations/README.md).
