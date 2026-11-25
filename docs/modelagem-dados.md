# Modelagem de dados — TechPro

**Entrega final: 25/11/2026.** Modelo lógico-relacional da implementação, derivado do [schema Prisma](../api/prisma/schema.prisma) e das [migrations versionadas](../api/prisma/migrations/README.md). O diagrama original de levantamento permanece no PRD como registro da concepção. Este DER representa as tabelas efetivamente modeladas, não a disponibilidade de todas as operações na interface.

## Diagrama entidade-relacionamento

```mermaid
erDiagram
    USER ||--o{ SESSION : autentica
    USER ||--o{ ACCOUNT : possui
    USER ||--o{ QUOTE : cria
    USER o|--o{ QUOTE : envia
    USER o|--o{ QUOTE : decide
    USER ||--o{ SERVICE : cria
    CLIENT ||--o{ QUOTE : solicita
    CLIENT ||--o{ SERVICE : recebe
    QUOTE o|--o| SERVICE : origina
    QUOTE ||--o{ QUOTE_ITEM : contem
    SERVICE ||--o{ SERVICE_VISIT : planeja
    SERVICE_VISIT ||--o{ VISIT_TECHNICIAN : atribui
    USER ||--o{ VISIT_TECHNICIAN : executa
    SERVICE ||--o{ WARRANTY : possui
    SERVICE ||--o{ REVISION : programa
    SERVICE_VISIT o|--o{ REVISION : referencia

    USER {
        string id PK
        string email UK
        string role
        boolean isActive
    }
    SESSION {
        string id PK
        string userId FK
        string token UK
        datetime expiresAt
    }
    ACCOUNT {
        string id PK
        string userId FK
        string providerId
        string password "hash"
    }
    VERIFICATION {
        string id PK
        string identifier
        string value
        datetime expiresAt
    }
    CLIENT {
        uuid id PK
        string type
        string name
        string document
        string whatsapp
        string location
        string email UK
        boolean active
    }
    QUOTE {
        uuid id PK
        uuid clientId FK
        string createdBy FK
        string sentBy FK "opcional"
        string decidedBy FK "opcional"
        string status
        decimal subtotal
        decimal discount
        decimal total
        string decisionEvidenceUrl "opcional"
    }
    QUOTE_ITEM {
        uuid id PK
        uuid quoteId FK
        string type
        decimal quantity
        decimal unitPrice
        decimal discount
        decimal subtotal
    }
    SERVICE {
        uuid id PK
        uuid clientId FK
        uuid quoteId FK,UK "opcional"
        string createdBy FK
        string origin
        string status
        string externalOsNumber
        datetime plannedStart
        datetime plannedEnd
        datetime completedAt
    }
    SERVICE_VISIT {
        uuid id PK
        uuid serviceId FK
        datetime scheduledStart
        datetime scheduledEnd
        datetime actualStart
        datetime actualEnd
        string status
        string notes
    }
    VISIT_TECHNICIAN {
        uuid visitId PK,FK
        string technicianId PK,FK
    }
    WARRANTY {
        uuid id PK
        uuid serviceId FK
        string type
        date startsAt
        date endsAt
        string manufacturer
        string productReference
    }
    REVISION {
        uuid id PK
        uuid serviceId FK
        uuid visitId FK "opcional"
        datetime scheduledAt
        string status
    }
```

O DER mostra campos selecionados, chaves e cardinalidades; o schema Prisma contém todos os campos, tipos, valores padrão, índices e mapeamentos físicos. `VERIFICATION` é uma tabela independente do Better Auth, sem chave estrangeira para usuário.

## Dicionário de entidades

