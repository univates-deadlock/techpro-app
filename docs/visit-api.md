# API de visitas — agendamento e técnicos

A API de planejamento de visitas e atribuição de técnicos foi integrada à main pelo PR #116, com CI aprovada. Depende da [API de serviços](service-api.md) (PR #112). Este contrato descreve a implementação integrada, não a homologação de produção. Requisitos relacionados: RF13–RF16, RF22, RN-SRV-03 e RNF06.

Uma visita é um agendamento dentro de um serviço, com data/horário e um ou mais
técnicos. Este módulo cobre o planejamento: criar, editar e consultar visitas,
atribuir e desatribuir técnicos, sinalizar conflitos de horário e registrar execução, conclusão ou cancelamento. A agenda individual é restrita ao vínculo com o técnico autenticado.

## Integração com a interface

Os componentes da tela `/visitas` foram integrados à API nos PRs #120 e #122, mas a rota foi desabilitada por decisão de escopo da entrega acadêmica. A interface de Serviços centraliza as previsões de início/fim. A evolução proposta é uma agenda mensal que reaproveite as APIs, exiba técnicos ativos, serviço e local e permita ajustar o período previsto sem duplicar o planejamento. As regras abaixo permanecem válidas para a API; não representam disponibilidade da tela nesta entrega. Consulte a [matriz de entrega](entrega-final.md).

## Autorização e rotas

Todas as rotas exigem sessão ativa. ADMIN/PLANNING planejam, consultam, editam e cancelam; TECHNICIAN pode listar somente visitas atribuídas (o filtro de técnico é forçado pelo servidor) e registrar sua execução. Demais operações retornam HTTP 403; sem sessão, HTTP 401.

| Método | Rota | Uso |
| --- | --- | --- |
| GET | /api/visits | Consultar visitas, com filtros serviceId, technicianId, status, from, to |
| GET | /api/services/:id/visits | Listar as visitas de um serviço, por início agendado |
| POST | /api/services/:id/visits | Agendar uma visita, opcionalmente já com técnicos |
| GET | /api/visits/:id | Detalhar a visita, com serviço, cliente e técnicos |
| PATCH | /api/visits/:id | Editar/reagendar e substituir técnicos atomicamente |
| GET | /api/visits/technicians | Listar id e nome de técnicos ativos (ADMIN/PLANNING) |
| PATCH | /api/visits/:id/execution | Registrar início ou conclusão (gestor ou técnico atribuído) |
| PATCH | /api/visits/:id/status | Cancelar (ADMIN/PLANNING) |
| PUT | /api/visits/:id/technicians | Atribuir e desatribuir técnicos (substitui a lista) |

Nas rotas `/api/services/:id/visits`, o `:id` é o do **serviço**. Nas rotas
`/api/visits/:id`, é o da **visita**.

## Agendar e editar

Exemplo de agendamento já com técnicos:

```json
{
  "scheduledStart": "2026-12-01T09:00:00-03:00",
  "scheduledEnd": "2026-12-01T12:00:00-03:00",
  "description": "Instalação de câmera",
  "notes": "Cliente pede contato antes de chegar",
  "technicianIds": ["<id-do-tecnico-1>", "<id-do-tecnico-2>"]
}
```

| Campo | Obrigatório | Regra |
| --- | --- | --- |
| scheduledStart | Sim (na criação) | ISO 8601 com offset; novo agendamento ou reagendamento não pode estar no passado |
| scheduledEnd | Não | ISO 8601 com offset; pode ser null |
| description | Não | Texto; pode ser null |
| notes | Não | Texto; pode ser null |
| technicianIds | Não (criação ou edição) | Lista de ids de técnicos; duplicados são unificados; máximo de 10 |
| confirmConflicts | Não | true confirma o agendamento mesmo com conflito (ver abaixo) |

Campos desconhecidos são recusados com HTTP 400. Isso inclui status,
actualStart e actualEnd: o status da visita não é informado pelo cliente.
No PATCH, ao menos um campo editável é obrigatório; `confirmConflicts` sozinho
não conta.

