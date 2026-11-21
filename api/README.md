# API TechPro

API REST do sistema interno TechPro, construída com **Node.js 24**, **Express 5**, **TypeScript**, **Zod 4**, **Prisma 7** (`@prisma/adapter-pg`), **PostgreSQL 17** e **Better Auth**. Para visão geral do sistema e execução completa via Docker Compose, consulte primeiro o [README principal](../README.md).

---

## Sumário

1. [Arquitetura e pipeline HTTP](#arquitetura-e-pipeline-http)
2. [Instalação e configuração](#instalação-e-configuração)
3. [Criar o primeiro administrador](#criar-o-primeiro-administrador)
4. [Autenticação, cookies e segurança de sessão](#autenticação-cookies-e-segurança-de-sessão)
5. [Middlewares e autorização por perfis](#middlewares-e-autorização-por-perfis)
6. [Rotas registradas e contratos HTTP](#rotas-registradas-e-contratos-http)
7. [Validações, cálculos monetários e regras de orçamentos](#validações-cálculos-monetários-e-regras-de-orçamentos)
8. [Códigos HTTP e tratamento de erros](#códigos-http-e-tratamento-de-erros)
9. [Estrutura do código e Prisma](#estrutura-do-código-e-prisma)
10. [Comandos de execução, validação e testes](#comandos-de-execução-validação-e-testes)
11. [Resolução de problemas comuns](#resolução-de-problemas-comuns)

---

## Arquitetura e pipeline HTTP

A API separa inicialização de rede (`src/index.ts`) da montagem da aplicação Express (`src/app.ts`), permitindo importar `app` de forma isolada sem abrir porta TCP.

Em `src/app.ts`, os middlewares e roteadores são registrados exatamente nesta ordem:

```text
1. cors                  → origem única (FE_BASE_URL) com credentials: true
2. helmet()              → cabeçalhos HTTP de segurança
3. rateLimit             → limite geral de 500 requisições/minuto por IP (memória)
4. /api/auth/*splat      → handler nativo do Better Auth (antes do express.json())
5. express.json()        → parser JSON das rotas da aplicação (limite de 100 KB)
6. /api/health           → verificação pública de disponibilidade HTTP
7. /api/users            → CRUD administrativo de usuários
8. /api/clients          → CRUD de clientes
9. /api/quotes           → CRUD de orçamentos e sub-rotas de itens
10. globalErrorHandler   → padronização de erros Zod, AppError, Prisma e fallback 500
```

Nos módulos de negócio, o fluxo segue estritamente:

```text
routes → middlewares (sessão e perfil) → controllers + schemas Zod → services → Prisma / PostgreSQL
```

Controllers tratam exclusivamente de HTTP (leitura de `req`, validação com Zod, leitura de `res.locals.user` e resposta `res`); regras de negócio, cálculos e transações permanecem nos `services`.

---

## Instalação e configuração

Execute os comandos a partir da **raiz do repositório**, utilizando Node.js 24 e npm.

Para executar a API diretamente no host (usando apenas o PostgreSQL no Docker):

```bash
npm run install:all
docker compose up -d db
```

Crie `api/.env` a partir de `api/.env.example` caso ainda não exista:

```bash
if [ ! -f api/.env ]; then
  cp api/.env.example api/.env
fi
```

### Variáveis de ambiente (`src/config/env.ts`)

`env.ts` valida as variáveis com Zod antes de subir o servidor. Se houver falha, o erro informa apenas os nomes das variáveis inválidas, sem expor segredos ou URLs nos logs:

| Variável | Obrigatória | Padrão no schema | Finalidade |
| --- | --- | --- | --- |
| `PORT` | Não | `4000` | Porta TCP onde o Express escuta |
| `DATABASE_URL` | Sim | — | String de conexão PostgreSQL (`localhost:5432` no host; `db:5432` no Compose) |
| `BETTER_AUTH_SECRET` | Sim | — | Segredo de assinatura de sessão/cookies (mínimo de **32 caracteres**) |
| `BETTER_AUTH_URL` | Não | `http://localhost:4000` | URL pública base da API usada pelo Better Auth |
| `FE_BASE_URL` | Não | `http://localhost:3000` | Origem confiável permitida no CORS e no `trustedOrigins` |

> **Uso com Docker Compose:** o `docker-compose.yml` já injeta `PORT`, `DATABASE_URL`, `BETTER_AUTH_URL` e `FE_BASE_URL` no container `api`, exigindo apenas `BETTER_AUTH_SECRET` em `api/.env`. Para rodar a API **fora** do Compose, defina também `DATABASE_URL` (e opcionalmente `PORT`, `BETTER_AUTH_URL`, `FE_BASE_URL`) em `api/.env`.

Para gerar `BETTER_AUTH_SECRET` localmente sem imprimi-lo no terminal:

```bash
node --input-type=module - <<'NODE'
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
const path = 'api/.env';
const contents = readFileSync(path, 'utf8');
if (/^BETTER_AUTH_SECRET=.+$/m.test(contents)) {
  console.log('Secret existente preservado.');
} else {
  const clean = contents.replace(/^BETTER_AUTH_SECRET=.*\n?/m, '');
  writeFileSync(path, clean.trimEnd() + '\nBETTER_AUTH_SECRET=' + randomBytes(32).toString('hex') + '\n');
  console.log('Secret local configurado.');
}
NODE
```

Valide o schema, gere o cliente Prisma, aplique as migrations e inicie o servidor:

```bash
npm run db:validate --prefix api
npm run db:generate --prefix api
npm run db:migrate --prefix api
npm run dev --prefix api
```

---

## Criar o primeiro administrador

O cadastro público está desabilitado (`disableSignUp: true`). O primeiro usuário `ADMIN` deve ser provisionado localmente pelo script `src/scripts/create-admin.ts`:

```bash
export ADMIN_NAME='Administrador da Equipe'
export ADMIN_EMAIL='admin@example.com'
read -r -s -p 'Senha inicial (8 a 128 caracteres): ' ADMIN_PASSWORD
printf '\n'
export ADMIN_PASSWORD
npm run admin:create --prefix api
unset ADMIN_NAME ADMIN_EMAIL ADMIN_PASSWORD
```

Se a API estiver rodando via Docker Compose, substitua o comando npm por:

```bash
docker compose exec -e ADMIN_NAME -e ADMIN_EMAIL -e ADMIN_PASSWORD api npm run admin:create
```

Comportamento do script:
- Valida `ADMIN_NAME`, `ADMIN_EMAIL` e `ADMIN_PASSWORD` com o mesmo `createUserSchema` do CRUD.
- Executa transação `Serializable` criando `User` (`role: "ADMIN"`) e `Account` (`providerId: "credential"`) com hash de senha do Better Auth.
- Recusa a execução (`409`) se já existir qualquer `ADMIN` ativo ou se o e-mail já estiver cadastrado — nunca promove nem sobrescreve contas existentes.

---

## Autenticação, cookies e segurança de sessão

A autenticação é gerenciada por `src/utils/auth.ts` usando Better Auth + adaptador Prisma:

- **Fluxo de login (`POST /api/auth/sign-in/email`):** valida credenciais (`8` a `128` caracteres), verifica se o usuário está ativo, grava registro na tabela `session` e define cookie de sessão **HTTP-only**.
- **Consulta e encerramento:** `GET /api/auth/get-session` retorna `{ session, user }` (ou `null` quando não autenticado); `POST /api/auth/sign-out` remove a sessão no banco e invalida o cookie.
- **Política de sessão e cookies:** expiração em **7 dias** (`expiresIn`), renovação a cada **24 horas** (`updateAge`) e `cookieCache` **desabilitado** — toda verificação consulta o PostgreSQL, garantindo efeito imediato na revogação de sessões.
- **Superfície nativa bloqueada:** cadastro público (`disableSignUp: true`) e rotas nativas `/update-user`, `/delete-user` e `/change-email` (`disabledPaths`) estão bloqueados. Campos `role` e `isActive` possuem `input: false` no Better Auth, impedindo escalonamento de privilégio pelas rotas de autenticação.
- **Coordenação contra concorrência no login:** hooks `databaseHooks.session.create.before` e `after` impedem login de usuário inativo. No hook `after`, uma transação executa `SELECT "id" FROM "user" WHERE "id" = ... FOR UPDATE`, revalida `isActive` e remove imediatamente a sessão recém-criada caso o usuário tenha sido desativado concorrentemente.
- **Proteção contra força bruta e CSRF:** Better Auth aplica proteção de origem (`trustedOrigins: [env.FE_BASE_URL]`) e rate limit próprio em memória de **30 requisições a cada 60 segundos** nas rotas `/api/auth/*`, somado ao limite global de **500 req/min** da aplicação.

---

## Middlewares e autorização por perfis

Os controles de acesso ficam em `src/middlewares/` e nunca confiam em dados de identidade enviados no corpo ou cabeçalhos customizados pelo cliente:

1. **`requireActiveUser` (`requireActiveUser.ts`):** extrai a sessão a partir dos cookies via `auth.api.getSession`, consulta o usuário atualizado no PostgreSQL (`id`, `role`, `isActive`), responde `401` se não houver sessão válida, responde `403` se `isActive === false` e anexa `{ id, role, isActive }` em `res.locals.user`.
2. **`requireAdmin` (`requireAdmin.ts`):** exige `res.locals.user?.role === "ADMIN"`, respondendo `403` caso contrário. Usado em `/api/users`.
3. **`requireRole(...allowedRoles)` (`requireRole.ts`):** fábrica de middleware que verifica se `res.locals.user?.role` pertence à lista permitida, respondendo `403` caso contrário. Usado com `requireRole("ADMIN", "PLANNING")` em `/api/clients` e `/api/quotes`.

### Matriz de permissões por perfil

| Perfil (`UserRole`) | `/api/health` | `/api/auth/*` | `/api/users` | `/api/clients` | `/api/quotes` |
| --- | :---: | :---: | :---: | :---: | :---: |
| Público (sem sessão) | Permitido | Login / Get-Session | `401` | `401` | `401` |
| `TECHNICIAN` (ativo) | Permitido | Sessão / Logout | `403` | `403` | `403` |
| `PLANNING` (ativo) | Permitido | Sessão / Logout | `403` | Permitido | Permitido |
| `ADMIN` (ativo) | Permitido | Sessão / Logout | Permitido | Permitido | Permitido |
| Qualquer perfil inativo | Permitido | Login bloqueado (`403`) | `403` | `403` | `403` |

---

## Rotas registradas e contratos HTTP

Apenas os roteadores abaixo estão registrados em `src/app.ts` (embora `prisma/schema.prisma` já contenha tabelas para `Service`, `ServiceVisit`, `VisitTechnician`, `Warranty` e `Revision`, **não existem endpoints implementados** para esses módulos na entrega atual).

Exemplos prontos para execução manual também estão disponíveis em [`tests/client.http`](tests/client.http) e [`tests/quote.http`](tests/quote.http).

### 1. Saúde e Autenticação

| Método | Rota | Acesso | Resposta principal |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Público | `200` `{ status: "ok", message: "API is running", timestamp }` (disponibilidade HTTP; não consulta o banco) |
| `POST` | `/api/auth/sign-in/email` | Público | `200` + `Set-Cookie` HTTP-only (`body`: `{ email, password }`) |
| `GET` | `/api/auth/get-session` | Cookie opcional | `200` `{ session, user }` ou `null` |
| `POST` | `/api/auth/sign-out` | Sessão ativa | `200` revoga sessão e limpa cookie |

---

### 2. Usuários (`/api/users`) — exclusivo para `ADMIN` ativo

As rotas de criação e edição de usuários utilizam o envelope `{ "userData": { ... } }`. O hash de senha e as tabelas `account`/`session` nunca são expostos nas respostas (`userSelect`: `id`, `name`, `email`, `role`, `isActive`, `createdAt`, `updatedAt`).

| Método | Rota | Status | Contrato |
| --- | --- | --- | --- |
| `GET` | `/api/users` | `200` | Lista todos os usuários ordenados por `createdAt DESC, id ASC`. |
| `GET` | `/api/users/:id` | `200` / `404` | Retorna os campos públicos do usuário ou `404` se inexistente. |
| `POST` | `/api/users` | `201` | Cria usuário ativo + credencial. Body: `{ "userData": { "name", "email", "role", "password" } }`. |
| `PATCH` | `/api/users/:id` | `200` | Atualiza parcialmente `{ "userData": { "name"?, "email"?, "role"? } }` (ao menos 1 campo; não altera senha). |
| `PATCH` | `/api/users/:id/activate` | `204` | Define `isActive = true` (resposta sem corpo). |
| `PATCH` | `/api/users/:id/deactivate` | `204` | Define `isActive = false` e revoga todas as sessões do usuário (sem corpo). |
| `DELETE` | `/api/users/:id` | `204` | Exclusão lógica equivalente a `PATCH /api/users/:id/deactivate`. |

**Regras de segurança em `user.service.ts`:**
- Alterar `email` redefine `emailVerified = false`; alterar `email` ou `role` revoga todas as sessões ativas do usuário modificado.
- Um administrador **não pode** desativar a própria conta (`409`) nem remover o próprio perfil `ADMIN` (`409`).
- Transações com nível de isolamento `Serializable` impedem desativar ou rebaixar o último `ADMIN` ativo do sistema (`409`).

---

### 3. Clientes (`/api/clients`) — `ADMIN` ou `PLANNING` ativo

Diferentemente de `/api/users`, as rotas de clientes recebem o **objeto JSON diretamente na raiz do body** (sem envelope).

| Método | Rota | Status | Contrato |
| --- | --- | --- | --- |
| `GET` | `/api/clients` | `200` | Lista todos os clientes (ativos e inativos) por `createdAt DESC, id ASC`. |
| `GET` | `/api/clients/:id` | `200` / `404` | Busca cliente por UUID (`:id` validado como UUID). |
| `POST` | `/api/clients` | `201` | Cria cliente com `active = true`. |
| `PATCH` | `/api/clients/:id` | `200` | Atualização parcial (ao menos 1 campo válido). |
| `PATCH` | `/api/clients/:id/activate` | `200` | Reativa cliente e retorna `{ "id", "active": true }`. |
| `PATCH` | `/api/clients/:id/deactivate` | `200` | Inativa cliente e retorna `{ "id", "active": false }`. |
| `DELETE` | `/api/clients/:id` | `200` | Exclusão lógica equivalente a `deactivate`, retornando `{ "id", "active": false }`. |

**Campos aceitos no body de `POST /api/clients` (e parcialmente em `PATCH /api/clients/:id`):**
- Obrigatórios na criação: `type` (`"INDIVIDUAL"` ou `"COMPANY"`), `name` (`1..200` caracteres), `whatsapp` (telefone fixo de 10 dígitos ou celular de 11 dígitos com DDD brasileiro válido; aceita máscara ou prefixo `+55` e persiste apenas dígitos), `location` (`1..100` caracteres).
- Opcionais / anuláveis (`null`): `document` (CPF válido com dígitos verificadores para `INDIVIDUAL` ou CNPJ válido com dígitos verificadores para `COMPANY`; aceita máscara, converte `""` em `null` e persiste apenas dígitos), `contactName` (até `200`), `phone` (mesma validação de DDD + número brasileiro do `whatsapp`; `""` vira `null`), `email` (até `100`, normalizado para minúsculas; string vazia `""` é convertida em `null`; deve ser único entre clientes — `409` em duplicidade), `notes` (texto livre).

---

### 4. Orçamentos e Itens (`/api/quotes`) — `ADMIN` ou `PLANNING` ativo

| Método | Rota | Status | Contrato |
| --- | --- | --- | --- |
| `GET` | `/api/quotes` | `200` | Lista orçamentos por `createdAt DESC, id ASC`. Aceita query params opcionais `?clientId=<uuid>&status=<DRAFT\|SENT\|APPROVED\|REJECTED\|EXPIRED>`. Cada registro inclui `client: { id, name, type }` e `_count: { items }`. |
| `GET` | `/api/quotes/:id` | `200` / `404` | Retorna o orçamento completo com `client` e `items` ordenados por `createdAt ASC, id ASC`. |
| `POST` | `/api/quotes` | `201` | Cria orçamento sempre em `status: "DRAFT"`, registrando `createdBy` a partir de `res.locals.user.id`. Exige cliente existente (`404`) e ativo (`409`). |
| `PATCH` | `/api/quotes/:id` | `200` | Atualiza atomicamente `notes`, `discount` geral e/ou a coleção `items` (mantendo itens com `id`, criando novos sem `id` e removendo os omitidos) e recalcula os totais. Retorna o orçamento detalhado com `items`. |
| `DELETE` | `/api/quotes/:id` | `204` | **Exclusão física** do orçamento e de seus itens (`onDelete: Cascade`), permitida **apenas quando `status === "DRAFT"`** (`409` para outros status). |
| `POST` | `/api/quotes/:id/items` | `201` | Adiciona um item ao orçamento, recalcula totais e retorna o orçamento completo. |
| `PATCH` | `/api/quotes/:id/items/:itemId` | `200` | Atualiza parcialmente um item existente, recalcula totais e retorna o orçamento completo. |
| `DELETE` | `/api/quotes/:id/items/:itemId` | `200` | Remove um item do orçamento, recalcula totais e retorna o orçamento completo. |

#### Exemplo de criação (`POST /api/quotes`)

```json
{
  "clientId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "notes": "Instalação CFTV — proposta inicial",
  "discount": 50,
  "items": [
    {
      "type": "PRODUCT",
      "description": "Câmera IP 2MP",
      "quantity": 4,
      "unitPrice": 250.5,
      "discount": 20
    },
    {
      "type": "SERVICE",
      "description": "Instalação e configuração",
      "quantity": 1,
      "unitPrice": 400
    }
  ]
}
```

- `items` é opcional na criação (omitir ou enviar `[]` cria um rascunho vazio com totais `"0"` / `"0.00"`), limitado a **100 itens por orçamento** (`MAX_QUOTE_ITEMS = 100`).
- Em `QuoteItem`: `type` aceita `"PRODUCT"`, `"SERVICE"` ou `"OTHER"`; `description` é obrigatória; `quantity > 0`; `unitPrice >= 0`; `discount >= 0` (em R$, padrão `0`).
- Na resposta JSON, campos `Decimal` do Prisma (`subtotal`, `discount`, `total`, `quantity`, `unitPrice`) são serializados como **strings** (ex.: `"982"`, `"250.5"`), preservando precisão exata no transporte.

> **Importante — transições de status ainda não implementadas:** na entrega atual, **não existem endpoints** para enviar um orçamento (`DRAFT → SENT`), registrar a decisão do cliente (`APPROVED`, `REJECTED`, `EXPIRED`) ou anexar evidência (`decisionEvidenceUrl`). Todo orçamento criado pela API inicia e permanece em `DRAFT`.

---

## Validações, cálculos monetários e regras de orçamentos

### Schemas Zod (`src/schemas/`)

- Todos os objetos de entrada utilizam `z.strictObject(...)`, rejeitando chaves desconhecidas com `400`.
- `userIdSchema` aceita strings de `1..128` caracteres (compatível com IDs gerados pelo Better Auth); `clientIdSchema`, `quoteIdSchema` e `quoteItemIdSchema` exigem formato UUID.
- Em `quote.schema.ts`, quantidades (`> 0`, máx. `99.999.999,99`) e valores em reais (`>= 0`, máx. `9.999.999.999,99`) aceitam no máximo **2 casas decimais**.

### Cálculos com `Decimal` (`src/services/quote.calculations.ts`)

Nenhum cálculo monetário utiliza aritmética de ponto flutuante (`number`) do JavaScript. Os valores validados são convertidos para `Prisma.Decimal` e arredondados em 2 casas com `ROUND_HALF_UP`:

1. **Subtotal do item:** $\text{bruto} = \text{round2}(\text{quantity} \times \text{unitPrice})$; $\text{subtotal}_{\text{item}} = \text{bruto} - \text{discount}_{\text{item}}$.
2. **Subtotal do orçamento:** soma dos $\text{subtotal}_{\text{item}}$ de todos os itens vinculados.
3. **Total do orçamento:** $\text{total} = \text{subtotal}_{\text{orçamento}} - \text{discount}_{\text{geral}}$ (o total é sempre calculado no servidor e nunca aceito como campo livre do cliente).
4. **Violações aritméticas (`422`):** se o desconto do item superar `quantidade × valor unitário`, se o desconto geral superar o subtotal do orçamento ou se qualquer subtotal ultrapassar a capacidade de `Decimal(12, 2)` (`R$ 9.999.999.999,99`), a API rejeita a operação com HTTP `422`.

### Restrições de edição, exclusão e concorrência (`src/services/quote.service.ts`)

- **Cliente ativo na abertura:** `POST /api/quotes` retorna `409` se o cliente estiver com `active = false`.
- **Orçamentos editáveis (`isOpen`):** atualizações de cabeçalho (`PATCH /:id`) e mutações de itens (`POST/PATCH/DELETE /:id/items`) só são permitidas enquanto o orçamento estiver em `DRAFT` ou `SENT`. Caso o registro esteja em `APPROVED`, `REJECTED` ou `EXPIRED`, a API responde `409`.
- **Mínimo de itens em orçamento enviado:** se um orçamento estiver com `status === "SENT"`, remover seu último item retorna `409` (`"Um orçamento enviado precisa ter pelo menos um item"`).
- **Exclusão restrita a rascunhos:** `DELETE /api/quotes/:id` exige `status === "DRAFT"`; qualquer outro status retorna `409`.
- **Serialização por orçamento:** toda mutação em um orçamento existente abre transação e adquire bloqueio pessimista na linha pai (`SELECT "id" FROM "quote" WHERE "id" = ...::uuid FOR UPDATE`) antes de validar status, limite de 100 itens e recalcular totais, evitando totais inconsistentes em requisições simultâneas.

---

## Códigos HTTP e tratamento de erros

`src/middlewares/ErrorHandler.ts` centraliza as respostas de erro das rotas da aplicação no formato `{ "error": "mensagem", "fields"?: [{ "path", "message" }] }`, enquanto `/api/auth/*` utiliza o formato nativo do Better Auth (`{ "code", "message" }`):

| Código | Cenário na API |
| --- | --- |
| `200` | Consultas `GET`, edições `PATCH` de usuários/clientes/orçamentos/itens, ativação/inativação de clientes e remoção de item de orçamento |
| `201` | Criação de usuário, cliente, orçamento ou item de orçamento |
| `204` | Ativação/desativação/`DELETE` de usuário e `DELETE` de orçamento em rascunho |
| `400` | Falha de validação Zod (inclui array `fields`), JSON malformado ou chave estrangeira inválida (`P2003`) |
| `401` | Sessão ausente/inválida ou falha de credenciais no login |
| `403` | Usuário autenticado inativo ou perfil sem permissão para a rota |
| `404` | Registro não encontrado (`AppError` ou código Prisma `P2025`) |
| `409` | E-mail duplicado (`P2002` / validação de negócio), conflito transacional (`P2034`), proteção de administrador, cliente inativo ao orçar, limite de 100 itens atingido ou violação de status de orçamento |
| `413` | Corpo JSON acima do limite de `100kb` |
| `422` | Desconto maior que o valor bruto/subtotal ou estouro do limite monetário `Decimal(12, 2)` |
| `429` | Limite de requisições atingido (global ou de autenticação) |
| `500` | Erro interno inesperado (retorna mensagem genérica `"Erro interno"`, sem expor stack trace ou detalhes SQL/Prisma) |

---

## Estrutura do código e Prisma

```text
api/
├── prisma/
│   ├── schema.prisma               # Modelos Better Auth + entidades de negócio e enums
│   └── migrations/                 # 4 migrations SQL versionadas aplicadas em ordem
├── prisma.config.ts                # Configuração do Prisma CLI (lê DATABASE_URL)
├── src/
│   ├── index.ts                    # Inicializa o listener HTTP na porta configurada
│   ├── app.ts                      # Registra middlewares globais, Better Auth e rotas
│   ├── config/env.ts               # Validação Zod das variáveis de ambiente
│   ├── lib/prisma.ts               # Instância compartilhada de PrismaClient com PrismaPg
│   ├── middlewares/                # requireActiveUser, requireAdmin, requireRole e ErrorHandler
│   ├── routes/                     # health.route, user.route, client.route e quote.route
│   ├── controllers/                # user.controller, client.controller e quote.controller
│   ├── schemas/                    # user.schema, client.schema e quote.schema (Zod)
│   ├── services/                   # user.service, client.service, quote.service e quote.calculations
│   ├── scripts/create-admin.ts     # Script CLI de criação do primeiro administrador
│   └── utils/                      # auth (Better Auth), cors, rateLimit e AppError
└── tests/
    ├── client.http                 # Exemplos manuais HTTP do CRUD de clientes
    └── quote.http                  # Exemplos manuais HTTP e cenários de borda de orçamentos
```

### Configuração e migrations do Prisma

- O cliente tipado é gerado em `api/generated/prisma` (diretório ignorado pelo Git e recriado por `npm run db:generate --prefix api` — nunca o edite manualmente).
- As migrations existentes em [`prisma/migrations/`](prisma/migrations/README.md) criam as tabelas de negócio iniciais, adaptam a tabela `user` e criam `session`/`account`/`verification` para o Better Auth, adicionam `is_active` e reintroduzem `role` com padrão `TECHNICIAN`.
- Aplique migrations existentes sempre com `npm run db:migrate --prefix api` (`prisma migrate deploy`). Nunca reescreva migrations já versionadas nem execute `migrate reset` em bancos com dados que devam ser preservados.

---

## Comandos de execução, validação e testes

Executados a partir da raiz do repositório:

| Comando | Descrição |
| --- | --- |
| `npm run dev --prefix api` | Inicia a API em modo desenvolvimento com recarga automática (`tsx watch`) |
| `npm run build --prefix api` | Compila TypeScript para `api/dist/` (`tsconfig.build.json`) |
| `npm run start --prefix api` | Executa o build compilado (`node dist/src/index.js`) |
| `npm run lint --prefix api` | Executa o ESLint no pacote da API |
| `npm run typecheck --prefix api` | Verifica tipos TypeScript sem emitir arquivos (`tsc --noEmit`) |
| `npm run check:api` | Executa `lint`, `typecheck` e `build` em sequência |
| `npm run db:validate --prefix api` | Valida a sintaxe e relações de `prisma/schema.prisma` |
| `npm run db:generate --prefix api` | Gera o cliente Prisma tipado em `api/generated/prisma` |
| `npm run db:migrate --prefix api` | Aplica as migrations pendentes no PostgreSQL (`prisma migrate deploy`) |
| `npm run admin:create --prefix api` | Cria o administrador inicial usando `ADMIN_NAME`, `ADMIN_EMAIL` e `ADMIN_PASSWORD` |
| `npm test --prefix api` | Executa a suíte de testes automatizados (`vitest run`) |

---

## Resolução de problemas comuns

- **`Configuração inválida: BETTER_AUTH_SECRET...`:** verifique se `api/.env` existe e se `BETTER_AUTH_SECRET` possui pelo menos 32 caracteres.
- **Falha de conexão com o banco:** confirme se o container `db` está saudável (`docker compose ps`). Fora do Docker use `localhost:5432`; dentro do Compose o host é `db:5432`.
- **Erro de módulo em `generated/prisma` ou coluna inexistente:** rode `npm run db:generate --prefix api` e `npm run db:migrate --prefix api`, reiniciando o processo da API em seguida.
- **Sessão não enviada pelo navegador:** confira `credentials: "include"` no `fetch`, `FE_BASE_URL` compatível com o endereço real do frontend e consistência entre `localhost` e `127.0.0.1` (são hosts distintos para cookies).
- **Status `429` em testes repetidos:** aguarde a janela de 60 segundos do rate limiter em memória (30 tentativas nas rotas `/api/auth/*` ou 500 requisições gerais por minuto).
## Testes automatizados

A API conta com testes automatizados desenvolvidos com **Vitest**, **Supertest**, **Prisma** e **PostgreSQL**, estruturados em testes unitários e de integração.

### Tecnologias e pré-requisitos

- **Node.js 24** e dependências instaladas (`npm ci --prefix api`).
- **Prisma Client** gerado (`npm run db:generate --prefix api`).
- **Docker** com daemon em execução (necessário apenas para os testes de integração).

### Comandos de execução

```bash
# Executa toda a suíte (unitários e integração)
npm test --prefix api

# Executa apenas os testes unitários (não requer Docker nem banco de dados)
npm run test:unit --prefix api

# Executa apenas os testes de integração (requer Docker para o banco isolado)
npm run test:integration --prefix api
```

### Diferença entre testes unitários e de integração

- **Testes unitários (`*.unit.test.ts`):** avaliam funções puras de regras de negócio e validação (cálculos de itens/totais de orçamentos em R$ e dígitos verificadores de CPF/CNPJ + DDD/telefone brasileiro) em memória, sem depender de banco de dados ou Docker.
- **Testes de integração (`*.integration.test.ts`):** validam requisições HTTP reais com Supertest contra o servidor Express, cobrindo autenticação por cookies com Better Auth, autorização por perfil (RBAC), validação com Zod e persistência real no PostgreSQL.

### Principais testes cobertos

1. **Permissões (RBAC):** valida o controle de acesso por perfil (`ADMIN`, `PLANNING` e `TECHNICIAN`), comprovando que técnicos autenticados recebem HTTP `403 Forbidden` ao tentar operações de planejamento ou administrativas, e requisições anônimas recebem HTTP `401 Unauthorized`.
2. **Validação de clientes e CRUD (`client.validation.unit.test.ts` e `client.integration.test.ts`):** valida dígitos verificadores de CPF/CNPJ, compatibilidade entre `type` (`INDIVIDUAL`/`COMPANY`) e documento, DDD e formato de telefone/WhatsApp brasileiro (incluindo normalização de `+55`), além de criação, edição parcial e inativação lógica.
3. **Cálculo e CRUD de orçamentos (`quote.calculations.unit.test.ts` e `quote.integration.test.ts`):** valida as regras de `quote.calculations.ts` com tipos `Decimal` em `R$` (quantidade × valor unitário, desconto de item em `R$`, soma de subtotais, desconto geral em `R$`, total líquido e rejeição de descontos superiores ao subtotal) e o ciclo completo via HTTP/PostgreSQL (criação em `DRAFT`, atualização atômica de cabeçalho e itens em `PATCH /api/quotes/:id` com rollback transacional em falhas e exclusão de rascunho).

### Banco descartável para integração

A infraestrutura em `tests/global-setup.ts` inicializa um container PostgreSQL (`postgres:17-alpine`) descartável em porta dinâmica de loopback (`127.0.0.1`), aplica as migrations necessárias via `prisma migrate deploy` e descarta o container ao final dos testes ou em interrupções (`SIGINT`/`SIGTERM`). Se o Docker não estiver em execução, uma mensagem clara orienta o desenvolvedor. Nenhum banco de desenvolvimento ou produção é utilizado.

### Execução no GitHub Actions (CI)

No workflow `.github/workflows/ci.yml`, o job `api` executa `npm test` após as etapas de `lint`, `typecheck` e `build`. No ambiente do runner (`ubuntu-latest`), o Docker já está disponível, permitindo a execução automática tanto dos testes unitários quanto dos de integração sem necessidade de secrets de produção.

## Problemas comuns

- **Configuração inválida:** revise os nomes de variáveis indicados, incluindo o
  secret com ao menos 32 caracteres. O erro não imprime seus valores.
- **Banco inacessível:** confirme `docker compose ps` e porta/credenciais; no host
  use `localhost`, dentro do Compose use `db`.
- **Coluna ausente:** aplique `db:migrate` e gere o cliente; reinicie a API.
- **Login inválido:** confirme que o usuário tem conta `credential`; só criar uma
  linha em `user` não cria uma senha.
- **Sessão perdida:** confira cookies, `credentials: include`, origem permitida,
  URL da API e se o secret mudou. `localhost` e `127.0.0.1` são hosts distintos.
- **403 no CRUD:** confira perfil `ADMIN` e `isActive=true`.
- **429 na demonstração:** aguarde a janela do rate limiter; ele guarda contadores
  em memória e não é distribuído entre várias instâncias.
