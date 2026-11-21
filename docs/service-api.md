# API de serviços — fluxo crítico

Este guia acompanha a implementação de serviços no PR #112. Os contratos
descrevem a **branch de desenvolvimento**, não uma funcionalidade já
publicada em produção. As regras seguem o PRD (RN-SRV-01 / RN-SRV-02).

## Autorização e rotas

Todas as rotas exigem sessão ativa com perfil **ADMIN** ou **PLANNING**.
Sem sessão: HTTP 401; TECHNICIAN: HTTP 403.

| Método | Rota | Uso |
| --- | --- | --- |
| GET | /api/services | Listar, com filtros clientId, status, origin, q, from, to |
| GET | /api/services/:id | Detalhar com visitas e técnicos vinculados |
| POST | /api/services | Criar serviço direto ou oriundo de orçamento |
| PATCH | /api/services/:id | Alterar título, descrição, datas ou OS externa |
| PATCH | /api/services/:id/status | Alterar status operacional |

Exemplo de atendimento direto, independente de orçamento:

```json
{
  "origin": "SUPPORT",
  "clientId": "<uuid-do-cliente>",
  "title": "Instalação de câmera",
  "externalOsNumber": "OS-2026-001"
}
```

Exemplo de serviço derivado de orçamento aprovado:

```json
{
  "origin": "QUOTE",
  "quoteId": "<uuid-do-orcamento-aprovado>",
  "title": "Instalação aprovada"
}
```

O backend associa o cliente do próprio orçamento (não do navegador). A origem
QUOTE exige orçamento APPROVED e impede mais de um serviço por orçamento,
inclusive quando duas requisições tentam criá-lo simultaneamente. Cliente
inativo não pode originar serviço. A OS externa é apenas uma referência
manual: este módulo não altera a OS oficial do cliente.

## Status e integridade

As transições permitidas são PLANNED → IN_PROGRESS ou CANCELLED e
IN_PROGRESS → COMPLETED ou CANCELLED. COMPLETED e CANCELLED são estados
finais. Após encerramento, somente externalOsNumber pode ser corrigido.
Ao concluir, completedAt é preenchido pelo servidor.

As datas plannedStart/plannedEnd exigem ISO 8601 com offset, quando informadas.
O término não pode anteceder o início, inclusive em atualização parcial.
Entrada inválida recebe HTTP 400/422, conforme validação. Transições
proibidas, cliente inativo e duplicidade de vínculo retornam 409.

## Testes de integração (críticos)

Arquivo: [service.integration.test.ts](../api/tests/service.integration.test.ts).

A suíte cobre exclusivamente os riscos com maior impacto:

- Criar serviço direto para cliente ativo e registrar createdBy da sessão;
  bloquear cliente inativo sem criar novo registro.
- Recusar orçamento rejeitado e garantir que duas solicitações concorrentes
  não criem serviços duplicados para um orçamento aprovado.
- Validar PLANNED → IN_PROGRESS → COMPLETED, bloqueando transições e edição
  após conclusão, exceto referência da OS externa.
- Retornar 401/403 para requisições sem sessão ou de técnico.

Os testes usam Supertest, Better Auth, Prisma e PostgreSQL descartável
provisionado pelo global setup da API. **Não** usam banco de produção.

```bash
npm run db:generate --prefix api
npm run test:integration --prefix api
```

Os cenários de agenda, visitas e execução pertencem às issues #72, #74
e #79; não devem ser considerados cobertos por esta suíte. A validação
ponta a ponta com orçamento e frontend depende de #64 e #70.