**Local da visita:** é o local do cliente (`service.client.location`, devolvido
na resposta). O modelo não guarda local próprio na visita; o local de
atendimento é cadastrado no cliente.

A visita e seus técnicos são gravados na **mesma transação**: se algum técnico
for inválido, nenhuma visita é criada.

Exemplo de resposta (resumido):

```json
{
  "id": "<uuid-da-visita>",
  "serviceId": "<uuid-do-servico>",
  "scheduledStart": "2026-12-01T12:00:00.000Z",
  "scheduledEnd": "2026-12-01T15:00:00.000Z",
  "actualStart": null,
  "actualEnd": null,
  "status": "SCHEDULED",
  "description": "Instalação de câmera",
  "notes": "Cliente pede contato antes de chegar",
  "service": {
    "id": "<uuid-do-servico>",
    "title": "Instalação de câmera",
    "status": "PLANNED",
    "client": { "id": "<uuid-do-cliente>", "name": "Cliente", "location": "Lajeado" }
  },
  "technicians": [
    { "technician": { "id": "<id-do-tecnico-1>", "name": "Técnico 1" } }
  ]
}
```

## Atribuir e desatribuir técnicos

`PUT /api/visits/:id/technicians` **substitui a lista inteira** de técnicos da
visita, em uma transação: quem não está na lista é desatribuído e quem é novo é
atribuído. Uma lista vazia remove todos.

```json
{ "technicianIds": ["<id-do-tecnico-1>"], "confirmConflicts": false }
```

- Só usuários com perfil TECHNICIAN e **ativos** podem ser atribuídos. Qualquer
  outro id (outro perfil, usuário inativo ou inexistente) retorna HTTP 422 com
  os ids inválidos, e nada é alterado.
- Uma visita aceita vários técnicos e um técnico pode estar em várias visitas
  (RN-SRV-03).
- Só visitas SCHEDULED aceitam mudança de técnicos (HTTP 409 nos demais status).

## Conflito de horário e regra de confirmação

Um técnico tem **conflito** quando já está em outra visita **agendada ou em execução**
cujo horário se sobrepõe ao da visita que está sendo planejada.

- Os intervalos são semiabertos: uma visita que começa exatamente quando outra
  termina não é conflito.
- Visita sem `scheduledEnd` é tratada como tendo 2 horas de duração
  (`DEFAULT_VISIT_DURATION_MS`, em `visit.service.ts`) apenas para esta checagem.
- A checagem roda ao **criar** uma visita com técnicos, ao **atribuir** técnicos
  novos pelo PUT, ao editar a lista pelo PATCH e ao
  **reagendar** uma visita que já tem técnicos (alterando `scheduledStart` ou
  `scheduledEnd`). Editar só descrição ou observações não dispara a checagem.

Quando há conflito, a API **não grava nada** e responde HTTP 409:

```json
{
  "error": "Há conflito de horário para técnicos desta visita",
  "conflicts": [
    {
      "technician": { "id": "<id-do-tecnico-1>", "name": "Técnico 1" },
      "visit": {
        "id": "<uuid-da-visita-em-conflito>",
        "serviceId": "<uuid-do-servico>",
        "serviceTitle": "Instalação de câmera",
        "scheduledStart": "2026-12-01T12:00:00.000Z",
        "scheduledEnd": "2026-12-01T15:00:00.000Z"
      }
    }
  ],
  "confirmation": "Para agendar mesmo assim, reenvie a requisição com confirmConflicts: true"
}
```

**Regra de confirmação:** o conflito é um aviso, não um bloqueio definitivo. Para
agendar mesmo assim, o cliente reenvia a **mesma requisição** com
`"confirmConflicts": true`. A interface deve mostrar os conflitos ao usuário
antes de reenviar. A confirmação vale só para aquela requisição.

Para evitar que duas pessoas atribuam o mesmo técnico a horários sobrepostos ao
mesmo tempo, as linhas dos técnicos envolvidos são bloqueadas durante a
transação (`SELECT ... FOR UPDATE`, em ordem de id).

## Consultar visitas

`GET /api/visits` aceita filtros combináveis, todos opcionais:

