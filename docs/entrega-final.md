# TechPro — Entrega final e backlog

## Escopo final da entrega acadêmica — 25/11/2026

A entrega foi congelada por decisão de escopo da equipe. O PRD original preserva a visão do produto e a rastreabilidade das necessidades levantadas; não representa aceite integral pelo cliente. Esta matriz distingue código integrado, funcionalidade apenas de API e itens pós-MVP. Não equivale a homologação ou validação de produção.

| Módulo | Situação na main | Evidência |
| --- | --- | --- |
| Autenticação, sessão, perfis, usuários e clientes | Interface + API; técnico sem acesso comercial | PRs #22, #29, #32, #57 |
| Orçamentos e itens | Interface + API; envio, aprovação, rejeição e PDF; expiração manual somente na API | PRs #40, #44, #108, #110 |
| Serviços e referência à OS externa | API de criação direta/via orçamento aprovado, consulta, edição e transições; tela de serviços permanece placeholder | PR #112; [contrato](service-api.md) |
| Garantias e revisões | Interface de listagem, criação e edição; alteração de status de revisões; API com operações adicionais | PRs #113, #117; [contrato](aftercare-api.md) |
| Alertas e dashboard | API e indicadores comerciais/operacionais reais para ADMIN/PLANNING; sem agenda individual do técnico | PR #113 |
| Evidências de aprovação | API de upload/leitura privada S3, testada em ambiente descartável; UI de upload e comprovação de configuração em produção pendentes | PR #114; [contrato](quote-evidence.md) |
| Visitas e atribuição | API de planejamento, atribuição e consulta para ADMIN/PLANNING, com verificação de conflitos; sem agenda individual, execução ou interface | [PR #116](https://github.com/univates-deadlock/techpro-app/pull/116), [CI](https://github.com/univates-deadlock/techpro-app/actions/runs/45474875050) |

### Evolução pós-MVP (backlog)

- Interface de serviços, conversão de orçamento aprovado em serviço pela UI, filtros operacionais e histórico consolidado do cliente (#70, #85, #86).
- Desenvolver interface de agendamento/atribuição, agenda pessoal com autorização por vínculo e registro de início, término, observações e transições das visitas (#72–#74, #79–#81; RF13–RF16). Não apresentar esses fluxos como disponíveis no navegador.
- Expiração pela UI, anexar/visualizar evidências de forma integrada e validar armazenamento privado/persistência no ambiente publicado (#65–#67; RF09, RF23, RNF08). A aprovação de orçamento funciona sem anexo.
- Recuperação/alteração de senha, visão técnica do dashboard e eventuais ações adicionais de garantias/revisões (por exemplo, exclusão pela interface).
- Validação ponta a ponta e testes adicionais de regressão, permissões, segurança, responsividade, acessibilidade, navegadores e desempenho (RNF05; #87–#95); homologação da publicação, smoke test, persistência e rollback (#99–#107). CI não substitui homologação.
- Backup automático diário e teste de restauração (RNF09, #98; PR #115 fechado sem merge). Necessário antes de adoção produtiva definitiva.
- Licitações manuais (opcional originalmente), automação de orçamentos/pesquisa de preços, busca automática de licitações, integrações com estoque/OS, notificações por WhatsApp/e-mail, portal externo e venda de produtos por técnicos. Estoque e OS oficial permanecem no software atual.

### Rastreabilidade do PRD

RF01–RF08: núcleo integrado; RF09: interface parcial (expiração via API); RF10–RF12: API, interface futura; RF13–RF14: planejamento e atribuição pela API, com localização derivada do cliente e sem interface; RF15–RF16: pós-MVP; RF17–RF20: APIs e interfaces/indicadores integrados; RF21–RF22: cobertura parcial, sem experiência operacional completa; RF23: API integrada, interface e implantação de armazenamento pendentes. RNF09 foi adiado; RNF05 e verificações abrangentes de QA não possuem comprovação final nesta entrega. Os demais requisitos permanecem como especificação, não certificação de conformidade.

### Validação e operação

Os PRs #108, #110, #112, #113, #114, #116, #117 e #118 estão integrados à main. A CI final do [PR #116](https://github.com/univates-deadlock/techpro-app/actions/runs/45474875050) passou após a sincronização com a main. A documentação de entrega está centralizada no GitHub: [PRD](documento-requisitos.md), [modelagem](modelagem-dados.md) e [índice dos guias técnicos](README.md). A aplicação possui pipeline de CI/CD e ambiente publicado previsto em https://app.matbdev.com; o estado da implantação e a aceitação pelo cliente não foram revalidados nesta revisão. Consulte o [guia de deploy](deploy.md) e o [Kanban consolidado](https://github.com/univates-deadlock/techpro-app/issues/109).
