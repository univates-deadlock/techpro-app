"use client";

import { useEffect, useState } from "react";

import { ServiceFormModal } from "@/components/servicos/ServiceFormModal";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { fromDateInput, toDateInput } from "@/lib/dates";
import { formatDateTime } from "@/lib/money";
import {
  SERVICE_STATUS_TRANSITIONS,
  listServices,
  updateServiceStatus,
  type ServiceListItem,
  type ServiceOriginValue,
  type ServiceStatusValue,
} from "@/lib/services-data";

/**
 * Serviços CRUD (cadastro, listagem e gerenciamento).
 *
 * Contract (branch feat/api-services, api/src/routes/service.route.ts):
 *   GET    /api/services            -> ServiceListItem[] (filters: clientId, status, origin, q, from, to)
 *   POST   /api/services            -> 201 ServiceDetail
 *   GET    /api/services/:id        -> ServiceDetail
 *   PATCH  /api/services/:id        -> ServiceDetail
 *   PATCH  /api/services/:id/status -> ServiceDetail
 *
 * Requires an active session and role ADMIN or PLANNING (enforced SSR by the
 * page and again by the API). While the endpoints are not integrated, the data
 * comes from lib/services-data.ts (fictitious data; see the module header).
 */

const ORIGIN_LABELS: Record<ServiceOriginValue, string> = {
  QUOTE: "Orçamento",
  SUPPORT: "Suporte",
  MAINTENANCE: "Manutenção",
  REVISION: "Revisão",
  WARRANTY: "Garantia",
  OTHER: "Outro",
};

const STATUS_LABELS: Record<ServiceStatusValue, string> = {
  PLANNED: "Planejado",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};

const STATUS_TONES: Record<
  ServiceStatusValue,
  "info" | "warning" | "success" | "danger"
> = {
  PLANNED: "info",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  CANCELLED: "danger",
};

/** Label for each allowed status transition button. */
const NEXT_STATUS_LABELS: Record<ServiceStatusValue, string> = {
  PLANNED: "Planejado",
  IN_PROGRESS: "Iniciar",
  COMPLETED: "Concluir",
  CANCELLED: "Cancelar",
};

const SELECT_CLASSES =
  "w-full rounded-tp-sm border border-tp-border bg-white px-3 py-2.5 text-base text-tp-text-main focus:outline-none focus:border-tp-primary";

