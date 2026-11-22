/**
 * Service options data layer — thin client for the services API.
 *
 * Returns active services with their associated client names, used as
 * options in warranty and revision forms.
 */

export type ServiceOption = {
  id: string;
  title: string;
  clientName: string;
};

const MOCK_SERVICES: ServiceOption[] = [
  { id: "svc-001", title: "Instalação CFTV Loja Centro", clientName: "Maria Souza" },
  { id: "svc-002", title: "Manutenção Alarme Galpão", clientName: "Tech Solutions LTDA" },
  { id: "svc-003", title: "Cerca Elétrica Residência", clientName: "João Silva" },
];

/** Lists active services for warranty/revision form selects. */
export async function listServiceOptions(): Promise<ServiceOption[]> {
  // MOCK: replace with fetch to GET /api/services (integration pending)
  return MOCK_SERVICES;
}
