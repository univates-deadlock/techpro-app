# Páginas do App Router (`frontend/app`)

Estrutura de rotas da aplicação Next.js:

- `layout.tsx` e `globals.css`: layout raiz em `pt-BR`, carregamento da fonte `Rubik` e tokens visuais compartilhados com a identidade da TechPro.
- `login/page.tsx`: tela pública de autenticação por e-mail e senha.
- `(protected)/layout.tsx`: layout servidor que executa `requireActiveSession()` antes de renderizar o `AppShell`, redirecionando visitantes sem sessão ativa para `/login` e entregando os dados da sessão ao menu lateral.
- `(protected)/page.tsx`: painel inicial ("Visão geral") sensível ao perfil — exibe indicadores e listagem de orçamentos (`DashboardQuotesView`, derivado de `GET /api/quotes` e `GET /api/dashboard`) para `ADMIN` e `PLANNING`, e atalho para `/visitas` para `TECHNICIAN`, cuja agenda individual aguarda autorização e endpoints operacionais.
- `(protected)/usuarios/page.tsx`: gerenciamento de usuários protegido no SSR por `requireRoleSession(["ADMIN"])`.
- `(protected)/clientes/page.tsx`: gerenciamento de clientes protegido no SSR por `requireRoleSession(["ADMIN", "PLANNING"])`.
- `(protected)/orcamentos/page.tsx` e `(protected)/orcamentos/[id]/page.tsx`: listagem, criação, edição, exclusão de rascunhos e visualização detalhada de orçamentos protegidas no SSR por `requireRoleSession(["ADMIN", "PLANNING"])`.
- `(protected)/garantias/page.tsx` e `(protected)/revisoes/page.tsx`: telas integradas à API, protegidas por `requireRoleSession(["ADMIN", "PLANNING"])`.
- `(protected)/servicos/page.tsx`: gestão de serviços integrada à API, protegida por `requireRoleSession(["ADMIN", "PLANNING"])`.
- `(protected)/visitas/page.tsx`: tela de agenda autenticada, com agendamento/consulta/edição para ADMIN/PLANNING e limitações de atribuição; a agenda individual do técnico aguarda a API e a execução permanece desativada.

Mantenha Server Components como padrão em layouts e páginas de entrada, delegando interatividade de formulários, modais e filtros aos Client Components em `frontend/components/`. Os contratos de requisição e resposta estão documentados em [`api/README.md`](../../api/README.md).
