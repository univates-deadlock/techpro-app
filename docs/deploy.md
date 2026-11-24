# CI/CD e Implantação — TechPro App

Este documento descreve a arquitetura atual de integração contínua (CI), entrega contínua (CD), configuração de variáveis de ambiente, rede Docker e publicação reversa do **TechPro App** tanto para desenvolvimento local quanto para a VM da Univates (`https://app.matbdev.com`).

---

## 1. Fluxo ponta a ponta de CI/CD

A arquitetura operacional atual divide a validação de código (neste repositório) da execução de infraestrutura (centralizada no repositório privado `univates-deadlock/deadlock-deploy`):

```text
1. Desenvolvimento e push / Pull Request em univates-deadlock/techpro-app
        │
        ▼
2. GitHub Actions: workflow "CI" (.github/workflows/ci.yml)
        ├─ Job API: npm ci → db:validate → db:generate → lint → typecheck → build → npm test
        └─ Job Frontend: npm ci → lint → typecheck → build
        │
        ▼  (somente em push na branch main com conclusão "success")
3. GitHub Actions: workflow "Notify central CD" (.github/workflows/notify-deploy.yml)
        └─ Envia POST repository_dispatch (event_type: "deploy-main") com repository e sha
        │
        ▼
4. Repositório privado univates-deadlock/deadlock-deploy
        └─ Aciona o workflow de deploy direcionado ao runner self-hosted na VM
        │
        ▼
5. Runner self-hosted na VM da Univates (conexão HTTPS de saída para o GitHub)
        ├─ Atualiza o checkout local em ~/techpro-app (branch main)
        ├─ Valida e atualiza os containers com Docker Compose (up -d --build)
        └─ Conecta api e frontend à rede externa deadlock_edge
        │
        ▼
6. Proxy reverso Caddy central (infraestrutura compartilhada em deadlock-deploy)
        ├─ Roteia https://app.matbdev.com/api/* ──► techpro-api:4000
        └─ Roteia https://app.matbdev.com/*     ──► techpro-frontend:3000
        │
        ▼
7. Verificações de disponibilidade (healthchecks Docker e respostas HTTP 200)
```

### Detalhamento das etapas

1. **Desenvolvimento e envio de alterações:** o desenvolvimento ocorre em branches temáticas integradas via Pull Request para a `main`.
2. **Execução do CI (`.github/workflows/ci.yml`):** acionado em todo `push` e `pull_request` em runners `ubuntu-latest` com Node.js 24.
3. **Validação de lint, tipos, build e testes:**
   - **Job `API`:** instala dependências (`npm ci`), valida o schema Prisma (`db:validate`), gera o cliente Prisma (`db:generate`), executa `lint`, `typecheck`, `build` e roda a suíte de testes automatizados (`npm test`).
   - **Job `Frontend`:** instala dependências (`npm ci`) e executa `lint`, `typecheck` e `build`.
4. **Notificação após CI aprovado na `main` (`.github/workflows/notify-deploy.yml`):** acionado por `workflow_run` ao término do workflow `CI`. O job `notify` executa **exclusivamente** quando todas as condições são atendidas: `conclusion == 'success'`, `event == 'push'`, `head_branch == 'main'` e repositório `univates-deadlock/techpro-app` (resultados de Pull Requests nunca disparam deploy).
5. **Comunicação com `univates-deadlock/deadlock-deploy`:** utilizando o segredo organizacional `DEPLOY_DISPATCH_TOKEN`, o workflow envia `POST https://api.github.com/repos/univates-deadlock/deadlock-deploy/dispatches` com `event_type: "deploy-main"` e `client_payload: { repository, sha }` (esperando HTTP `204`). Também é possível acionar o deploy manualmente em **`deadlock-deploy` → Actions → Deploy Deadlock** selecionando o alvo `app`.
6. **Execução pelo runner self-hosted na VM:** o runner instalado na própria VM mantém comunicação HTTPS de saída com o GitHub para buscar trabalhos na fila. Dessa forma, o fluxo central **não depende de abertura de porta ou conexão SSH de entrada** a partir dos runners públicos hospedados pelo GitHub.
7. **Atualização com Docker Compose:** na VM, o procedimento atualiza o código da `main` em `~/techpro-app`, valida o `docker-compose.yml` e recria/atualiza os serviços `db`, `api` e `frontend` (`docker compose up -d --build`), preservando o volume `postgres_data`.
8. **Publicação via Caddy central:** o TLS/HTTPS e o roteamento público são realizados pelo **Caddy central** (veja seção 2).
9. **Verificações de disponibilidade:** o `docker-compose.yml` monitora `pg_isready` no serviço `db`, `http://127.0.0.1:4000/api/health` no serviço `api` e `http://127.0.0.1:3000/login` no serviço `frontend`, além das checagens HTTP pós-implantação.

