# Índice da Documentação — TechPro App

Este diretório reúne os artefatos de descoberta, especificação de requisitos e operação do **TechPro App**, servindo como índice central da documentação do repositório na entrega da **Parcial 2**.

> **Como ler esta documentação:** os documentos de descoberta e requisitos preservam a visão completa do produto planejado (MVP), enquanto os guias técnicos descrevem o que está efetivamente implementado no código da branch `main`. Não utilize o PRD como evidência de funcionalidade concluída sem verificar a matriz abaixo ou o código-fonte.

---

## 1. Requisitos de produto e descoberta

Documentos produzidos nas etapas de levantamento com o cliente e especificação do sistema:

- **[Documento de Requisitos (PRD)](documento-requisitos.md)** — problema de negócio, escopo do MVP, atores, requisitos funcionais (`RF01`–`RF23`) e não funcionais (`RNF01`–`RNF15`), histórias de usuário, casos de uso, diagrama entidade-relacionamento e glossário.
- **[Contexto do cliente](contexto-cliente.md)** — levantamento prévio sobre a atuação, serviços, público e presença institucional da TechPro (Sprint 0).
- **[Perguntas ao cliente](perguntas-cliente.md)** — roteiro utilizado na entrevista de descoberta para mapear gargalos operacionais e prioridades.

---

## 2. Funcionalidades implementadas (estado atual — Parcial 2)

Resumo auditado da branch `main`, distinguindo a entrega real do escopo planejado:

| Categoria | Módulos / recursos | Referência técnica |
| --- | --- | --- |
| **Implementada e integrada ao frontend** | Autenticação/sessão (Better Auth + proteção SSR), CRUD de usuários (`/usuarios`), CRUD de clientes (`/clientes`) e CRUD de orçamentos e itens em rascunho/elaboração (`/orcamentos` e `/orcamentos/[id]`). | [`../README.md`](../README.md), [`../api/README.md`](../api/README.md), [`../frontend/README.md`](../frontend/README.md) |
| **Implementada apenas no backend** | Health check (`GET /api/health`), filtros de query em `GET /api/quotes` (`clientId`, `status`), busca individual por ID em usuários e clientes, rotas `DELETE` lógicas equivalentes a `deactivate` e suíte de testes automatizados da API. | [`../api/README.md`](../api/README.md), [`../api/tests/`](../api/tests/) |
| **Parcialmente implementada** | Ciclo de decisão de orçamento (regras de bloqueio pós-decisão prontas, mas sem endpoints/ações de envio `SENT`, decisão ou evidência), Dashboard `/` (indicadores reais de orçamentos para `ADMIN`/`PLANNING` e visão operacional limpa para `TECHNICIAN`, sem serviços/garantias/revisões) e perfil `TECHNICIAN` (páginas restritas ocultas na interface e bloqueadas com `403` na API, aguardando telas próprias de agenda/visitas). | [`../api/README.md`](../api/README.md), [`../frontend/README.md`](../frontend/README.md) |
| **Apenas modelada no banco de dados** | Tabelas e enums `Service`, `ServiceVisit`, `VisitTechnician`, `Warranty` e `Revision` (telas `/servicos`, `/garantias` e `/revisoes` exibem `DevPage`). | [`../api/prisma/README.md`](../api/prisma/README.md) |
| **Planejada e ainda não implementada** | Transições/evidências de orçamento, execução de serviços/visitas e agenda do técnico, garantias, revisões, alertas internos, troca/recuperação de senha, página institucional e módulo opcional de licitações. | [`documento-requisitos.md`](documento-requisitos.md) |

