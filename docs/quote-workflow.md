# Fluxo de decisões de orçamento — UI e API

Esta documentação descreve o contrato usado pelo detalhe de orçamento na
branch de frontend **PR #108**, ainda em revisão. Ela complementa o guia
da API em [api/README.md](../api/README.md).

## Fluxo de uso

O detalhe do orçamento oferece **enviar**, **aprovar** e **rejeitar**,
conforme o status e as permissões da sessão. O usuário confirma a ação
antes do envio à API, e o frontend atualiza a visualização conforme a
resposta. Uma rejeição exige motivo; um orçamento decidido não pode
mais ser editado.

| Rota | Pré-condição | Resultado |
| --- | --- | --- |
| POST /api/quotes/:id/send | DRAFT com pelo menos um item | SENT |
| POST /api/quotes/:id/approve | SENT | APPROVED |
| POST /api/quotes/:id/reject | SENT e decisionNotes válido | REJECTED |

Rotas de planejamento exigem sessão ADMIN ou PLANNING. Outros perfis
recebem 401/403. Fluxos de decisão mais completos, auditoria de autoria,
expiração e concorrência estão no PR #110, empilhado sobre o #108.

## Teste crítico de integração

O [quote-status.integration.test.ts](../api/tests/quote-status.integration.test.ts)
valida exclusivamente o contrato necessário à ação da tela: usuário
sem autorização não envia orçamento; uma rejeição sem motivo não altera
o estado; aprovação persiste e bloqueia edição.

```bash
npm run test:integration --prefix api
```

Os testes utilizam PostgreSQL descartável, Better Auth e Supertest.
A interação visual (modais, layout e mensagens) deve ser validada
manualmente na revisão da interface. A presença do teste nesta branch
não indica que o PR #108 já foi integrado à main.
