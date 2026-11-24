# TechPro — Documento de Requisitos

**Universidade do Vale do Taquari — Univates**  
**Disciplina:** Laboratório de Programação para Internet  
**Professor:** Mateus Roveda  
**Local:** Lajeado, Rio Grande do Sul  
**Data:** setembro de 2026

## Integrantes

- Alexandra König Padilha
- Diogo Felipe Zanco
- Mateus Carniel Brambilla
- Taina Luiza Schmidt

 > **Nota de fechamento (24/11/2026):** este documento preserva os requisitos e casos de uso originalmente levantados. O MVP efetivamente entregue é menor; consulte a [matriz de entrega final e backlog pós-MVP](entrega-final.md). As funcionalidades adiadas não são consideradas concluídas.

---

## Sumário

1. [Visão Geral](#1-visão-geral)
   - [1.1 Fronteira do produto](#11-fronteira-do-produto)
2. [Problema](#2-problema)
3. [Solução Proposta](#3-solução-proposta)
4. [Objetivos e Critérios de Sucesso](#4-objetivos-e-critérios-de-sucesso)
5. [Escopo](#5-escopo)
   - [5.1 Escopo originalmente previsto para o MVP](#51-escopo-originalmente-previsto-para-o-mvp)
   - [5.2 Opcional / meta adicional do MVP](#52-opcional--meta-adicional-do-mvp)
   - [5.3 Evoluções futuras — fora do MVP](#53-evoluções-futuras--fora-do-mvp)
6. [Usuários e Atores](#6-usuários-e-atores)
7. [Requisitos Funcionais](#7-requisitos-funcionais)
8. [Requisitos Não Funcionais](#8-requisitos-não-funcionais)
9. [Histórias de Usuário](#9-histórias-de-usuário)
10. [Casos de Uso](#10-casos-de-uso)
    - [10.1 Diagrama geral](#101-diagrama-geral)
    - [10.2 Catálogo e rastreabilidade](#102-catálogo-e-rastreabilidade)
    - [10.3 Casos de uso detalhados com regras de negócio](#103-casos-de-uso-detalhados-com-regras-de-negócio)
        - [UC03 - Criar e editar orçamento](#uc03---criar-e-editar-orçamento)
        - [UC04 - Registrar decisão do orçamento](#uc04---registrar-decisão-do-orçamento)
        - [UC05 - Criar e planejar serviço](#uc05---criar-e-planejar-serviço)
        - [UC08 - Gerenciar garantias](#uc08---gerenciar-garantias)
        - [UC09 - Gerenciar revisões](#uc09---gerenciar-revisões)
11. [Modelo de Banco de Dados](#11-modelo-de-banco-de-dados)
    - [11.1 Entidades principais](#111-entidades-principais)
12. [Decisões de Implementação](#12-decisões-de-implementação)
   - [12.1 Decisões Gerais](#121-decisões-gerais)
13. [Fora de Escopo e Itens Opcionais](#13-fora-de-escopo-e-itens-opcionais)
    - [13.1 Opcional para o MVP](#131-opcional-para-o-mvp)
    - [13.2 Fora do MVP](#132-fora-do-mvp)
14. [Glossário](#14-glossário)

---

# 1. Visão Geral

Este documento de requisitos descreve o sistema interno proposto para a TechPro. O documento consolida o levantamento realizado com o cliente e define problema, solução, escopo, requisitos, histórias de usuário, casos de uso, modelo de dados, decisões de implementação e teste, itens opcionais e evoluções futuras.

## 1.1 Fronteira do produto

O novo sistema não substitui o software atualmente utilizado pela TechPro para estoque e ordens de serviço.

No MVP, a OS oficial e o estoque continuam no software existente; o novo sistema centraliza o ciclo comercial, planejamento, agenda, acompanhamento gerencial e pós-serviço.

---

# 2. Problema

A operação da TechPro possui informações relevantes distribuídas entre WhatsApp, ligações, visitas, agenda, planilhas e um software já utilizado para estoque e ordens de serviço.

Essa fragmentação dificulta visualizar o histórico do cliente, acompanhar a evolução de um orçamento, planejar visitas, distribuir técnicos e manter controles de garantia e revisão. 

A maior parte das solicitações comerciais chega por WhatsApp, com entradas adicionais por ligação, visita e licitação.

A pesquisa de preços e a elaboração de orçamentos possuem etapas manuais e dependência de planilhas. O planejamento operacional utiliza agenda e controles paralelos.  

Não existe uma visão única do ciclo entre um orçamento, planejamento, serviço e pós-serviço. Garantias e revisões precisam de acompanhamento e avisos internos.  

Licitações podem ser acompanhadas manualmente; sua descoberta automatizada não faz parte do MVP.

---

# 3. Solução Proposta

Uma aplicação web interna que cobre o ciclo:

**cliente → orçamento → serviço/visita**

Construir uma aplicação web exclusivamente interna para registrar e acompanhar clientes, orçamentos, aprovações, serviços, visitas, técnicos, referência à OS externa, garantias, revisões e alertas. O gestor terá visão completa; a equipe de orçamento/planejamento gerenciará o fluxo comercial e operacional; técnicos acessarão os atendimentos atribuídos e poderão registrar informações de visita.

---

# 4. Objetivos e Critérios de Sucesso

- Centralizar em uma única aplicação o histórico comercial e de planejamento de cada cliente. 
- Preservar todos os orçamentos aprovados. 
- Permitir que um serviço aprovado ou direto seja dividido em uma ou mais visitas e tenha técnicos atribuídos. Permitir consulta rápida da agenda e das pendências de garantia e revisão.
- Manter rastreabilidade para a OS existente por meio de uma referência externa.
- Reduzir dependência de planilhas para acompanhamento de orçamento, agenda, garantias e revisões.

---

# 5. Escopo

## 5.1 Escopo originalmente previsto para o MVP

- Autenticação e perfis de acesso: gestor, orçamento/planejamento e técnico.
- Cadastro de clientes, com suas devidas informações.
- Cadastro e acompanhamento de serviços.
- Orçamentos com itens de produto/serviço/outro, totais e registro de aprovação. Criação de serviço a partir de orçamento aprovado ou diretamente para suporte, manutenção, revisão, garantia ou outro motivo.
- Planejamento de serviço com uma ou mais visitas e atribuição de técnicos.
- Referência manual à OS mantida no software existente.
- Registro gerencial de visita e conclusão, sem substituir a OS oficial.
- Garantias de serviço e de fabricante separadas.
- Revisões programadas e alertas internos. 
- Painel operacional básico e busca/filtros.

## 5.2 Opcional / meta adicional do MVP

O módulo de acompanhamento manual de licitações é considerado opcional para fechamento do MVP. Deve ser implementado somente depois que o núcleo comercial, planejamento, vendas e pós-serviço estiver estável.

- Cadastro manual de licitações com identificador, órgão/empresa, objeto, prazo, valor estimado, responsável, documentos e status.
- Visões adicionais no painel operacional para funil comercial e indicadores, desde que não comprometam requisitos obrigatórios.

## 5.3 Evoluções futuras — fora do MVP

Além dos itens originalmente previstos para evolução, foram adiados no fechamento: interface de serviços e visitas, agenda e execução dos técnicos (RF10–RF16 na cobertura de interface/visitas), expiração e evidências pela interface (RF09/RF23), histórico consolidado, filtros operacionais, recuperação de senha, backup (RNF09) e validação ampliada de QA/produção (incluindo RNF05). A API de serviços, garantias/revisões e indicadores permanece integrada; a API de visitas está validada no PR #116, aguardando merge. Veja a [matriz de rastreabilidade](entrega-final.md).

- Automação de orçamento, sujeita a reavaliação com o cliente.
- Pesquisa automática de preços e integração com catálogos/fornecedores. 
- Busca automatizada de licitações.  
- Integração com o software atual para sincronizar ordens de serviço, produtos e estoque.
- Envio automático de notificações por WhatsApp ou e-mail. 
- Portal externo para clientes acompanharem orçamento, serviço, garantia ou revisão.
- Substituição do controle de estoque ou da OS oficial.  
- Venda de produtos por técnicos, sem movimentação de estoque.

---

# 6. Usuários e Atores

| Ator | Contexto | Principais permissões |
| :---- | :---- | :---- |
| **Gestor / Administrador** | Responsável com atuação transversal entre comercial, planejamento e execução. | Acesso completo; usuários; clientes; orçamentos; planejamento; garantias; revisões; painel operacional; licitações. |
| **Orçamento / Planejamento** | Duas pessoas fixas responsáveis pela parte comercial e planejamento. | Clientes; orçamentos; aprovação; serviços; visitas; técnicos; OS externa; garantias; revisões; alertas; licitações. |
| **Técnico** | Duas pessoas fixas de instalação e um técnico variável quando necessário. | Agenda e serviços atribuídos; dados necessários do cliente; informações da visita. |

---

# 7. Requisitos Funcionais

| ID | Requisito verificável | 
| :---- | :---- |
| **RF01** | O sistema deve exigir autenticação para qualquer funcionalidade interna. |
| **RF02** | O administrador deve poder criar, editar, ativar e desativar usuários internos. |
| **RF03** | O sistema deve restringir funcionalidades conforme os perfis de administrador, planejador e técnico. |
| **RF04** | Usuários autorizados devem poder cadastrar, editar, consultar e inativar clientes pessoa física ou jurídica. |
| **RF05** | Usuários de planejamento e administradores devem poder criar um orçamento vinculado a um cliente. |
| **RF06** | Cada orçamento deve aceitar vários itens dos tipos produto, serviço ou outro, com descrição, quantidade, valor unitário (R$) e desconto em reais (R$). |
| **RF07** | O sistema deve recalcular o valor total do orçamento em reais (R$) a partir dos itens e dos descontos por item e geral registrados em R$. |
| **RF08** | O orçamento pode ser editado apenas enquanto estiver em aberto; após aprovado, rejeitado ou expirado, seu conteúdo não pode ser alterado.   |
| **RF09** | O sistema deve permitir registrar aprovação, rejeição ou expiração de um orçamento, com data, observação e evidência opcional. |
| **RF10** | O sistema deve permitir criar serviço a partir de orçamento aprovado ou diretamente para um cliente. |
| **RF11** | Serviços diretos devem registrar uma origem entre SUPORTE, MANUTENÇÃO, REVISÃO, GARANTIA ou OUTRO. |
| **RF12** | Um serviço deve permitir armazenar referência opcional ao número da OS existente no software atual. |
| **RF13** | Um serviço deve possuir uma ou mais visitas planejadas, com data/horário, status, local e observações. |
| **RF14** | Cada visita deve permitir atribuir um ou mais técnicos. |
| **RF15** | Técnicos devem visualizar sua agenda e os serviços/visitas aos quais estão atribuídos. |
| **RF16** | Técnicos devem poder registrar início/fim real, status e observações gerenciais da visita, sem substituir os dados formais da OS externa. |
| **RF17** | Um serviço deve suportar múltiplas garantias, distinguindo garantia de SERVIÇO e de FABRICANTE. |
| **RF18** | Garantias devem registrar início, término, descrição e, para fabricante, fabricante e referência opcional ao produto. |
| **RF19** | Um serviço deve suportar múltiplas revisões com data prevista e status PENDENTE, AGENDADA, REALIZADA ou CANCELADA. |
| **RF20** | O sistema deve exibir alertas internos para revisões próximas/atrasadas e garantias próximas do vencimento. |
| **RF21** | O painel operacional deve apresentar ao menos orçamentos pendentes, serviços/visitas próximas, revisões pendentes e garantias próximas do vencimento. |
| **RF22** | O sistema deve permitir busca e filtragem de clientes, orçamentos, serviços e agenda por informações relevantes e status. |
| **RF23** | Quando uma aprovação possuir evidência, o sistema deve permitir anexar arquivo nos formatos e limites definidos nos RNFs. |

---

# 8. Requisitos Não Funcionais

| ID | Categoria | Critério |
| :---- | :---- | :---- |
| **RNF01** | Privacidade | A aplicação deve ser exclusivamente interna e não deve expor páginas de dados do cliente sem autenticação. |
| **RNF02** | Autorização | Uma tentativa de acessar recurso não permitido ao perfil deve ser bloqueada no backend, independentemente de a interface ocultar ou não o botão. |
| **RNF03** | Segurança em trânsito | A implantação de produção deve utilizar HTTPS para todo acesso ao sistema. |
| **RNF04** | Credenciais | Senhas devem ser armazenadas apenas como hash resistente a senha; nenhuma senha em texto puro pode ser registrada em log. |
| **RNF05** | Desempenho | Em carga de até 20 usuários internos concorrentes, 95% das operações comuns de consulta/cadastro devem responder em até 2 segundos, desconsiderando upload de arquivos. |
| **RNF06** | Integridade | A criação/edição do orçamento, a decisão e a gravação dos itens devem usar transação quando houver mais de uma alteração dependente, evitando estado parcial.  |
| **RNF07** | Mensagens de erro | Falhas de validação devem identificar o campo ou regra violada e não devem resultar apenas em mensagem genérica. |
| **RNF08** | Arquivos | Evidências de aprovação devem aceitar PDF, PNG, JPG/JPEG com no máximo 10 MB por arquivo; arquivos maiores ou de tipo não aceito devem ser recusados com explicação do limite. |
| **RNF09** | Backup | O banco de produção deve possuir backup automático diário, com pelo menos 7 cópias diárias recuperáveis. |
| **RNF10** | Responsividade | Fluxos essenciais devem funcionar sem rolagem horizontal indevida em larguras de 360 px, 768 px e 1280 px. |
| **RNF11** | Compatibilidade | A aplicação deve ser validada na versão estável mais recente de Chrome/Chromium e Firefox (opcional). |
| **RNF12** | Acessibilidade | Formulários e ações principais devem ser operados por teclado, possuir foco visível e rótulos associados aos campos. |
| **RNF13** | Observabilidade | Erros de servidor devem ser registrados com data/hora e contexto técnico suficiente para diagnóstico, sem incluir senhas ou conteúdo sensível desnecessário. |
| **RNF14** | Qualidade | O pipeline de integração deve falhar se lint, verificação de tipos ou testes automatizados obrigatórios falharem. |
| **RNF15** | Persistência temporal | Registros críticos devem manter data de criação e atualização e autoria quando aplicável, permitindo identificar quando e por quem a informação foi criada. |

---

# 9. Histórias de Usuário

| ID | História |
| :---- | :---- |
| **US01** | Como gestor, quero administrar usuários e perfis para controlar quem pode acessar cada parte do sistema. |
| **US02** | Como planejador, quero cadastrar e manter os dados dos clientes para reutilizar essas informações durante o atendimento e planejamento dos serviços. |
| **US03** | Como planejador, quero montar um orçamento com itens para formalizar uma proposta ao cliente. |
| **US04** | Como planejador, quero registrar a decisão de um orçamento (aprovado, rejeitado ou expirado) e anexar uma evidência opcional, para ter o histórico do que foi combinado com o cliente.  |
| **US05** | Como planejador, quero criar um serviço a partir de orçamento aprovado ou diretamente para não forçar todo atendimento a passar por orçamento. |
| **US06** | Como planejador, quero dividir um serviço em uma ou mais visitas e atribuir técnicos para organizar a execução. |
| **US07** | Como técnico, quero visualizar minha agenda e dados necessários do atendimento para saber onde e quando devo executar o serviço. |
| **US08** | Como técnico, quero registrar informações básicas da visita para manter o planejamento atualizado sem duplicar a OS oficial. |
| **US09** | Como planejador, quero registrar garantias de serviço e fabricante separadamente para controlar vencimentos diferentes. |
| **US10** | Como planejador, quero programar revisões futuras para que a empresa não perca o momento de retornar ao cliente. |
| **US11** | Como usuário interno, quero ver alertas de revisão e garantia no sistema para priorizar pendências. |
| **US12** | Como gestor, quero ver um painel operacional do fluxo comercial e operacional para identificar o que precisa de atenção. |
| **US13** | Como planejador, quero vincular o número da OS externa a um serviço para cruzar o novo sistema com o software atual. |

---

# 10. Casos de Uso

## 10.1 Diagrama geral

O diagrama geral apresenta os casos de uso do sistema interno TechPro e a associação dos atores (Gestor/Administrador, Orçamento/Planejamento e Técnico) com cada funcionalidade.

![Diagrama geral de casos de uso da TechPro](../assets/images/prd/diagrama-casos-de-uso.png)

## 10.2 Catálogo e rastreabilidade

| ID | Caso de uso | Atores | RFs | Histórias |
| :---- | :---- | :---- | :---- | :---- |
| **UC01** | Autenticar-se | Todos | RF01, RF03 | US01 |
| **UC02** | Gerenciar clientes | Administrador, Planejamento | RF04 | US02 |
| **UC03** | Criar e editar orçamento | Administrador, Planejamento | RF05-RF08  | US03 |
| **UC04** | Registrar decisão do orçamento | Administrador, Planejamento | RF09, RF23 | US04 |
| **UC05** | Criar e planejar serviço | Administrador, Planejamento | RF10-RF14  | US05, US06, US13  |
| **UC06** | Consultar agenda / visita | Todos conforme permissão | RF13, RF15 | US07  |
| **UC07** | Registrar execução gerencial da visita | Técnico, Administrador | RF16 | US08 |
| **UC08** | Gerenciar garantias | Administrador, Planejamento | RF17, RF18 | US09 |
| **UC09** | Gerenciar revisões | Administrador, Planejamento | RF19 | US10 |
| **UC10** | Visualizar alertas e painel operacional | Todos conforme permissão | RF20, RF21 | US11, US12 |
| **UC11** | Gerenciar usuários | Administrador | RF02, RF03 | US01 |

## 10.3 Casos de uso detalhados com regras de negócio

### UC03 - Criar e editar orçamento

| Campo | Definição |
| :---- | :---- |
| **Atores** | Gestor/Administrador; Orçamento/Planejamento |
| **Pré-condições** | Usuário autenticado e cliente existente. |
| **Gatilho** | Usuário inicia novo orçamento ou alteração de proposta existente. |
| **Pós-condições** | Os orçamentos ficam disponíveis no histórico do cliente. |
| **Rastreabilidade** | RF05-RF08; US03 |

#### Fluxo principal

1. Selecionar o cliente.
2. Criar o orçamento e a primeira versão em estado RASCUNHO.
3. Adicionar um ou mais itens, informando tipo, descrição, quantidade, preço unitário (R$) e desconto em reais (R$), além de desconto geral opcional em reais (R$).
4. O sistema recalcula subtotal e total em R$.
5. Usuário salva e, quando pronta, marca como enviada.
6. Se o cliente pedir alteração, o usuário altera a versão anterior, até que a mesma seja aprovada, rejeitada ou expirada. 

#### Fluxos alternativos / exceções

- Se quantidade ou preço forem inválidos, o sistema recusa a gravação e identifica o campo. Se o orçamento não tiver item, não pode ser marcado como enviado.  
- Um orçamento já enviado e aprovado não pode ser editado; o sistema oferece criar um novo orçamento.

#### Regras de negócio

- **RN-ORC-01:** o ID é único dentro de cada orçamento.  
- **RN-ORC-02:** um orçamento enviado e decidido é imutável quanto a seus itens e valores.  
- **RN-ORC-03:** o total do orçamento é derivado de itens e descontos (todos expressos em R$) e não é digitado livremente.
- **RN-ORC-04:** cada item deve ser classificado como produto, serviço ou outro.

### UC04 - Registrar decisão do orçamento

| Campo | Definição |
| :---- | :---- |
| **Atores** | Gestor/Administrador; Orçamento/Planejamento |
| **Pré-condições** | Existe um orçamento enviado e o cliente comunicou uma decisão. |
| **Gatilho** | Usuário registra aprovação, rejeição ou expiração. |
| **Pós-condições** | A decisão fica vinculada ao orçamento e registrada no histórico. |
| **Rastreabilidade** | RF09, RF23; RNF08; US04 |

#### Fluxo principal

1. Abrir o orçamento.
2. Escolher a decisão.
3. Informar data da decisão e observação quando necessária.
4. Opcionalmente anexar evidência da aprovação.
5. Confirmar.
6. Em caso de aprovação, disponibilizar ação para criar serviço a partir do orçamento.

#### Fluxos alternativos / exceções

- Arquivo acima de 10 MB ou de tipo não permitido é recusado e o limite é informado.  
- Se o orçamento já estiver marcado como aprovado, o sistema impede a edição.

#### Regras de negócio

- **RN-APR-01:** após o orçamento ter a aprovação, o mesmo não pode mais ser editado.
- **RN-APR-02:** evidência é opcional; a aprovação pode existir apenas com data e registro do usuário.
- **RN-APR-03:** aprovar um orçamento não cria nem altera estoque/OS no software externo.

### UC05 - Criar e planejar serviço

| Campo | Definição |
| :---- | :---- |
| **Atores** | Gestor/Administrador; Orçamento/Planejamento |
| **Pré-condições** | Cliente existente; para origem orçamentária, existe orçamento aprovado. |
| **Gatilho** | Usuário precisa planejar uma execução. |
| **Pós-condições** | Serviço e visitas ficam visíveis na agenda dos técnicos atribuídos. |
| **Rastreabilidade** | RF10-RF14; US05-US06, US13 |

#### Fluxo principal

1. Escolher criação a partir de orçamento aprovado ou serviço direto.
2. Definir cliente, local, descrição, origem e período planejado.
3. Quando existir, informar número da OS externa.
4. Adicionar uma ou mais visitas com data e horário.
5. Atribuir um ou mais técnicos a cada visita.
6. Salvar o planejamento.

#### Fluxos alternativos / exceções

- Serviço direto não exige orçamento.
- Se houver conflito de agenda do técnico, o sistema deve ao menos alertar antes da confirmação; o tratamento de conflito pode ser confirmado por usuário autorizado.  
- A referência de OS pode ser preenchida depois do planejamento.

#### Regras de negócio

- **RN-SRV-01:** vínculo com orçamento é opcional, exceto quando origem for orçamento.
- **RN-SRV-02:** a OS oficial permanece no sistema atual; O número da OS externa é apenas referência.
- **RN-SRV-03:** uma visita pode possuir vários técnicos e um técnico pode participar de várias visitas.

### UC08 - Gerenciar garantias

| Campo | Definição |
| :---- | :---- |
| **Atores** | Gestor/Administrador; Orçamento/Planejamento |
| **Pré-condições** | Existe serviço registrado. |
| **Gatilho** | Usuário cadastra garantia após conclusão/entrega. |
| **Pós-condições** | Garantia fica vinculada ao serviço e monitorada pelo painel operacional de alertas. |
| **Rastreabilidade** | RF17-RF18, RF20; US09, US11 |

#### Fluxo principal

1. Selecionar o serviço.
2. Escolher tipo entre serviço e fabricante.
3. Informar período de vigência.
4. Para fabricante, informar quando disponível fabricante e referência do produto.
5. Salvar.
6. O sistema passa a considerar a data de término para alertas internos.

#### Fluxos alternativos / exceções

- O mesmo serviço pode possuir várias garantias.
- Garantias de fabricante podem ter datas diferentes entre produtos.

#### Regras de negócio

- **RN-GAR-01:** garantia da TechPro e garantia do fabricante são registros independentes.
- **RN-GAR-02:** A data de término deve ser posterior ou igual à data de início.
- **RN-GAR-03:** alerta não envia comunicação externa no MVP.

### UC09 - Gerenciar revisões

| Campo | Definição |
| :---- | :---- |
| **Atores** | Gestor/Administrador; Orçamento/Planejamento |
| **Pré-condições** | Existe serviço registrado. |
| **Gatilho** | Empresa deseja programar retorno/revisão. |
| **Pós-condições** | Revisões futuras ficam visíveis em alertas e no histórico do serviço. |
| **Rastreabilidade** | RF19-RF20; US10-US11 |

#### Fluxo principal

1. Selecionar serviço.
2. Cadastrar uma ou mais datas previstas de revisão.
3. Manter status inicial como pendente.
4. Ao combinar atendimento, alterar para status de agendamento e opcionalmente associar uma visita.
5. Após atendimento, marcar como realizada; se não for mais necessária, cancelada.

#### Fluxos alternativos / exceções

- Revisão vencida e não realizada permanece identificada como pendência. Uma revisão pode existir sem visita até que seja agendada.

#### Regras de negócio

- **RN-REV-01:** status válidos são pendente, agendada, realizada e cancelada.
- **RN-REV-02:** serviço pode possuir várias revisões futuras.
- **RN-REV-03:** comunicação automática por WhatsApp/e-mail está fora do MVP.

---

# 11. Modelo de Banco de Dados

Foi adotado um modelo relacional. Abaixo é apresentado o diagrama das principais entidades e cardinalidades.

![Diagrama Entidade-Relacionamento da TechPro](../assets/images/prd/diagrama-entidade-relacionamento.png)

## 11.1 Entidades principais

| Entidade | Responsabilidade |
| :---- | :---- |
| **Usuário (USER)** | Usuários internos e papel de acesso. |
| **Cliente (CLIENT)** | Cliente pessoa física ou jurídica. |
| **Orçamento (QUOTE)** | Negociação/orçamento feita para um cliente. |
| **Item de orçamento (QUOTE_ITEM)** | Itens de cada orçamento. |
| **Serviço (SERVICE)** | Planejamento macro do atendimento/serviço. |
| **Visita de serviço (SERVICE_VISIT)** | Idas/agendamentos vinculados ao serviço. |
| **Técnico da visita (VISIT_TECHNICIAN)** | Relação N:N entre visita e técnico. |
| **Garantia (WARRANTY)** | Garantias de serviço ou fabricante. |

---

# 12. Decisões de Implementação

## 12.1 Decisões Gerais

| Decisão | Diretriz |
| :---- | :---- |
| **Arquitetura** | Aplicação web com frontend e API separáveis, mantendo fronteiras claras entre interface, regras de negócio e persistência. |
| **Frontend** | React com TypeScript. Interface responsiva para desktop e dispositivos utilizados pelos técnicos. |
| **Backend** | Node.js com TypeScript e API REST. |
| **Persistência** | PostgreSQL como banco relacional. |
| **ORM** | Prisma para schema, migrations e acesso tipado ao banco. |
| **Validação** | Zod para validar payloads/DTOs nos limites da API. |
| **Autenticação** | Autenticação interna baseada em credenciais utilizando Better Auth para autenticação e gerenciamento de sessão dos usuários internos, com autorização das operações validada no backend. |
| **Segurança HTTP** | Helmet, CORS restritivo e rate limiting conforme o ambiente de produção. |
| **Execução local** | Docker Compose como forma oficial de subir dependências e ambiente de desenvolvimento. |
| **Arquivos** | Evidências devem ser armazenadas fora das tabelas binárias principais; o banco guarda metadados e referência do arquivo. |
| **Integração externa** | No MVP, não existe integração automática com software de OS/estoque; apenas referência manual. |

---

# 13. Fora de Escopo e Itens Opcionais

## 13.1 Opcional para o MVP

- Acompanhamento manual de licitações.
- Indicadores adicionais no painel operacional além do conjunto mínimo definido em RF21.

## 13.2 Fora do MVP

- Todas as pendências do [backlog pós-MVP da entrega final](entrega-final.md), incluindo agenda/execução técnica, interfaces operacionais, anexos na UI, backup e homologação.

- Automatizar pesquisa de preço.  
- Descobrir licitações automaticamente.  
- Sincronizar automaticamente OS, estoque ou produtos do software existente.  
- Substituir o sistema atual de estoque/OS.  
- Enviar mensagens automáticas por WhatsApp/e-mail.  
- Criar portal/login para clientes externos.
- Venda de produtos por técnicos, sem movimentação de estoque.

---

# 14. Glossário

| Termo | Definição |
| :---- | :---- |
| **Orçamento** | Proposta comercial feita para um cliente, com itens e valor total. Fica com status de enviado e pode ser editado até receber uma decisão (aprovado, rejeitado ou expirado). Depois disso não pode mais ser alterado.  |
| **Serviço** | Registro interno de planejamento e acompanhamento; pode nascer de orçamento aprovado ou diretamente. |
| **Visita** | Agendamento específico dentro de um serviço, com data/horário e técnicos atribuídos. |
| **OS externa** | Número/referência da ordem de serviço mantida no software que a TechPro já utiliza. |
| **Garantia de serviço** | Cobertura oferecida pela TechPro referente ao serviço executado. |
| **Garantia de fabricante** | Cobertura do fabricante referente a um equipamento/produto. |
| **Revisão** | Retorno futuro programado para acompanhamento/manutenção do serviço. |
| **Licitação** | Processo acompanhado manualmente no módulo opcional do MVP. |
| **MVP** | Menor versão do produto que resolve o núcleo do problema e pode ser validada com o cliente. |

**Fase do projeto:** Sprint 2 — Desenvolvimento Intensivo do Sistema.
**Última atualização:** 06/10/2026