---

## 2. Separação entre o Caddy central e a stack do projeto

O proxy reverso **Caddy não faz parte deste repositório**:

- **Infraestrutura central (`univates-deadlock/deadlock-deploy`):** gerencia o container do Caddy, certificados TLS automáticos e a criação da rede Docker compartilhada `deadlock_edge`.
- **Infraestrutura da aplicação (`techpro-app`):** gerencia apenas os containers `db`, `api` e `frontend` definidos em [`../docker-compose.yml`](../docker-compose.yml).
  - Os serviços `db`, `api` e `frontend` fazem bind de portas no host apenas em loopback (`127.0.0.1`), evitando exposição direta das portas `3000`, `4000` e `5432` na Internet.
  - Os serviços `api` e `frontend` conectam-se simultaneamente à rede interna `default` do projeto (para acesso da `api` ao `db` e SSR do `frontend` via `http://api:4000`) e à rede externa `deadlock_edge` com os aliases `techpro-api` e `techpro-frontend`.
  - O Caddy central encaminha `https://app.matbdev.com/api/*` para `techpro-api:4000` e as demais rotas para `techpro-frontend:3000`. O registro DNS `A` de `app.matbdev.com` aponta para o IPv4 público da VM.

### Requisito da rede `deadlock_edge` no desenvolvimento local

Como `docker-compose.yml` declara `deadlock_edge` com `external: true`, o Docker exige que essa rede exista antes de subir os containers, mesmo em máquinas locais onde o Caddy central não está presente.

No ambiente local de desenvolvimento, crie a rede uma única vez antes de executar `docker compose up --build`:

```bash
docker network inspect deadlock_edge >/dev/null 2>&1 || docker network create deadlock_edge
```

---

## 3. Workflow SSH legado — desativado (`.github/workflows/deploy.yml`)

O arquivo [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) (`Deploy TechPro App`) corresponde à implementação anterior de deploy por SSH direto a partir de `ubuntu-latest` (exigindo os segredos `VM_HOST`, `VM_USER`, `VM_PORT`, `VM_SSH_KEY` e `VM_KNOWN_HOSTS`).

**Estado atual:**
- O workflow legado encontra-se **desativado no GitHub Actions**, evitando execuções redundantes, falhas por ausência de segredos SSH ou concorrência com o runner self-hosted do `deadlock-deploy`.
- O arquivo permanece no repositório como registro histórico. Toda a implantação contínua da branch `main` é realizada exclusivamente pelo pipeline central via `Notify central CD` e runner self-hosted.

---

## 4. Arquivos de ambiente (desenvolvimento local e VM)

O projeto utiliza **dois arquivos `.env` não versionados** (cobertos por `.gitignore`):

1. **`.env` na raiz (`~/techpro-app/.env` na VM):** lido pelo Docker Compose para interpolar variáveis do PostgreSQL, portas de bind e URLs públicas. Modelo público: [`../.env.example`](../.env.example).
2. **`api/.env` (`~/techpro-app/api/.env` na VM):** injetado no serviço `api` via `env_file` e lido pelos scripts locais da API, contendo `BETTER_AUTH_SECRET`. Modelo público: [`../api/.env.example`](../api/.env.example).

