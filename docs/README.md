# Índice da Documentação — TechPro App

Este diretório reúne os artefatos de descoberta, especificação de requisitos e operação do **TechPro App**, servindo como índice central da documentação do repositório na **entrega final**.

> **Como ler esta documentação:** os documentos de descoberta e requisitos preservam a visão completa do produto originalmente planejado, enquanto os guias técnicos descrevem o que está efetivamente implementado no código da branch `main`. A matriz de entrega e os status do PRD distinguem o escopo inicialmente planejado da implementação final. Todos os documentos necessários à entrega acadêmica estão versionados neste repositório.

---

## 1. Requisitos de produto e descoberta

Documentos produzidos nas etapas de levantamento com o cliente e especificação do sistema:

- **[Documento de Requisitos (PRD)](documento-requisitos.md)** — problema de negócio, escopo do MVP, atores, requisitos funcionais (`RF01`–`RF23`) e não funcionais (`RNF01`–`RNF15`), histórias de usuário, casos de uso, diagrama entidade-relacionamento e glossário.
- **[Modelagem de dados](modelagem-dados.md)** — DER complementar ao oficial, dicionário de entidades, restrições e fluxo implementado, com referência ao schema e migrations.
- **[Contexto do cliente](contexto-cliente.md)** — levantamento prévio sobre a atuação, serviços, público e presença institucional da TechPro (Sprint 0).
- **[Perguntas ao cliente](perguntas-cliente.md)** — roteiro utilizado na entrevista de descoberta para mapear gargalos operacionais e prioridades.

---

## 2. Estado da entrega final

A [matriz de entrega final](entrega-final.md) é a fonte de referência para funcionalidades integradas, cobertura parcial, PRs e pendências pós-MVP. A documentação de requisitos mantém a visão original para preservar a rastreabilidade.

- [API de serviços](service-api.md)
- [Fluxo de decisões de orçamento](quote-workflow.md)
- [API de garantias, revisões e alertas](aftercare-api.md)
- [Evidências de orçamento via S3/RustFS](quote-evidence.md)
- [Contrato da API de visitas](visit-api.md)
- [Guia das interfaces de serviços e visitas](../frontend/README.md#integração-com-a-api-serviços-e-visitas)

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
- **Suíte de testes automatizados da API:** integrada à `main` (PR #54) e ampliada pelos PRs #110, #112, #113, #114 e #116, executada automaticamente no CI ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)):
  - [`api/tests/client.validation.unit.test.ts`](../api/tests/client.validation.unit.test.ts) — validação unitária de CPF/CNPJ e telefones brasileiros.
  - [`api/tests/quote.calculations.unit.test.ts`](../api/tests/quote.calculations.unit.test.ts) — regras de negócio e cálculos de orçamentos com tipos Decimal em R$.
  - [`api/tests/client.integration.test.ts`](../api/tests/client.integration.test.ts) — testes de integração HTTP, autenticação, perfis e CRUD de clientes.
  - [`api/tests/quote.integration.test.ts`](../api/tests/quote.integration.test.ts) — testes de integração HTTP, permissões RBAC e transações de orçamentos.
  - [`api/tests/quote-status.integration.test.ts`](../api/tests/quote-status.integration.test.ts) — transições e autorização de orçamentos.
  - [`api/tests/service.integration.test.ts`](../api/tests/service.integration.test.ts) — serviços, concorrência e vínculo com orçamento.
  - [`api/tests/visit.integration.test.ts`](../api/tests/visit.integration.test.ts) — agendamento, vínculos, conflitos e autorização.
  - [`api/tests/aftercare.integration.test.ts`](../api/tests/aftercare.integration.test.ts) e [`operational.unit.test.ts`](../api/tests/operational.unit.test.ts) — garantias, revisões, alertas e datas.
  - [`api/tests/quote-evidence.integration.test.ts`](../api/tests/quote-evidence.integration.test.ts) e [`evidence-validation.unit.test.ts`](../api/tests/evidence-validation.unit.test.ts) — evidências privadas e validação de arquivos.
- **[CI/CD e Deploy na VM (`deploy.md`)](deploy.md)** — pipeline completo do GitHub Actions (`CI` → `Notify central CD`), integração com o repositório privado `univates-deadlock/deadlock-deploy`, operação do runner self-hosted na VM, Docker Compose, proxy reverso Caddy central e requisitos de variáveis de ambiente.

---

## 5. Evolução pós-MVP

Consulte a [matriz de entrega final e backlog](entrega-final.md), que consolida pendências de interface, API, QA e infraestrutura, além dos itens originalmente fora do escopo.
