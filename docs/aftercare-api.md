# API de garantias, revisões, alertas e dashboard

Contrato para os módulos de pós-serviço (RF17–RF21). Todos os endpoints
exigem **sessão ativa** e perfil **ADMIN** ou **PLANNING**. Requisições
sem sessão retornam 401; TECHNICIAN e usuários sem autorização, 403.
Erros de validação retornam 400 com campos. Identificadores são UUID.

## Garantias — /api/warranties

| Método | Rota | Resultado |
| --- | --- | --- |
| GET | /api/warranties | Lista; filtros opcionais serviceId, type, from, to |
| GET | /api/warranties/:id | Detalhe; 404 se não existir |
| POST | /api/warranties | Cria; 201 |
| PATCH | /api/warranties/:id | Atualiza campos informados; 200 |
| DELETE | /api/warranties/:id | Exclui; 204 |

Exemplo de criação:

```json
{
  "serviceId": "00000000-0000-4000-8000-000000000001",
  "type": "MANUFACTURER",
  "startsAt": "2026-11-01",
  "endsAt": "2027-11-01",
  "manufacturer": "Fabricante",
  "productReference": "Modelo X",
  "description": "Garantia do dispositivo"
}
```

Os períodos são datas de calendário no formato `AAAA-MM-DD` (inclusivas).
`endsAt` nunca pode anteceder `startsAt`. Um serviço admite múltiplas
garantias independentes. `manufacturer` e `productReference` são
permitidos apenas no tipo `MANUFACTURER`; são opcionais. O serviço informado
deve existir. A API permite campos opcionais nulos (por exemplo, `notes`).

## Revisões — /api/revisions

| Método | Rota | Resultado |
| --- | --- | --- |
| GET | /api/revisions | Lista; filtros serviceId, clientId, status, from, to |
| GET | /api/revisions/:id | Detalhe |
| POST | /api/revisions | Cria com status PENDING; 201 |
| PATCH | /api/revisions/:id | Altera data, visita, notas ou status; 200 |
| DELETE | /api/revisions/:id | Exclui somente se PENDING; 204 |

Exemplo de criação:

```json
{
  "serviceId": "00000000-0000-4000-8000-000000000001",
  "scheduledAt": "2026-12-01T14:00:00-03:00",
  "notes": "Retorno preventivo",
  "visitId": null
}
```

Datas de revisão (`scheduledAt`, `from`, `to`) exigem ISO 8601
**com fuso horário explícito**. O cliente pode agendar uma revisão sem visita
e vinculá-la mais tarde, desde que a visita pertença ao mesmo serviço.

Transições permitidas:

- PENDING → SCHEDULED, COMPLETED ou CANCELLED
- SCHEDULED → PENDING, COMPLETED ou CANCELLED
- COMPLETED e CANCELLED: estados finais, não editáveis

Transições inválidas retornam 409. Revisões concluídas e canceladas
permanecem no histórico. O filtro de período utiliza instantes absolutos,
não datas locais sem timezone.

## Alertas — GET /api/alerts?days=14

Retorna as seções:

- `revisions.overdue`: PENDING/SCHEDULED com data anterior ao dia atual;
- `revisions.upcoming`: PENDING/SCHEDULED dentro da janela futura;
- `warranties.expired`: término anterior ao dia atual;
- `warranties.expiring`: término dentro da janela futura.

Cada seção contém `{ count, items }`; `count` reflete todos os registros
e `items` retorna os primeiros **20**, ordenados por data.
O campo `window` retorna `start`, `endExclusive`, `days` e
`timeZone` para identificação da janela. A janela inclui hoje e
é exclusiva no limite final. O parâmetro `days` aceita 1 a 90 (padrão 14).

As datas de calendário são calculadas em **America/Sao_Paulo**, não a
partir do timezone do navegador ou do container. Os alertas são internos:
não existem e-mails/WhatsApp automáticos no MVP.

## Dashboard — GET /api/dashboard?days=14

Resumo agregado com `quotes` (contagem por status),
`services.upcoming`, `visits.upcoming` e `alerts`.
Serviços e visitas concluídos/cancelados não entram nas próximas agendas.
Listas são limitadas a 20 registros; contagens são totais no período.

O frontend consome este endpoint sem calcular vencimentos no navegador.
O perfil TECHNICIAN não recebe dados comerciais; a integração da agenda
específica do técnico depende dos módulos de visitas do grupo.

## Dependências de integração

Os modelos Prisma já estão versionados: não foi criada nova migration.
A criação operacional de serviços está no PR #112 e precisa ser integrada
antes da demonstração ponta a ponta com garantias e revisões.
O fluxo de orçamento e decisão está nos PRs #108 e #110.
