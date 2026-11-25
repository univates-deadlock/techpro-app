# TechPro — Entrega final e backlog

## Escopo final da entrega acadêmica — 25/11/2026

A entrega foi congelada por decisão de escopo da equipe. O PRD original preserva a visão do produto e a rastreabilidade das necessidades levantadas; não representa aceite integral pelo cliente. Esta matriz distingue código integrado, funcionalidade apenas de API e itens pós-MVP. Não equivale a homologação ou validação de produção.

| Módulo | Situação na main | Evidência |
| --- | --- | --- |
| Autenticação, sessão, perfis, usuários e clientes | Interface + API; técnico sem acesso comercial | PRs #22, #29, #32, #57 |
| Orçamentos e itens | Interface + API; envio, aprovação, rejeição e PDF; expiração manual somente na API | PRs #40, #44, #108, #110 |
| Serviços e referência à OS externa | Interface e API de criação direta/via orçamento aprovado, consulta, filtros, edição, referência à OS externa e transições para ADMIN/PLANNING | PRs #112 e #120; [contrato](service-api.md) |
| Garantias e revisões | Interface de listagem, criação e edição; alteração de status de revisões; API com operações adicionais | PRs #113, #117; [contrato](aftercare-api.md) |
| Alertas e dashboard | API e indicadores comerciais/operacionais reais para ADMIN/PLANNING; dashboard técnico separado sem indicadores gerenciais | PR #113 |
| Evidências de aprovação | API de upload/leitura privada S3, testada em ambiente descartável; UI de upload e comprovação de configuração em produção pendentes | PR #114; [contrato](quote-evidence.md) |
| Visitas e atribuição | API integrada de planejamento, técnicos ativos, conflitos, validação de datas, agenda por vínculo e execução/cancelamento; componentes preservados, mas tela separada retirada da entrega acadêmica. O período previsto é acompanhado em Serviços. | PRs #116, #120 e #122; [contrato](visit-api.md) |

### Decisão de escopo — agenda e visitas

Em 25/11/2026, após revisão interna da demonstração, a equipe decidiu por maioria retirar a opção Visitas da interface da entrega acadêmica e manter o planejamento de início/fim previsto no módulo Serviços. A tela separada duplicava informações de planejamento e não oferecia a visualização mensal desejada. A API, a modelagem, os componentes e os dados existentes foram preservados; a retirada não significa que todo o trabalho do módulo foi descartado. A decisão é da equipe, não um aceite formal do cliente.

### Evolução pós-MVP (backlog)

- Histórico consolidado do cliente e melhorias de filtros/experiência operacional (#85, #86). A interface de serviços e a conversão de orçamento aprovado já estão integradas.
- Desenvolver uma agenda mensal integrada aos serviços, com nome e perfil dos técnicos ativos cadastrados, identificação do serviço, cliente/local, previsão de início e fim e edição dessas datas diretamente na visualização. Evitar um CRUD separado que duplique o planejamento; reaproveitar as APIs existentes e validar atribuições, conflitos e permissões. A execução de visitas na interface fica fora da entrega atual.
- Expiração pela UI, anexar/visualizar evidências de forma integrada e validar armazenamento privado/persistência no ambiente publicado (#65–#67; RF09, RF23, RNF08). A aprovação de orçamento funciona sem anexo.
- Recuperação/alteração de senha, visão técnica do dashboard e eventuais ações adicionais de garantias/revisões (por exemplo, exclusão pela interface).
- Validação ponta a ponta e testes adicionais de regressão, permissões, segurança, responsividade, acessibilidade, navegadores e desempenho (RNF05; #87–#95); homologação da publicação, smoke test, persistência e rollback (#99–#107). CI não substitui homologação.
- Backup automático diário e teste de restauração (RNF09, #98; PR #115 fechado sem merge). Necessário antes de adoção produtiva definitiva.
- Licitações manuais (opcional originalmente), automação de orçamentos/pesquisa de preços, busca automática de licitações, integrações com estoque/OS, notificações por WhatsApp/e-mail, portal externo e venda de produtos por técnicos. Estoque e OS oficial permanecem no software atual.

### Rastreabilidade do PRD

RF01–RF08: núcleo integrado; RF09: interface parcial (expiração via API); RF10–RF12: UI/API integradas; RF13–RF16: cobertura parcial pela API, com planejamento, atribuição e execução autorizados; interface de visitas retirada e agenda visual pós-MVP; RF17–RF20: APIs e interfaces/indicadores integrados; RF21: cobertura parcial, painel gerencial ADMIN/PLANNING; RF22: cobertura parcial, filtros comerciais e de serviços disponíveis na interface; filtros de visitas na API; RF23: API integrada, interface e implantação de armazenamento pendentes. RNF09 foi adiado; RNF05 e verificações abrangentes de QA não possuem comprovação final nesta entrega. Os demais requisitos permanecem como especificação, não certificação de conformidade.

### Validação e operação

A documentação de entrega está centralizada no GitHub: [PRD](documento-requisitos.md), [modelagem](modelagem-dados.md) e [índice dos guias técnicos](README.md). A aplicação possui pipeline de CI/CD e ambiente publicado previsto em https://app.matbdev.com. A integração das interfaces de serviços e visitas passou pelas verificações automatizadas antes da retirada da tela de visitas; o estado da implantação e a aceitação pelo cliente não foram revalidados nesta revisão. Consulte o [guia de deploy](deploy.md) e o [Kanban consolidado](https://github.com/univates-deadlock/techpro-app/issues/109).
