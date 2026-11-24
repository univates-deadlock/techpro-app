# Utilitários e clientes HTTP (`frontend/lib`)

Módulos compartilhados pelas telas e layouts do frontend:

- `auth-client.ts`: cliente Better Auth para React (`NEXT_PUBLIC_API_URL` com fallback `http://localhost:4000` e `credentials: "include"`), usado em Client Components para login e logout.
- `auth-server.ts`: helpers servidores `requireActiveSession()` e `requireRoleSession()` usados por `app/(protected)/` para validar o cookie recebido junto a `GET /api/auth/get-session` (via `API_INTERNAL_URL` ou `NEXT_PUBLIC_API_URL`) sem cache e restringir rotas por perfil.
- `quotes.ts`: camada de acesso aos endpoints `/api/quotes` (listagem, detalhe, criação, atualização atômica de observações/desconto/itens, sincronização auxiliar de itens via `syncQuoteItems` e exclusão de rascunhos), convertendo `Decimal` serializado pela API em centavos inteiros.
- `warranties.ts` e `revisions.ts`: clientes HTTP para garantias, revisões e transições de status.
- `service-options.ts`: lista serviços para os seletores de garantias/revisões.
- `operational.ts`: cliente de indicadores operacionais do dashboard.
- `money.ts`: formatação e parsing de valores em reais (sempre baseados em centavos inteiros), quantidades e datas em `pt-BR`.
- `masks.ts`: máscaras de digitação para CPF, CNPJ e telefone/WhatsApp, além de extração de dígitos para envio à API.
- `schemas.ts`: schemas Zod espelhados da API para feedback imediato nos formulários de login, usuários, clientes e orçamentos.

Não importe módulos de `api/src/` no frontend. A validação e a ocultação visual no cliente não substituem a autorização e a validação executadas na API — consulte o [guia do frontend](../README.md) e o [README da API](../../api/README.md).
