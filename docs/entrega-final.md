# TechPro — Entrega final e backlog

## Escopo final da entrega acadêmica — 25/11/2026

A entrega foi congelada por decisão de escopo da equipe. O PRD original preserva a visão do produto e a rastreabilidade das necessidades levantadas; não representa aceite integral pelo cliente. Esta matriz distingue código integrado, funcionalidade apenas de API e itens pós-MVP. Não equivale a homologação ou validação de produção.

| Módulo | Situação na main | Evidência |
| --- | --- | --- |
| Autenticação, sessão, perfis, usuários e clientes | Interface + API; técnico sem acesso comercial | PRs #22, #29, #32, #57 |
| Orçamentos e itens | Interface + API; envio, aprovação, rejeição e PDF; expiração manual somente na API | PRs #40, #44, #108, #110 |
| Serviços e referência à OS externa | Interface e API de criação direta/via orçamento aprovado, consulta, filtros, edição, referência à OS externa e transições para ADMIN/PLANNING | PRs #112 e #120; [contrato](service-api.md) |
| Garantias e revisões | Interface de listagem, criação e edição; alteração de status de revisões; API com operações adicionais | PRs #113, #117; [contrato](aftercare-api.md) |
| Alertas e dashboard | API e indicadores comerciais/operacionais reais para ADMIN/PLANNING; sem agenda individual do técnico | PR #113 |
| Evidências de aprovação | API de upload/leitura privada S3, testada em ambiente descartável; UI de upload e comprovação de configuração em produção pendentes | PR #114; [contrato](quote-evidence.md) |
| Visitas e atribuição | Interface e API de planejamento, consulta, filtros, edição e conflitos para ADMIN/PLANNING; seleção inicial de técnicos por ADMIN; PLANNING sem seletor funcional e troca na edição indisponível no navegador; agenda individual e execução pós-MVP | PRs #116 e #120; [contrato](visit-api.md) |

### Evolução pós-MVP (backlog)

- Histórico consolidado do cliente e melhorias de filtros/experiência operacional (#85, #86). A interface de serviços e a conversão de orçamento aprovado já estão integradas.
- Completar atribuição de técnicos no navegador: disponibilizar lista de técnicos ativos para PLANNING e permitir edição da atribuição (o CORS atual não permite PUT). Completar agenda individual com autorização por vínculo, registro de início/término, observações e transições de execução/cancelamento (#72–#74, #79–#81; RF14–RF16). O agendamento, edição de horários, filtros e confirmação de conflitos já possuem interface integrada; não apresentar a execução técnica como disponível.
- Expiração pela UI, anexar/visualizar evidências de forma integrada e validar armazenamento privado/persistência no ambiente publicado (#65–#67; RF09, RF23, RNF08). A aprovação de orçamento funciona sem anexo.
- Recuperação/alteração de senha, visão técnica do dashboard e eventuais ações adicionais de garantias/revisões (por exemplo, exclusão pela interface).
- Validação ponta a ponta e testes adicionais de regressão, permissões, segurança, responsividade, acessibilidade, navegadores e desempenho (RNF05; #87–#95); homologação da publicação, smoke test, persistência e rollback (#99–#107). CI não substitui homologação.
- Backup automático diário e teste de restauração (RNF09, #98; PR #115 fechado sem merge). Necessário antes de adoção produtiva definitiva.
- Licitações manuais (opcional originalmente), automação de orçamentos/pesquisa de preços, busca automática de licitações, integrações com estoque/OS, notificações por WhatsApp/e-mail, portal externo e venda de produtos por técnicos. Estoque e OS oficial permanecem no software atual.

### Rastreabilidade do PRD

RF01–RF08: núcleo integrado; RF09: interface parcial (expiração via API); RF10–RF12: UI/API integradas; RF13: planejamento UI/API, localização derivada do cliente e serviço pode existir sem visitas; RF14: atribuição API e seleção inicial ADMIN, com limitações de edição no navegador e seleção PLANNING; RF15–RF16: pós-MVP; RF17–RF20: APIs e interfaces/indicadores integrados; RF21–RF22: cobertura parcial, filtros comerciais e de planejamento disponíveis, sem experiência operacional individual completa; RF23: API integrada, interface e implantação de armazenamento pendentes. RNF09 foi adiado; RNF05 e verificações abrangentes de QA não possuem comprovação final nesta entrega. Os demais requisitos permanecem como especificação, não certificação de conformidade.

### Validação e operação

A documentação de entrega está centralizada no GitHub: [PRD](documento-requisitos.md), [modelagem](modelagem-dados.md) e [índice dos guias técnicos](README.md). A aplicação possui pipeline de CI/CD e ambiente publicado previsto em https://app.matbdev.com. A integração das interfaces de serviços e visitas passou pelas verificações automatizadas; o estado da implantação e a aceitação pelo cliente não foram revalidados nesta revisão. Consulte o [guia de deploy](deploy.md) e o [Kanban consolidado](https://github.com/univates-deadlock/techpro-app/issues/109).
