/**
 * Service options data layer — thin client for the services API.
 *
 * Returns active services with their associated client names, used as
 * options in warranty and revision forms.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type ServiceOption = {
  id: string;
  title: string;
  clientName: string;
};

type RawService = {
  id: string;
  title: string;
  client?: { id: string; name: string };
};

/** Lists active services for warranty/revision form selects. */
export async function listServiceOptions(): Promise<ServiceOption[]> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/services`, {
      credentials: "include",
    });
  } catch {
    throw new Error("Não foi possível falar com o servidor.");
  }

  if (!res.ok) {
    throw new Error("Não foi possível carregar os serviços.");
  }

  const data = (await res.json()) as RawService[];
  return (Array.isArray(data) ? data : []).map((service) => ({
    id: service.id,
    title: service.title,
    clientName: service.client?.name ?? "Cliente não informado",
  }));
}