| Modelo Prisma | Tabela PostgreSQL | Responsabilidade e estado |
| --- | --- | --- |
| User | user | Identidade, perfil ADMIN/PLANNING/TECHNICIAN e atividade; administração pela API/UI. |
| Account | account | Credenciais e contas do Better Auth; senha persistida como hash. |
| Session | session | Sessões com token único e expiração; revogação no fluxo de autenticação. |
| Verification | verification | Estrutura de verificação da biblioteca; recuperação de senha não entregue. |
| Client | client | Identificação PF/PJ, contatos e localização; CRUD e inativação pela API/UI. |
| Quote | quote | Orçamento, valores, status, autoria, datas de envio/decisão e referência de evidência; CRUD e decisão integrados. |
| QuoteItem | quote_item | Itens e valores decimais do orçamento. |
| Service | service | Atendimento direto ou derivado de orçamento aprovado; referência manual à OS; API integrada, UI futura. |
| ServiceVisit | service_visit | Agendamento, período previsto e observações; API integrada. Campos reais de execução existem, mas não são editáveis pela API atual. |
| VisitTechnician | visit_technician | Relação N:N entre visitas e técnicos; chave primária composta; atribuição por API. |
| Warranty | warranty | Garantia de serviço/fabricante, início e término; API e UI integradas. |
| Revision | revision | Revisão programada, situação e vínculo opcional com visita; API e UI integradas. |

## Integridade e decisões de modelagem

- Cada orçamento pertence a um cliente e pode originar no máximo um serviço (`Service.quoteId` opcional e único). Serviços diretos não precisam de orçamento. A API valida aprovação e vínculo com o cliente.
- Um serviço pode existir sem visitas; visitas, garantias e revisões pertencem a um serviço. Cada revisão pode referenciar opcionalmente uma visita do mesmo serviço, validado pela API.
- Uma visita admite zero ou mais técnicos; a associação usa chave composta e a API aceita somente técnicos ativos. A localização vem de `Client.location`, não de uma coluna própria da visita. A confirmação explícita de conflitos e os bloqueios transacionais estão no [contrato de visitas](visit-api.md).
- Orçamentos e itens usam `Decimal` para valores e quantidades; valores monetários não usam ponto flutuante para cálculo no servidor. O envio e a decisão registram autores opcionais para preservar compatibilidade com registros anteriores.
- Garantias utilizam datas sem horário (`@db.Date`); agendamentos e registros de negócio utilizam timestamps. Os alertas são calculados a partir das datas e estados, sem tabela de notificações.
- Evidências de orçamento são objetos privados no armazenamento S3/RustFS; o banco mantém `decisionEvidenceUrl`. Não existe uma tabela de arquivos ou integração com estoque/OS.
- A exclusão de orçamento em rascunho tem cascata sobre itens. A remoção de um serviço ou visita possui regras referenciais definidas no schema; não há endpoint de exclusão de serviço/visita na entrega. O vínculo opcional de revisão com visita usa `SetNull`.
- Status de orçamento, revisão e tipos são enums no banco; status de serviço e visita são strings validadas na camada de aplicação. Campos de início/fim real de visita e transições futuras estão modelados, mas a API atual cria visitas como SCHEDULED e não registra execução.

## Fluxo disponível e limites

```mermaid
flowchart LR
    C["Cliente — UI + API"] --> Q["Orçamento e itens — UI + API"]
    Q --> D["Envio e decisão — UI + API"]
    D -->|"Aprovado"| S["Serviço — API"]
    C -->|"Atendimento direto"| S
    S --> V["Agendamento e atribuição — API"]
    S --> G["Garantias — UI + API"]
    S --> R["Revisões — UI + API"]
    G --> A["Dashboard e alertas"]
    R --> A
    V --> A
    V -.-> F["Pós-MVP: agenda e execução técnica"]
    D -.-> E["Evidência — API privada"]
```

O fluxo descreve a integração dos módulos, não uma demonstração integral pelo navegador. A criação de serviço e o planejamento de visitas ainda exigem chamadas à API. Consulte a [matriz de entrega](entrega-final.md), o [PRD](documento-requisitos.md) e os contratos técnicos para os limites exatos.
