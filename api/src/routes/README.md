# Rotas

Cada roteador associa método e caminho HTTP a um controller, sendo montado sob seu prefixo em `src/app.ts`:

- `health.route.ts` (`/api/health`): verificação pública de disponibilidade HTTP.
- `user.route.ts` (`/api/users`): protegido por `router.use(requireActiveUser, requireAdmin)` (exclusivo `ADMIN`).
- `client.route.ts` (`/api/clients`): protegido por `requireActiveUser` e `requireRole("ADMIN", "PLANNING")`.
- `quote.route.ts` (`/api/quotes`): protegido por `requireActiveUser` e `requireRole("ADMIN", "PLANNING")`, incluindo as sub-rotas `/:id/items` e `/:id/items/:itemId`.
- `service.route.ts` (`/api/services`): protegido por `requireActiveUser` e `requireRole("ADMIN", "PLANNING")`, incluindo a sub-rota `/:id/status`.
- `visit.route.ts` (`/api/visits`): protegido por `requireActiveUser`, com `requireRole("ADMIN", "PLANNING")` aplicado rota a rota (`GET /`, `GET /:id`, `PATCH /:id` e `PUT /:id/technicians`), para permitir perfis diferentes em rotas futuras do mesmo módulo.

As rotas `/api/auth/*` são montadas diretamente em `app.ts` pelo handler do Better Auth, antes de `express.json()`.

Não repita checagens de sessão em cada controller nem remova middlewares de autorização para facilitar chamadas do frontend. Para adicionar um novo módulo, crie o roteador com as permissões do requisito e registre o prefixo em `app.ts`.
