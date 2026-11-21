# Controllers

Recebem `Request`, `Response` (e opcionalmente `NextFunction`) e realizam três responsabilidades:

1. Validam `params`, `query` e `body` com os schemas Zod correspondentes.
2. Chamam o service utilizando apenas dados validados e a identidade verificada em `res.locals.user`.
3. Respondem com status HTTP e JSON adequados (ou encaminham erros ao `globalErrorHandler` — no Express 5, promises rejeitadas em handlers `async` também são encaminhadas automaticamente).

Padrões dos controllers atuais:

- `user.controller.ts`: recebe envelope `{ userData }` em `POST`/`PATCH`, responde `201` na criação, `200` na edição e `204` (sem corpo) em ativação, desativação e `DELETE` lógico.
- `client.controller.ts`: recebe campos diretamente no body, responde `201` na criação e `200` com JSON nas consultas, edições, ativação, inativação e `DELETE` lógico.
- `quote.controller.ts`: valida filtros de listagem (`req.query`), payload de orçamento e itens, obtém `createdBy` de `res.locals.user.id` e responde `204` na exclusão física de rascunhos (`DRAFT`).
- `service.controller.ts`: valida filtros de listagem (`req.query`), payload de serviço e mudança de status, obtém `createdBy` de `res.locals.user.id` e responde `201` na criação e `200` nas demais operações.

Não realize consultas Prisma, cálculos de negócio ou hashing de senha nos controllers; mantenha essas operações em `services/`.