> **Nota sobre contratos e testes:** os antigos arquivos `docs/api-usuarios.md`, `docs/api-clientes.md` e `docs/validacao-demonstracao.md` foram removidos na reorganização documental (PR #38). Todos os contratos HTTP atualizados de usuários, clientes e orçamentos estão consolidados em [`../api/README.md`](../api/README.md). A suíte de testes automatizados da API está implementada em [`../api/tests/`](../api/tests/), dividida em testes unitários ([`client.validation.unit.test.ts`](../api/tests/client.validation.unit.test.ts) e [`quote.calculations.unit.test.ts`](../api/tests/quote.calculations.unit.test.ts)) e de integração ([`client.integration.test.ts`](../api/tests/client.integration.test.ts) e [`quote.integration.test.ts`](../api/tests/quote.integration.test.ts)).

---

- **[Fluxo de decisões de orçamento (PR #108)](quote-workflow.md)** — contrato da interface, pré-condições e teste de integração das ações críticas; depende da consolidação com PR #110.

---

## 3. Arquitetura e decisões técnicas

Guias que detalham a implementação interna e a organização em camadas de cada pacote:

- **[Visão geral do projeto (`README.md`)](../README.md)** — arquitetura cliente-servidor, tecnologias, perfis de acesso e estrutura do repositório.
- **[Guia da API (`api/README.md`)](../api/README.md)** — pipeline Express 5, sessão/cookies com Better Auth, middlewares de autorização, contratos completos dos endpoints, validação Zod, cálculos monetários com `Prisma.Decimal` e tratamento de erros.
  - Camadas internas da API: [`api/src/README.md`](../api/src/README.md), [`config`](../api/src/config/README.md), [`routes`](../api/src/routes/README.md), [`middlewares`](../api/src/middlewares/README.md), [`controllers`](../api/src/controllers/README.md), [`schemas`](../api/src/schemas/README.md), [`services`](../api/src/services/README.md), [`lib`](../api/src/lib/README.md), [`utils`](../api/src/utils/README.md) e [`scripts`](../api/src/scripts/README.md).
- **[Banco de dados e Prisma (`api/prisma/README.md`)](../api/prisma/README.md)** e **[Histórico de migrations](../api/prisma/migrations/README.md)** — estrutura relacional e regras de versionamento do banco PostgreSQL.
- **[Guia do Frontend (`frontend/README.md`)](../frontend/README.md)** — páginas do Next.js App Router ([`frontend/app/README.md`](../frontend/app/README.md)), clientes de API/sessão, máscaras e cálculos em centavos ([`frontend/lib/README.md`](../frontend/lib/README.md)).

---

## 4. Procedimentos de desenvolvimento, testes e implantação

- **[Execução local e checagens (`README.md`)](../README.md#8-pré-requisitos-e-configuração-do-ambiente)** — configuração de `api/.env` e `.env`, criação da rede Docker `deadlock_edge`, provisionamento do primeiro administrador (`admin:create`), comandos `npm run check` e execução da suíte de testes automatizados (`npm test --prefix api`).
- **Suíte de testes automatizados da API:** integrada à `main` (PR #54) e executada automaticamente no CI ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)):
  - [`api/tests/client.validation.unit.test.ts`](../api/tests/client.validation.unit.test.ts) — validação unitária de CPF/CNPJ e telefones brasileiros.
  - [`api/tests/quote.calculations.unit.test.ts`](../api/tests/quote.calculations.unit.test.ts) — regras de negócio e cálculos de orçamentos com tipos Decimal em R$.
  - [`api/tests/client.integration.test.ts`](../api/tests/client.integration.test.ts) — testes de integração HTTP, autenticação, perfis e CRUD de clientes.
  - [`api/tests/quote.integration.test.ts`](../api/tests/quote.integration.test.ts) — testes de integração HTTP, permissões RBAC e transações de orçamentos.
- **[CI/CD e Deploy na VM (`deploy.md`)](deploy.md)** — pipeline completo do GitHub Actions (`CI` → `Notify central CD`), integração com o repositório privado `univates-deadlock/deadlock-deploy`, operação do runner self-hosted na VM, Docker Compose, proxy reverso Caddy central e requisitos de variáveis de ambiente.

---

## 5. Funcionalidades futuras e fronteiras do sistema

- **Próximas entregas do MVP:** endpoints e fluxos de UI para envio e decisão de orçamentos (com evidência opcional), abertura e planejamento de serviços (a partir de orçamento aprovado ou diretos), agendamento de visitas e alocação de técnicos, visão operacional do técnico, controle de garantias (serviço vs. fabricante), revisões programadas e alertas no painel operacional.
- **Opcional do MVP:** acompanhamento manual de licitações (`RF`/escopo adicional descrito na seção 5.2 do PRD).
- **Fora do MVP:** substituição ou sincronização automática com o sistema externo de estoque/OS oficial da TechPro, disparo automático de mensagens por WhatsApp/e-mail e portal externo para clientes.
