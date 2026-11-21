# Evidências de aprovação de orçamentos (RF23 / RNF08)

Esta API permite anexar uma evidência opcional **depois** de o orçamento estar
`APPROVED`. O fluxo de aprovação continua funcional sem arquivo. As rotas
exigem sessão ativa e perfil `ADMIN` ou `PLANNING`.

- `POST /api/quotes/:id/evidence`: envie o próprio arquivo como corpo binário
  (não `multipart/form-data`), com `Content-Type` igual a
  `application/pdf`, `image/png` ou `image/jpeg`. O limite é 10 MiB.
  A resposta 201 é `{ "url": "/api/quotes/:id/evidence/:filename" }`.
- `GET /api/quotes/:id/evidence/:filename`: acessa o anexo apenas com
  cookie de sessão autorizado. A URL está guardada em
  `Quote.decisionEvidenceUrl`. Acesso anônimo retorna 401; técnico, 403.
- Uma aprovação admite um arquivo. Reenvio retorna 409, sem substituir
  silenciosamente uma evidência existente. Arquivo com assinatura incompatível
  com o tipo declarado é rejeitado.
- O backend gera o nome do arquivo; nomes de clientes não são usados como paths.
  Os arquivos **não** são publicados em rota estática.

## Consumo pelo frontend

Exemplo com a `File` escolhida no input de arquivo:

```ts
const response = await fetch(apiBase + "/api/quotes/" + quoteId + "/evidence", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": file.type },
  body: file,
});
```

Adicione `apiBase` à URL relativa retornada para abrir a evidência.
Não use `multipart/form-data`; não inclua um token no endereço.

## Persistência

O volume nomeado `evidence_data` está montado em `/app/evidence` na API,
independente do ciclo de vida do container. **Não** execute
`docker compose down -v` em produção. Fora do Compose, configure
`EVIDENCE_DIR` para um diretório privado, persistente, acessível somente pela
API. Inclua o volume de evidências no plano de backup, além do PostgreSQL.

Antes de disponibilizar a funcionalidade, validar em ambiente isolado:
upload, autorização, retorno 413 para limite ultrapassado e persistência
após recriação de container.