> **Atenção operacional:** commits alterando `.env.example` **não criam nem atualizam** os arquivos `.env` reais na VM. Nunca registre segredos, senhas de banco ou conteúdos de `.env` reais em commits, PRs, issues, logs ou capturas de tela.

### 4.1 Desenvolvimento local

- **Com Docker Compose:** `api/.env` precisa conter `BETTER_AUTH_SECRET` (mínimo de 32 caracteres). Na raiz, o `.env` é opcional porque `docker-compose.yml` possui valores padrão locais (`POSTGRES_USER=techpro`, `POSTGRES_PASSWORD=techpro`, `POSTGRES_DB=techpro`, `APP_HOST=localhost`, portas `3000`/`4000`/`5432` em `127.0.0.1`). Se criar `.env` a partir de `.env.example`, substitua `POSTGRES_PASSWORD` antes de criar o volume `postgres_data` (ou preserve a senha já existente no volume).
- **Fora do Docker Compose:** além de `BETTER_AUTH_SECRET`, defina em `api/.env` as variáveis `PORT=4000`, `DATABASE_URL`, `BETTER_AUTH_URL=http://localhost:4000` e `FE_BASE_URL=http://localhost:3000`. No frontend, `NEXT_PUBLIC_API_URL` assume `http://localhost:4000` por padrão (ou pode ser definido em `frontend/.env.local`).

### 4.2 Implantação na VM (`app.matbdev.com`)

Na VM, ambos os arquivos devem existir em `~/techpro-app` com permissões restritas (`chmod 600`):

**`~/techpro-app/.env`:**

```dotenv
# Preservar sempre as credenciais já utilizadas pelo volume postgres_data existente
POSTGRES_USER=techpro
POSTGRES_PASSWORD=<senha-existente-do-banco>
POSTGRES_DB=techpro
POSTGRES_PORT=5432

APP_HOST=app.matbdev.com
API_PORT=4000
FRONTEND_PORT=3000
API_BIND_IP=127.0.0.1
FRONTEND_BIND_IP=127.0.0.1
BETTER_AUTH_URL=https://app.matbdev.com
FE_BASE_URL=https://app.matbdev.com
NEXT_PUBLIC_API_URL=https://app.matbdev.com
```

**`~/techpro-app/api/.env`:**

```dotenv
BETTER_AUTH_SECRET=<segredo-estavel-com-no-minimo-32-caracteres>
```

- Mantenha `BETTER_AUTH_SECRET` estável entre implantações; alterá-lo invalida todas as sessões ativas.
- O `docker-compose.yml` define `PORT`, `DATABASE_URL`, `BETTER_AUTH_URL` e `FE_BASE_URL` diretamente na seção `environment` do serviço `api` (que tem precedência sobre `env_file`), e define `API_INTERNAL_URL=http://api:4000` no serviço `frontend` para verificação SSR de sessão via rede interna.

---

## 5. Validação pós-deploy e operação segura

Na VM, para validar a sintaxe interpolada do Compose sem recriar containers:

```bash
cd ~/techpro-app
sudo docker compose config --quiet
```

Para verificar a disponibilidade pública através do Caddy central:

```bash
curl -fsS https://app.matbdev.com/api/health
curl -sS -o /dev/null -w '%{http_code}\n' https://app.matbdev.com/login
```

- `/api/health` deve retornar HTTP `200` com JSON contendo `"status":"ok"`.
- `/login` deve retornar HTTP `200`.
- Como `/api/health` não testa banco nem cookies, valide também login, manutenção de sessão e operações CRUD com uma conta de demonstração.
- **Preservação de dados:** nunca execute `docker compose down -v` na VM, pois a flag `-v` remove os volumes nomeados (incluindo `postgres_data`).

---

## 6. Limitações atuais da infraestrutura

- A API ainda utiliza execução em modo de desenvolvimento (`npm run dev`); o frontend já utiliza Dockerfile multi-stage e `npm run start` em produção. A adoção produtiva definitiva requer revisar o runtime da API, realizar homologação da infraestrutura e configurar backup automático/restauração (RNF09, issue #98, fora do MVP). Ver [entrega final](entrega-final.md).
