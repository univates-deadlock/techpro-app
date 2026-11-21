# Evidências de aprovação de orçamentos (RF23 / RNF08)

A API mantém o anexo opcional **depois** da aprovação do orçamento.
O fluxo de aprovação pode ser concluído sem arquivo. Todas as rotas
exigem sessão ativa e perfil `ADMIN` ou `PLANNING`.

- `POST /api/quotes/:id/evidence`: corpo binário (não multipart),
  `Content-Type` igual a `application/pdf`, `image/png` ou
  `image/jpeg`, limite de **10 MiB**. Responde 201 com
  `{ "url": "/api/quotes/:id/evidence/:filename" }`.
- `GET /api/quotes/:id/evidence/:filename`: lê o objeto privado no
  RustFS e retorna o conteúdo **somente depois** de validar a sessão
  e a referência registrada no orçamento. Anônimo: 401; técnico: 403.
- O usuário não fornece bucket, chave nem filename do armazenamento.
  O nome é gerado pelo backend, e as assinaturas de arquivo são
  verificadas antes de enviar o conteúdo ao S3.
- Evidência duplicada ou status diferente de `APPROVED`: 409.
  Erro de armazenamento: 503, sem expor credenciais ou mensagens internas.
  Limite ultrapassado: 413.

## Fluxo e persistência

```text
Frontend → API Express (cookie + ADMIN/PLANNING)
         → valida arquivo e status APPROVED
         → RustFS via API S3 (bucket privado)
         → PostgreSQL (chave quotes/<quoteId>/<uuid>.<ext>)
GET /api/quotes/:id/evidence/:filename
         → valida autorização e compara chave no PostgreSQL
         → GetObject do S3 → arquivo para usuário autenticado
```

O campo legado `Quote.decisionEvidenceUrl` é reutilizado para a
**chave do objeto**, não para uma URL pública. A rota interna de download
permanece estável para o frontend; não use URLs pré-assinadas nem exponha
as portas do RustFS ao navegador.

## Frontend

Exemplo com um `File` já selecionado no formulário:

```ts
const response = await fetch(apiBase + "/api/quotes/" + quoteId + "/evidence", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": file.type },
  body: file,
});
```

A URL relativa recebida deve ser aberta com sessão autenticada. O frontend
da issue #67 deve chamar o upload após a aprovação confirmada, pois
anexos de orçamentos em rascunho ou enviados são rejeitados.

## Provisionamento e segurança

O RustFS compartilhado está no draft PR do repositório privado
`univates-deadlock/deadlock-deploy`. Na VM, a API utiliza
`http://deadlock-rustfs:9000` via `deadlock_edge`, sem Caddy,
porta pública ou exposição do console.

Antes de habilitar anexos:

1. Provisionar o RustFS com credenciais administrativas únicas e fortes.
2. Criar o bucket **privado** `techpro-evidences`.
3. Criar uma conta de serviço exclusiva para a TechPro, autorizada
   somente a `s3:GetObject`, `s3:PutObject` e `s3:DeleteObject`
   nesse bucket (sem permissões de listagem global ou IAM).
4. Definir `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`,
   `S3_ACCESS_KEY_ID` e `S3_SECRET_ACCESS_KEY` no `api/.env`
   **não versionado** da VM. Manter o arquivo em modo 600.
Se faltar configuração, o restante da aplicação continua disponível,
mas anexos retornam 503. Nunca colocar valores reais em PRs, logs,
secrets de frontend ou no Compose versionado.

## Testes

Os testes de integração iniciam um RustFS 1.0.4 e um PostgreSQL 17
**descartáveis** no Docker. Eles cobrem S3 Put/Get, persistência da
chave, status, RBAC, formato e tamanho. Nenhum teste conecta ao bucket
de produção. `npm test --prefix api` exige Docker.
