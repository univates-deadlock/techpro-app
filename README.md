<div align="center">

<img src="assets/images/common/techpro-logo.png" alt="TechPro" width="420">

# TechPro

Sistema web interno para gestão do fluxo comercial e operacional **cliente → orçamento → serviço → visita**.<br>
Projeto desenvolvido na disciplina de **Laboratório de Programação para Internet** da **Univates** (entrega final).

</div>

---

## 1. Apresentação e objetivo

A **TechPro** atua em segurança eletrônica e automação residencial, comercial e industrial. O sistema interno foi projetado para centralizar o histórico de clientes, a elaboração e o acompanhamento de orçamentos, o planejamento de serviços e visitas técnicas e o controle de garantias e revisões, reduzindo a dispersão de informações entre WhatsApp, planilhas e controles paralelos.

**Fronteira do produto:** esta aplicação é exclusivamente interna e **não substitui** o software já utilizado pela empresa para controle de estoque e emissão da Ordem de Serviço (OS) oficial. Não há integração automática com o sistema externo no escopo do MVP.

---

## 2. Equipe e referências

- [Alexandra Padilha](https://github.com/alexandrapadilha1)
- [Diogo Felipe Zanco](https://github.com/DiogoFZanco)
- [Mateus Carniel Brambilla](https://github.com/matbdev)
- [Tainá Luiza Schmidt](https://github.com/TainaSchmidt)

Referências do projeto:

- [Board do projeto no GitHub](https://github.com/orgs/univates-deadlock/projects/2/views/1)
- [Protótipo Figma — Desktop](https://www.figma.com/proto/luMSJDdrcew9JWRV0bKfvf/Site-TechPro?node-id=53-2&t=6ckapUM5hbwQRKYA-0&scaling=min-zoom&content-scaling=fixed&page-id=0%3A1&starting-point-node-id=53%3A2)
- [Protótipo Figma — Mobile](https://www.figma.com/proto/luMSJDdrcew9JWRV0bKfvf/Site-TechPro?node-id=318-3&p=f&t=6ckapUM5hbwQRKYA-0&scaling=scale-down&content-scaling=fixed&page-id=318%3A3&starting-point-node-id=318%3A3)

---

## 3. Tecnologias utilizadas

| Camada | Tecnologias |
| --- | --- |
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Zod 4, Better Auth Client |
| **Backend (API)** | Node.js 24, Express 5, TypeScript, Zod 4, Better Auth, Helmet, CORS, `express-rate-limit` |
| **Persistência** | PostgreSQL 17, Prisma ORM 7 (`@prisma/adapter-pg`) e migrations SQL versionadas |
| **Infraestrutura e CI/CD** | Docker, Docker Compose, GitHub Actions, runner self-hosted (`deadlock-deploy`) e proxy reverso Caddy |

---

## 4. Arquitetura geral

A aplicação adota arquitetura cliente-servidor com separação estrita entre interface, regras de negócio e banco de dados:

```text
Navegador
  │
  ├──► Frontend (Next.js App Router — porta 3000)
  │      ├─ Proteção SSR no layout autenticado via requireActiveSession()
  │      └─ Client Components para formulários, filtros, máscaras e interações
  │
  └──► API REST (Express 5 — porta 4000)
         ├─ CORS + Helmet + Rate Limit + Better Auth (/api/auth/*)
         ├─ Rotas → Middlewares (sessão/perfil) → Controllers + Schemas Zod → Services → Prisma
         └─ PostgreSQL 17 (porta 5432)
```

Em implantação na VM da Univates, os containers `api` e `frontend` conectam-se à rede Docker externa `deadlock_edge` e são publicados sob HTTPS em um único domínio (`https://app.matbdev.com`) por meio de um container **Caddy central** (externo a este repositório), que encaminha `/api/*` para `techpro-api:4000` e as demais rotas para `techpro-frontend:3000`.

---

## 5. Estado das funcionalidades — entrega final

A referência é o código integrado à main em 24/11/2026; veja a [matriz de entrega e backlog pós-MVP](docs/entrega-final.md) para rastreabilidade e evidências.

| Módulo | Entrega |
| --- | --- |
| Autenticação, usuários e clientes | Interface e API, sessão e autorização por perfil |
| Orçamentos | CRUD, itens, cálculo, envio, aprovação, rejeição e exportação PDF; expiração pela API |
| Serviços | API de gestão, origem direta ou orçamento aprovado, referência à OS externa; UI ainda em desenvolvimento |
| Garantias e revisões | Listagem, criação e edição integradas à API; status de revisões e alertas |
| Dashboard | Indicadores reais de orçamentos e pós-serviço para ADMIN/PLANNING |
| Evidências | API autenticada e armazenamento privado S3; UI de upload e validação de produção futuras |
| Visitas | API de agendamento, atribuição de técnicos e verificação de conflitos (PR #116); interface, agenda individual e execução técnica pós-MVP |

A agenda e a execução pelo técnico, a interface de serviços/visitas e os controles de qualidade e infraestrutura não comprovados foram transferidos para o pós-MVP. Não confundir a presença de modelos no Prisma ou de telas reservadas com funcionalidade entregue.

---

## 6. Perfis de usuário e permissões

Toda autorização real é validada no backend a partir da sessão verificada (`res.locals.user`), nunca confiando apenas na ocultação visual do frontend:

| Perfil | Papel no negócio | Permissões implementadas atualmente |
| --- | --- | --- |
| `ADMIN` | Gestor / Administrador | Acesso completo aos módulos implementados: autenticação, CRUD de usuários (`/api/users`), CRUD de clientes (`/api/clients`), CRUD de orçamentos/itens (`/api/quotes`), serviços pela API, garantias, revisões e dashboard. |
| `PLANNING` | Orçamento / Planejamento | Autenticação, CRUD de clientes (`/api/clients`), CRUD de orçamentos/itens (`/api/quotes`) e dashboard. Recebe `403` em `/api/users` (link "Usuários" oculto na barra lateral). |
| `TECHNICIAN` | Técnico | Autenticação e acesso ao shell interno (`/` operacional e `/servicos`). Páginas administrativas/comerciais ficam ocultas no menu e redirecionam no SSR; na API recebe `403` em `/api/users`, `/api/clients` e `/api/quotes`. Suas funcionalidades operacionais (agenda e registro de visitas) ficam no backlog pós-MVP. |

---

## 7. Estrutura do repositório

```text
techpro-app/
├── api/                  # API REST (Express 5, TypeScript, Zod, Prisma 7, Better Auth)
│   ├── prisma/           # Schema relacional e migrations versionadas
│   ├── src/              # Código-fonte em camadas (routes, middlewares, controllers, schemas, services)
│   └── tests/            # Testes unitários e de integração HTTP/PostgreSQL/S3
├── frontend/             # Aplicação web (Next.js App Router, React 19, Tailwind CSS 4)
│   ├── app/              # Rotas públicas (/login) e grupo autenticado ((protected)/)
│   ├── components/       # Shell de layout, primitivos de UI e telas dos módulos
│   └── lib/              # Clientes de autenticação/API, schemas Zod, máscaras e moeda
├── docs/                 # Índice documental, requisitos (PRD), descoberta e guia de deploy
├── assets/               # Logotipo e diagramas utilizados na documentação
├── .github/              # Workflows de CI/CD e instruções/skills de agentes
├── docker-compose.yml    # Orquestração de PostgreSQL, API e frontend
└── package.json          # Scripts agregadores de instalação, execução e verificação
```

> **Observações importantes sobre pacotes:**
> - `api/` e `frontend/` possuem `package.json` e `package-lock.json` independentes. Instale dependências sempre no pacote consumidor (`npm install <pacote> --prefix api` ou `--prefix frontend`), nunca na raiz.
> - O diretório `api/frontend/` contém apenas manifestos residuais preservados no histórico e **não** faz parte da aplicação oficial.

---

## 8. Pré-requisitos e configuração do ambiente

### Pré-requisitos

- **Node.js 24** (`>=24 <25`) e **npm**.
- **Docker** com plugin **Docker Compose** ativo e permissão para o usuário local.
- Portas locais livres: `3000` (frontend), `4000` (API) e `5432` (PostgreSQL).

### Rede Docker externa (`deadlock_edge`)

O `docker-compose.yml` conecta `api` e `frontend` à rede externa `deadlock_edge` (usada na VM pelo proxy reverso Caddy). Para executar o Compose localmente pela primeira vez, crie essa rede uma única vez:

```bash
docker network inspect deadlock_edge >/dev/null 2>&1 || docker network create deadlock_edge
```

### Arquivos de ambiente (`.env` e `api/.env`)

O projeto trabalha com dois arquivos de ambiente ignorados pelo Git (os arquivos `.env.example` são apenas modelos versionados):

1. **`api/.env` (obrigatório):** lido pelo container e pelos scripts da API. Deve definir `BETTER_AUTH_SECRET` com ao menos **32 caracteres**.
2. **`.env` na raiz (opcional localmente, obrigatório na VM):** parametriza credenciais do PostgreSQL, portas e URLs no `docker-compose.yml`. No desenvolvimento local via Compose, caso `.env` não exista na raiz, o `docker-compose.yml` aplica automaticamente os padrões locais (`techpro`, `localhost`, portas `3000`/`4000`/`5432`).

Para preparar `api/.env` localmente sem sobrescrever um arquivo já existente e gerar um segredo aleatório sem exibi-lo no terminal:

```bash
if [ ! -f api/.env ]; then
  cp api/.env.example api/.env
fi

node --input-type=module - <<'NODE'
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
const path = 'api/.env';
const contents = readFileSync(path, 'utf8');
if (/^BETTER_AUTH_SECRET=.+$/m.test(contents)) {
  console.log('BETTER_AUTH_SECRET existente preservado.');
} else {
  const clean = contents.replace(/^BETTER_AUTH_SECRET=.*\n?/m, '');
  writeFileSync(path, clean.trimEnd() + '\nBETTER_AUTH_SECRET=' + randomBytes(32).toString('hex') + '\n');
  console.log('BETTER_AUTH_SECRET local configurado.');
}
NODE
```

> Caso opte por criar `.env` na raiz a partir de `.env.example`, defina `POSTGRES_PASSWORD` antes de inicializar o volume do banco (ou mantenha a senha já gravada no volume `postgres_data` existente). Para execução da API **fora** do Docker Compose, descomente também `PORT`, `DATABASE_URL`, `BETTER_AUTH_URL` e `FE_BASE_URL` em `api/.env` conforme detalhado em [`api/README.md`](api/README.md#instalação-e-configuração).

---

## 9. Instalação e execução local

### Opção 1: Stack completa via Docker Compose (recomendada)

Com a rede `deadlock_edge` criada e `api/.env` configurado, execute na raiz do repositório:

```bash
docker compose up --build
```

*(Alternativa equivalente via npm: `npm run dev`.)*

Na inicialização, o PostgreSQL aguarda ficar saudável (`pg_isready`), a API gera o cliente Prisma, aplica as migrations pendentes (`prisma migrate deploy`) e inicia em modo watch, e o frontend inicia em seguida:

| Serviço | Endereço local | Observação |
| --- | --- | --- |
| Frontend | `http://localhost:3000` | Redireciona para `/login` sem sessão ativa |
| API | `http://localhost:4000` | Base REST e autenticação (`/api/*`) |
| Health check da API | `http://localhost:4000/api/health` | Retorna `200` com `{"status":"ok", ...}` |
| PostgreSQL | `localhost:5432` | Internamente no Compose usa o host `db:5432` |

Comandos úteis de operação dos containers:

```bash
docker compose ps
docker compose logs -f api frontend
docker compose down
```

> `docker compose down` preserva os dados do banco no volume `postgres_data`. **Não utilize `-v`** se desejar manter usuários, clientes e orçamentos cadastrados.

### Opção 2: Execução direta no host (com banco em container)

Para instalar dependências localmente, rodar checagens na máquina ou executar API e frontend fora dos containers:

```bash
npm run install:all
docker compose up -d db
```

Garanta que `DATABASE_URL`, `PORT`, `BETTER_AUTH_URL` e `FE_BASE_URL` estejam preenchidos em `api/.env` apontando para `localhost`, aplique as migrations e inicie os serviços em terminais separados:

```bash
npm run db:generate --prefix api
npm run db:migrate --prefix api
npm run dev --prefix api
```

```bash
npm run dev --prefix frontend
```

> Use sempre `localhost` de forma consistente no navegador e nas variáveis de ambiente (`localhost` e `127.0.0.1` são origens distintas para cookies e CORS).

---

## 10. Acesso inicial e criação do primeiro administrador

O sistema **não possui cadastro público**. Antes do primeiro login, provisione o administrador inicial com a stack em execução.

Em um terminal Bash na raiz do repositório (com a stack rodando via Docker Compose):

```bash
export ADMIN_NAME='Administrador TechPro'
export ADMIN_EMAIL='admin@techpro.local'
read -r -s -p 'Senha inicial (8 a 128 caracteres): ' ADMIN_PASSWORD
printf '\n'
export ADMIN_PASSWORD
docker compose exec -e ADMIN_NAME -e ADMIN_EMAIL -e ADMIN_PASSWORD api npm run admin:create
unset ADMIN_NAME ADMIN_EMAIL ADMIN_PASSWORD
```

*(Se estiver executando a API diretamente no host, substitua a linha `docker compose exec ...` por `npm run admin:create --prefix api`.)*

O script cria o usuário `ADMIN` e sua credencial com hash de senha de forma atômica, recusando a operação caso já exista um administrador ativo ou caso o e-mail já esteja em uso. Os demais usuários (`ADMIN`, `PLANNING`, `TECHNICIAN`) devem ser cadastrados na tela `/usuarios` ou via `/api/users`.

---

## 11. Comandos de validação e situação dos testes

### Checagens estáticas e build

Na raiz do repositório (após `npm run install:all`):

```bash
npm run check           # Executa check:api e check:frontend
npm run check:api       # Lint, typecheck e build da API
npm run check:frontend  # Lint, typecheck e build do frontend
```

Comandos específicos do Prisma (requerem `DATABASE_URL` definido no ambiente ou em `api/.env`):

```bash
npm run db:validate --prefix api
npm run db:generate --prefix api
npm run db:migrate --prefix api
```

> O build do frontend (`next build --webpack`) baixa a fonte `Rubik` via `next/font/google` e requer acesso à rede durante a compilação.

### Situação atual dos testes automatizados

- A suíte de testes automatizados da API foi integrada à branch `main` pelo PR #54 e é executada automaticamente no workflow `CI` do GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).
- A suíte contempla testes unitários (`*.unit.test.ts`) para regras de negócio e validações em memória, e testes de integração (`*.integration.test.ts`) com Supertest e banco PostgreSQL descartável gerenciado automaticamente no Docker.
- Comandos de execução:
  - `npm test --prefix api` — executa toda a suíte (unitários e de integração).
  - `npm run test:unit --prefix api` — executa apenas os testes unitários (não requer Docker nem banco).
  - `npm run test:integration --prefix api` — executa apenas os testes de integração (requer Docker para o banco isolado).
  - Detalhes e especificações completas estão disponíveis no [guia da API](api/README.md#testes-automatizados).

---

## 12. CI/CD e implantação

O fluxo de integração e entrega contínua está dividido entre este repositório e o orquestrador privado de infraestrutura da equipe (`univates-deadlock/deadlock-deploy`):

1. **Integração Contínua (`CI`):** em cada `push` ou `pull_request`, [`.github/workflows/ci.yml`](.github/workflows/ci.yml) valida schema/client Prisma, ESLint, TypeScript, build e executa a suíte de testes automatizados (`npm test`) no job da API em Node.js 24.
2. **Notificação de CD (`Notify central CD`):** quando o workflow `CI` conclui com sucesso após um `push` na branch `main`, [`.github/workflows/notify-deploy.yml`](.github/workflows/notify-deploy.yml) dispara um evento `repository_dispatch` (`deploy-main`) para `univates-deadlock/deadlock-deploy`.
3. **Implantação via runner self-hosted:** o runner self-hosted instalado na VM da Univates recebe o job diretamente do GitHub via HTTPS (sem depender de SSH de entrada vindo dos runners hospedados pelo GitHub), atualiza o checkout em `~/techpro-app`, executa `docker compose up -d --build` e valida os healthchecks locais.
4. **Publicação HTTPS:** o Caddy central (mantido em `deadlock-deploy`) publica a aplicação em `https://app.matbdev.com` através da rede Docker `deadlock_edge`.

> **Workflow SSH legado — desativado:** o workflow anterior de deploy via SSH ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) encontra-se desativado no GitHub Actions, substituído pelo fluxo centralizado via runner self-hosted e Caddy (`deadlock-deploy`). Consulte todos os detalhes operacionais em [`docs/deploy.md`](docs/deploy.md).

---

## 13. Roteiro de apoio para demonstração acadêmica (entrega final)

Para conduzir a apresentação técnica do projeto de forma alinhada ao código atual:

1. **Autenticação e controle de sessão:** demonstrar redirecionamento automático para `/login`, tentativa com credencial inválida (`401`), login como `ADMIN`, persistência por cookie HTTP-only e encerramento de sessão (`Sair`).
2. **Autorização por perfis:** demonstrar a gestão de usuários exclusiva para `ADMIN` (`/usuarios`), o acesso compartilhado de `ADMIN` e `PLANNING` em `/clientes` e `/orcamentos`, o bloqueio no backend (`403`) ao tentar acessar recursos sem permissão e a revogação imediata de sessão ao desativar um usuário.
3. **CRUDs e regras de negócio:** demonstrar cadastro/edição/inativação lógica de clientes (com máscaras CPF/CNPJ e WhatsApp) e o fluxo de orçamentos (criação em `DRAFT` para cliente ativo, adição/edição/remoção de itens, recálculo decimal automático com descontos, visualização detalhada em `/orcamentos/[id]`, indicadores refletidos no Dashboard `/` e exclusão restrita a rascunhos).
4. **Pós-serviço:** demonstrar dashboard, garantias e revisões quando houver serviços previamente cadastrados pela API com dados fictícios. Não simular uma tela de serviço ou agenda inexistente.
5. **Arquitetura, trabalho em equipe e CI/CD:** apresentar a separação `routes → middlewares → controllers/schemas → services → Prisma`, o histórico de branches/PRs e board da equipe, o pipeline `CI` → `Notify central CD` → runner self-hosted e a publicação reversa com Docker Compose e Caddy.

---

## 14. Limitações e evolução pós-MVP

O projeto encerra a entrega acadêmica com o escopo reduzido explicitado na [matriz de entrega final](docs/entrega-final.md). As pendências incluem interface de serviços e visitas, agenda/execução do técnico, expiração e evidências na UI, recuperação de senha, backup e validações completas de qualidade e produção. A OS oficial e o estoque permanecem no software da TechPro. A aplicação não está declarada homologada para uso produtivo definitivo.

---

## 15. Documentação complementar

- **[Matriz de entrega final e backlog](docs/entrega-final.md)** — módulos entregues, limitações e evolução pós-MVP.
- **[Índice central da documentação](docs/README.md)** — mapa completo dos documentos técnicos e de produto.
- **[Documentação da API](api/README.md)** — arquitetura do backend, autenticação Better Auth, matriz de permissões, contratos completos dos endpoints e regras de cálculo.
- **[Documentação do Frontend](frontend/README.md)** — estrutura do Next.js App Router, verificação SSR de sessão, componentes, máscaras e integração HTTP.
- **[Banco de dados e Prisma](api/prisma/README.md)** e **[Histórico de migrations](api/prisma/migrations/README.md)** — modelo relacional e evolução do schema.
- **[Guia de CI/CD e Deploy](docs/deploy.md)** — variáveis de ambiente na VM, rede `deadlock_edge`, Caddy central e operação do runner self-hosted.
- **[Documento de Requisitos (PRD)](docs/documento-requisitos.md)** — escopo planejado do MVP, requisitos funcionais/não funcionais, casos de uso e DER.
- **[Contexto do cliente](docs/contexto-cliente.md)** e **[Perguntas ao cliente](docs/perguntas-cliente.md)** — registros da etapa inicial de descoberta.
