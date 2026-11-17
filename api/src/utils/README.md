# Utilitários e configuração HTTP

- `auth.ts`: Better Auth, adaptador Prisma, email/senha, campos adicionais,
  duração de sessão, hook de usuário ativo e rate limit. Cadastro público e
  entrada de `role`/`isActive` pelas rotas nativas ficam bloqueados. Também são
  bloqueadas as rotas nativas de edição de perfil/email e exclusão. O hook de
  confirmação da sessão usa bloqueio da linha do usuário para coordenar login
  simultâneo com desativação.
- `cors.ts`: aceita a origem de `FE_BASE_URL` e permite cookies.
- `rateLimit.ts`: limite geral por IP, montado antes de autenticação e CRUDs.
- `AppError.ts`: erro de negócio com mensagem pública e status HTTP.
- `authUser.ts`: `getAuthenticatedUserId(res)` lê o id do usuário autenticado em
  `res.locals.user` (preenchido por `requireActiveUser`) e lança `AppError` 401
  se não existir. Usado pelos controllers que gravam autoria (`createdBy`).

CORS controla chamadas do navegador; autenticação identifica o usuário;
autorização controla o que ele pode fazer. São responsabilidades diferentes.
Use as proteções de origem/CSRF do Better Auth nas rotas nativas.