export function ServicosPageClient() {
  const [services, setServices] = useState<ServiceListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | ServiceStatusValue>("");
  const [originFilter, setOriginFilter] = useState<"" | ServiceOriginValue>("");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ServiceListItem | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<{
    service: ServiceListItem;
    next: ServiceStatusValue;
  } | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  /* Load the list on mount and after every mutation. */
  useEffect(() => {
    let active = true;

    (async () => {
      setIsLoading(true);
      setError("");
      try {
        const data = await listServices();
        if (!active) return;
        setServices(data);
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Não foi possível carregar os serviços.",
          );
        }
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [reloadKey]);

  function reload() {
    setReloadKey((key) => key + 1);
  }

  function openCreateForm() {
    setEditing(null);
    setShowForm(true);
  }

  function openEditForm(service: ServiceListItem) {
    setEditing(service);
    setShowForm(true);
    setSuccessMessage("");
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
  }

  function handleSaved(message: string) {
    closeForm();
    setSuccessMessage(message);
    reload();
  }

  async function confirmStatusChange() {
    if (!confirmStatus || actionId !== null) return;
    const { service, next } = confirmStatus;
    setActionId(service.id);
    setError("");
    setSuccessMessage("");
    try {
      await updateServiceStatus(service.id, next);
      setConfirmStatus(null);
      setSuccessMessage(`Status alterado para "${STATUS_LABELS[next]}".`);
      reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível alterar o status.",
      );
    } finally {
      setActionId(null);
    }
  }

  const searchTerm = search.trim().toLowerCase();
  const fromMs = fromFilter ? new Date(fromDateInput(fromFilter)).getTime() : null;
  const toMs = toFilter ? new Date(toDateInput(toFilter)).getTime() : null;
  const hasFilters = Boolean(
    searchTerm || statusFilter || originFilter || fromFilter || toFilter,
  );

  /* Local filtering, mirroring the query params the API supports. */
  const filtered = services.filter((service) => {
    if (statusFilter && service.status !== statusFilter) return false;
    if (originFilter && service.origin !== originFilter) return false;
    if (fromMs !== null) {
      if (!service.plannedStart) return false;
      if (new Date(service.plannedStart).getTime() < fromMs) return false;
    }
    if (toMs !== null) {
      if (!service.plannedStart) return false;
      if (new Date(service.plannedStart).getTime() > toMs) return false;
    }
    if (searchTerm) {
      const haystack = `${service.title} ${service.externalOsNumber ?? ""} ${service.client.name}`.toLowerCase();
      if (!haystack.includes(searchTerm)) return false;
    }
    return true;
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="mb-1 text-sm font-medium uppercase tracking-[0.15em] text-tp-primary">
            Planejamento
          </p>
          <h1 className="text-2xl font-bold text-tp-text-main">Serviços</h1>
        </div>
        <Button variant="primary" onClick={openCreateForm}>
          Novo serviço
        </Button>
      </div>

      {error ? (
        <div className="mb-4">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      {successMessage ? (
        <div className="mb-4">
          <Alert tone="success">{successMessage}</Alert>
        </div>
      ) : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field
          id="service-search"
          label="Buscar"
          type="search"
          placeholder="Título, OS ou cliente…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="service-status-filter"
            className="text-sm font-semibold text-tp-text-main"
          >
            Status
          </label>
          <select
            id="service-status-filter"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "" | ServiceStatusValue)
            }
            className={SELECT_CLASSES}
          >
            <option value="">Todos</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="service-origin-filter"
            className="text-sm font-semibold text-tp-text-main"
          >
            Origem
          </label>
          <select
            id="service-origin-filter"
            value={originFilter}
            onChange={(e) =>
              setOriginFilter(e.target.value as "" | ServiceOriginValue)
            }
            className={SELECT_CLASSES}
          >
            <option value="">Todas</option>
            {Object.entries(ORIGIN_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <Field
          id="service-from"
          label="Planejado de"
          type="date"
          value={fromFilter}
          onChange={(e) => setFromFilter(e.target.value)}
        />
        <Field
          id="service-to"
          label="Até"
          type="date"
          value={toFilter}
          onChange={(e) => setToFilter(e.target.value)}
        />
      </div>

      {isLoading ? (
        <p className="text-tp-text-muted">Carregando serviços…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-tp-md border border-dashed border-tp-border bg-white px-5 py-8 text-center">
          <p className="text-sm text-tp-text-muted">
            {hasFilters
              ? "Nenhum serviço encontrado para os filtros."
              : "Nenhum serviço cadastrado."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-tp-md border border-tp-border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-tp-border-light bg-tp-neutral-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-tp-text-main">Serviço</th>
                <th className="px-4 py-3 font-semibold text-tp-text-main">Cliente</th>
                <th className="px-4 py-3 font-semibold text-tp-text-main">Origem</th>
                <th className="px-4 py-3 font-semibold text-tp-text-main">Status</th>
                <th className="px-4 py-3 font-semibold text-tp-text-main">
                  Período planejado
                </th>
                <th className="px-4 py-3 text-right font-semibold text-tp-text-main">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-tp-border-light">
              {filtered.map((service) => (
                <tr key={service.id} className="hover:bg-tp-neutral-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-tp-text-main">{service.title}</p>
                    {service.externalOsNumber ? (
                      <p className="text-xs text-tp-text-muted">
                        OS externa: {service.externalOsNumber}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-tp-text-body">{service.client.name}</p>
                    <p className="text-xs text-tp-text-muted">
                      {service.client.location}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-tp-text-body">
                    {ORIGIN_LABELS[service.origin] ?? service.origin}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONES[service.status]}>
                      {STATUS_LABELS[service.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-tp-text-body">
                    {service.plannedStart ? (
                      <>
                        <p>{formatDateTime(service.plannedStart)}</p>
                        {service.plannedEnd ? (
                          <p className="text-xs text-tp-text-muted">
                            até {formatDateTime(service.plannedEnd)}
                          </p>
                        ) : null}
                      </>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => openEditForm(service)}>
                        Editar
                      </Button>
                      {SERVICE_STATUS_TRANSITIONS[service.status].map((next) => (
                        <Button
                          key={next}
                          variant="ghost"
                          disabled={actionId === service.id}
                          onClick={() => setConfirmStatus({ service, next })}
                        >
                          {NEXT_STATUS_LABELS[next]}
                        </Button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mounted only while open: the modal state resets on every open. */}
      {showForm ? (
        <ServiceFormModal
          open={showForm}
          service={editing}
          onClose={closeForm}
          onSaved={handleSaved}
        />
      ) : null}

      <Modal
        open={confirmStatus !== null}
        title="Alterar status"
        onClose={() => setConfirmStatus(null)}
        dismissible={actionId === null}
      >
        {confirmStatus ? (
          <div>
            <p className="text-sm leading-relaxed text-tp-text-body">
              Alterar o status do serviço{" "}
              <strong className="text-tp-text-main">
                {confirmStatus.service.title}
              </strong>{" "}
              para{" "}
              <strong className="text-tp-text-main">
                {STATUS_LABELS[confirmStatus.next]}
              </strong>
              ?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setConfirmStatus(null)}
                disabled={actionId !== null}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={confirmStatusChange}
                disabled={actionId !== null}
              >
                Confirmar
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
