# Frontend TechPro

Aplicação web interna construída com **Next.js 16 (App Router)**, **React 19**, **TypeScript**, **Tailwind CSS 4**, **Zod 4** e **Better Auth Client**. Para executar a stack completa via Docker Compose, consulte primeiro o [README principal](../README.md).

---

## Funcionalidades implementadas no frontend

- **Autenticação (`/login`):** validação local com Zod, bloqueio contra duplo envio, tratamento distinto para credenciais inválidas (`400`/`401`), usuário inativo (`403`), excesso de tentativas (`429`) e indisponibilidade da API, acessibilidade por teclado (`aria-invalid`, `aria-describedby`, `role="alert"`) e layout responsivo (painel institucional lateral a partir de `1024px` e banner compacto em telas menores).
- **Shell autenticado (`app/(protected)/layout.tsx`):** verificação de sessão ativa no servidor via `requireActiveSession()` antes de renderizar qualquer rota interna, barra lateral responsiva (`AppSidebar`) que filtra itens conforme o perfil da sessão SSR (`Usuários` visível apenas para `ADMIN`; `Clientes`, `Orçamentos`, `Garantias` e `Revisões` visíveis apenas para `ADMIN` e `PLANNING`), proteção SSR por rota via `requireRoleSession()` (redirecionando perfis não autorizados para `/`) e cabeçalho (`AppHeader`) com encerramento de sessão.
- **Dashboard operacional (`/`):** indicadores comerciais e operacionais reais (`GET /api/quotes` e `GET /api/dashboard`) para ADMIN/PLANNING; para `TECHNICIAN`, painel operacional com atalho para a agenda de visitas (`/visitas`), cuja consulta própria permanece futura.
- **Gestão de usuários (`/usuarios`):** listagem, cadastro com senha inicial, edição de nome/e-mail/perfil (sem alteração de senha) e ativação/desativação em modal acessível (`ADMIN`).
- **Gestão de clientes (`/clientes`):** listagem, busca local por nome ou CPF/CNPJ, cadastro e edição com máscaras e validação de dígitos verificadores de CPF/CNPJ e DDD/telefone brasileiro (enviando apenas dígitos para a API) e ativação/inativação (`ADMIN` e `PLANNING`).
- **Gestão de orçamentos (`/orcamentos` e `/orcamentos/[id]`):** listagem com busca por cliente/código e filtro por status, criação de orçamento em rascunho (`DRAFT`) para clientes ativos, edição atômica de observações, desconto geral em `R$` e itens com desconto em `R$` (em `/orcamentos` e `/orcamentos/[id]` enquanto em aberto), exclusão com confirmação para rascunhos (`DRAFT`) e tela detalhada (`/orcamentos/[id]`) com itens, resumo financeiro discriminando descontos por item e desconto geral em `R$`, e histórico (`ADMIN` e `PLANNING`).
- **Garantias (`/garantias`) e revisões (`/revisoes`):** listagem, cadastro e edição com API real, seleção de serviço e mudança de status de revisões; acesso ADMIN/PLANNING.
- **Gestão de serviços (`/servicos`):** listagem com filtros (busca por título/OS/cliente, status, origem e período planejado), cadastro a partir de orçamento aprovado ou direto (origem `QUOTE` exige orçamento aprovado e as demais exigem cliente — RN-SRV-01), edição de serviços abertos, referência opcional à OS externa (sempre editável, RN-SRV-02) e transições de status `PLANNED → IN_PROGRESS → COMPLETED` ou `CANCELLED`, espelhando o contrato da API em `main` (`ADMIN` e `PLANNING`); dados via `lib/services-data.ts`.
- **Agenda de visitas (`/visitas`):** `ADMIN`/`PLANNING` visualizam a agenda completa por dia, agendam visitas para serviços abertos com um ou mais técnicos (RN-SRV-03), recebem o aviso de conflito de horário com confirmação explícita (`confirmConflicts`), editam horário e texto (técnicos em leitura na edição: o `PUT /api/visits/:id/technicians` é bloqueado no navegador pelo CORS da API até o backend listar o método) e filtram por técnico, status e período. Os fluxos de execução e cancelamento ficam ocultos (`VISIT_EXECUTION_API_ENABLED`) por serem pós-MVP (`docs/entrega-final.md`); a agenda individual do técnico aguarda a API (#74). Dados via `lib/visits-data.ts`.

> **Autorização:** ocultar itens de navegação ou botões melhora a experiência de uso, mas o controle de acesso efetivo ocorre no backend (`401`/`403`).

---

## Execução local e variáveis de ambiente

Para rodar apenas o frontend no host (com Node.js 24 e a API em execução):

```bash
npm run install:all
npm run dev --prefix frontend
```

Acesse `http://localhost:3000`. Os scripts `dev` e `build` utilizam explicitamente `--webpack` (`next dev --webpack` e `next build --webpack`) para garantir compatibilidade estável com a importação do Tailwind CSS 4 no ambiente validado com Docker.

| Variável | Escopo | Padrão | Finalidade |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Navegador e SSR | `http://localhost:4000` | URL base da API acessível pelo navegador |
| `API_INTERNAL_URL` | Apenas servidor (SSR) | fallback para `NEXT_PUBLIC_API_URL` | URL interna da API usada por `requireActiveSession()` (no Docker Compose: `http://api:4000`) |

- Em desenvolvimento fora do Docker, é possível definir `NEXT_PUBLIC_API_URL=http://localhost:4000` em `frontend/.env.local`.
- Use o mesmo host (`localhost`) no navegador e nas variáveis de ambiente para que o cookie HTTP-only da sessão seja compartilhado corretamente.
- **Nunca** exponha `BETTER_AUTH_SECRET`, credenciais de banco ou tokens internos em variáveis prefixadas com `NEXT_PUBLIC_`.

---

## Sessão, chamadas à API e precisão monetária

1. **Proteção SSR (`lib/auth-server.ts`):** `app/(protected)/layout.tsx` executa `requireActiveSession()` no servidor, encaminhando o cabeçalho `cookie` para `GET /api/auth/get-session` com `cache: "no-store"`. Sessões ausentes, inválidas ou com `isActive !== true` redirecionam imediatamente para `/login`; páginas restritas a perfis específicos chamam `requireRoleSession()`, redirecionando acessos sem permissão para `/`. Se a API estiver inacessível, o layout falha fechado sem exibir dados internos.
2. **Cliente de autenticação no navegador (`lib/auth-client.ts`):** instancia `createAuthClient` do Better Auth com `credentials: "include"` para login e logout.
3. **Chamadas aos CRUDs:** todas as requisições `fetch` para `/api/users`, `/api/clients` e `/api/quotes` enviam `credentials: "include"`. Erros das rotas de autenticação expõem `message`; erros dos CRUDs seguem `{ error, fields? }`.
4. **Valores monetários (`lib/quotes.ts` e `lib/money.ts`):** a API serializa colunas `Decimal` do Prisma como strings; `lib/quotes.ts` converte esses valores para **centavos inteiros** na fronteira de entrada, evitando erros de ponto flutuante na interface.

Consulte todos os contratos de rotas, payloads e códigos de status no [README da API](../api/README.md).

---

## Integração com a API (serviços e visitas)

As telas de serviços e visitas chamam a API real por clientes HTTP dedicados (`lib/services-data.ts` e `lib/visits-data.ts`, no mesmo padrão de `lib/quotes.ts`) — não há dados fictícios nem camada de fallback. Estado atual:

1. **Serviços** — o contrato está na `main` (`api/src/routes/service.route.ts`, PR #112): `GET/POST /api/services`, `PATCH /api/services/:id` e `PATCH /api/services/:id/status`.
2. **Visitas** — o contrato está na `main` (`api/src/routes/visit.route.ts`, PR #116): `GET/POST /api/services/:serviceId/visits`, `GET /api/visits` (filtros por serviço, técnico, status e período), `PATCH /api/visits/:id` e `PUT /api/visits/:id/technicians`. O `PUT` é bloqueado no navegador pelo CORS da API (que não lista o método) até correção do backend; por isso os técnicos ficam em leitura na edição. `GET /api/technicians` ainda não existe: `ADMIN` usa o fallback de `GET /api/users` (filtro no cliente) e `PLANNING` vê um aviso de indisponibilidade.
3. Enquanto uma rota não existe, a tela exibe mensagem genérica (404 → "Serviço indisponível. Contate o administrador."; falha de rede → "Não foi possível falar com o servidor") — nunca detalhes internos como branches ou paths; comportamento aceito em desenvolvimento, e em produção as rotas já devem existir.

---

## Estrutura de pastas e validação

```text
frontend/
├── app/
│   ├── layout.tsx                  # Layout raiz (pt-BR, fonte Rubik e estilos globais)
│   ├── globals.css                 # Tokens visuais do tema TechPro e utilitários de tabela
│   ├── login/page.tsx              # Página pública de login
│   └── (protected)/                # Grupo autenticado protegido por requireActiveSession()
│       ├── layout.tsx              # Verificação SSR de sessão e montagem do AppShell
│       ├── page.tsx                # Dashboard operacional (indicadores comerciais e operacionais)
│       ├── usuarios/page.tsx       # Tela do CRUD de usuários
│       ├── clientes/page.tsx       # Tela do CRUD de clientes
│       ├── orcamentos/             # Listagem/formulário e detalhe (/orcamentos/[id])
│       ├── servicos/               # Gestão de serviços (ADMIN e PLANNING)
│       ├── visitas/                # Agenda de visitas por perfil
│       └── garantias/ e revisoes/  # Telas integradas à API
│       └── garantias|revisoes/     # Placeholders DevPage
├── components/
│   ├── dashboard/                  # DashboardQuotesView (visão comercial de orçamentos)
│   ├── layout/                     # AppShell, AppSidebar, AppHeader e DevPage
│   ├── login/                      # LoginBrandPanel e LoginForm
│   ├── usuarios/                   # UsuariosPageClient
│   ├── clientes/                   # ClientesPageClient
│   ├── orcamentos/                 # OrcamentosPageQuote, QuoteFormModal e QuoteDetailPageClient
│   ├── servicos/                   # ServicosPageClient e ServiceFormModal
│   ├── visitas/                    # VisitasPageClient, VisitFormModal e VisitExecutionModal
│   └── ui/                         # Alert, Badge, Button, Card, Field, Modal, PageHeader e ícones
└── lib/                            # auth, quotes, money, masks, schemas, dates e clientes HTTP (services-data, visits-data)
```

Para validar lint, tipagem TypeScript e build de produção a partir da raiz do repositório:

```bash
npm run check:frontend
```

> Não há suíte de testes automatizados de frontend na branch `main`.