| Filtro | Regra |
| --- | --- |
| serviceId | UUID do serviço |
| technicianId | Id do técnico atribuído |
| status | SCHEDULED, IN_PROGRESS, COMPLETED ou CANCELLED |
| from, to | Período do **início agendado** (`scheduledStart`), inclusivo; datas ou data e hora ISO 8601 |

O resultado vem ordenado por início agendado. `from` posterior a `to`, status
desconhecido e UUID inválido retornam HTTP 400.

## Status e regras

A visita nasce sempre com status SCHEDULED. Os valores aceitos pela API para
o status são SCHEDULED, IN_PROGRESS, COMPLETED e CANCELLED. Os requisitos não
enumeram os status da visita, então esses valores seguem os do serviço.

- `PATCH /api/visits/:id/execution`: body `{"status":"IN_PROGRESS"}` ou `{"status":"COMPLETED","notes":"..."}`. Horários reais são definidos pelo servidor. Técnico atribuído ou gestor pode iniciar visita agendada e concluir visita em execução. Gestor pode concluir visita agendada cujo horário já passou, registrando somente o fim real (início permanece nulo).
- `PATCH /api/visits/:id/status`: body `{"status":"CANCELLED"}`, apenas ADMIN/PLANNING, para visitas ainda abertas. Concluídas e canceladas são terminais; não ocupam o planejamento de técnicos.
- Criação e alterações do período para o passado retornam 422; visitas antigas permanecem no histórico e podem ser concluídas ou canceladas.

- Serviço COMPLETED ou CANCELLED não aceita nova visita (HTTP 409).
- A edição (PATCH) e a troca de técnicos só são permitidas enquanto a visita
  está SCHEDULED; em qualquer outro status retornam HTTP 409.
- O fim agendado não pode anteceder o início. Se ambos vêm no body, o erro é
  HTTP 400 com o campo scheduledEnd em `fields`. Se só um deles é enviado, o
  valor é validado contra o que já está salvo (HTTP 422).
- Serviço ou visita inexistente retorna HTTP 404; UUID inválido, HTTP 400.
- Não há exclusão de visita. O encerramento é feito por status.
- Alterações que envolvem várias gravações (visita e técnicos, troca de lista de
  técnicos) usam transação (RNF06). A criação bloqueia a linha do serviço e a
  edição bloqueia a linha da visita (`SELECT ... FOR UPDATE`).

## Testes de integração

Arquivo: [visit.integration.test.ts](../api/tests/visit.integration.test.ts).

A suíte cobre vínculos, datas e conflitos:

- Agendar, listar em ordem de início, consultar e reagendar uma visita, com o
  local vindo do cliente.
- Recusar entrada inválida (fim antes do início, data fora do ISO 8601, body
  vazio, status no body, UUID inválido, PATCH vazio ou só com confirmação) sem
  criar ou alterar visitas, e validar o PATCH parcial contra o valor salvo.
- Bloquear visita em serviço concluído ou cancelado, bloquear edição de
  visita que não esteja SCHEDULED e responder 404 para registros inexistentes.
- Atribuir, substituir e remover técnicos, unificar duplicados, recusar
  usuários que não são técnicos ativos sem alterar o vínculo existente e
  garantir que um técnico inválido impede a criação da visita (atomicidade).
- Sinalizar conflito de horário ao criar, ao atribuir e ao reagendar, aceitar a
  confirmação explícita, não tratar como conflito visitas encostadas, outros
  técnicos ou visitas canceladas, e assumir 2 horas para visitas sem fim.
- Filtrar visitas por serviço, técnico, status e período, e recusar filtros
  inválidos.
- Retornar 401 sem sessão e 403 para operações gerenciais por técnico ou execução sem vínculo; impedir consulta de visitas de outros técnicos.
- Recusar agendamento/reagendamento no passado; permitir concluir visita atrasada, registrar execução e cancelar com autorização.

Os testes usam Supertest, Better Auth, Prisma e PostgreSQL descartável
provisionado pelo global setup da API. **Não** usam banco de produção.

```bash
npm run db:generate --prefix api
npm run test:integration --prefix api
```

A validação ponta a ponta em navegador e a homologação em produção são verificações separadas da suíte de integração.