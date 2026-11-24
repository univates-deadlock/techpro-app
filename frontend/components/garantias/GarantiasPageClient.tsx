"use client";

import { useEffect, useState } from "react";

import { WarrantyFormModal } from "@/components/garantias/WarrantyFormModal";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { daysUntilDateOnly, formatDateOnly } from "@/lib/money";
import { listServiceOptions, type ServiceOption } from "@/lib/service-options";
import {
  EXPIRING_SOON_DAYS,
  WARRANTY_TYPE_META,
  listWarranties,
  type Warranty,
  type WarrantyType,
} from "@/lib/warranties";

type TypeFilter = WarrantyType | "ALL";
type ExpiryFilter = "ALL" | "EXPIRED" | "EXPIRING";

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "ALL", label: "Todos" },
  { value: "SERVICE", label: "Serviço" },
  { value: "MANUFACTURER", label: "Fabricante" },
];

const EXPIRY_FILTERS: { value: ExpiryFilter; label: string }[] = [
  { value: "ALL", label: "Todas" },
  { value: "EXPIRED", label: "Vencidas" },
  { value: "EXPIRING", label: "A vencer" },
];

/** Computes the warranty situation badge props. */
function warrantyBadge(endsAt: string): { tone: "danger" | "warning" | "success"; label: string } {
  const days = daysUntilDateOnly(endsAt);
  if (days === null || days < 0) return { tone: "danger", label: "Vencida" };
  if (days <= EXPIRING_SOON_DAYS) return { tone: "warning", label: "A vencer" };
  return { tone: "success", label: "Vigente" };
}

/**
 * Warranty list screen: list, search, filter, create and edit warranties.
 */
export function GarantiasPageClient() {
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingWarranty, setEditingWarranty] = useState<Warranty | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>("ALL");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      setIsLoading(true);
      setError("");
      try {
        const [warrantiesData, servicesData] = await Promise.all([
          listWarranties(),
          listServiceOptions().catch(() => [] as ServiceOption[]),
        ]);
        if (!active) return;
        setWarranties(warrantiesData);
        setServices(servicesData);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Erro ao conectar com o servidor.");
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
    setReloadKey((k) => k + 1);
  }

  function openCreateForm() {
    setFormMode("create");
    setEditingWarranty(null);
    setSuccessMessage("");
    setShowForm(true);
  }

  function openEditForm(warranty: Warranty) {
    setFormMode("edit");
    setEditingWarranty(warranty);
    setSuccessMessage("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingWarranty(null);
  }

  function handleSaved() {
    const wasEdit = formMode === "edit";
    closeForm();
    setSuccessMessage(wasEdit ? "Garantia atualizada." : "Garantia criada.");
    reload();
  }

  const term = searchTerm.trim().toLowerCase();
  const filtered = warranties.filter((w) => {
    if (typeFilter !== "ALL" && w.type !== typeFilter) return false;
    if (expiryFilter !== "ALL") {
      const days = daysUntilDateOnly(w.endsAt);
      if (expiryFilter === "EXPIRED" && (days === null || days >= 0)) return false;
      if (expiryFilter === "EXPIRING" && (days === null || days < 0 || days > EXPIRING_SOON_DAYS))
        return false;
    }
    if (!term) return true;
    return (
      w.clientName.toLowerCase().includes(term) ||
      w.serviceTitle.toLowerCase().includes(term)
    );
  });

  return (
    <div>
      <PageHeader
        title="Garantias"
        action={
          <Button variant="primary" onClick={openCreateForm}>
            Nova garantia
          </Button>
        }
      />

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

      <WarrantyFormModal
        open={showForm}
        mode={formMode}
        warranty={editingWarranty}
        services={services}
        onClose={closeForm}
        onSaved={handleSaved}
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="w-full max-w-xs">
          <label htmlFor="warranty-search" className="sr-only">
            Buscar
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tp-text-muted">
              <Icon name="search" size={16} />
            </span>
            <input
              id="warranty-search"
              type="search"
              placeholder="Buscar por cliente ou serviço..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-tp-sm border border-tp-border bg-white py-2 pl-9 pr-3 text-sm text-tp-text-main placeholder:text-tp-text-muted focus:outline-none focus:border-tp-primary"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <fieldset className="flex flex-wrap items-center gap-1.5">
            <legend className="sr-only">Filtrar por tipo</legend>
            {TYPE_FILTERS.map((filter) => {
              const active = typeFilter === filter.value;
              return (
                <button
                  key={filter.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTypeFilter(filter.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    active
                      ? "border-tp-border bg-tp-neutral-100 text-tp-text-main"
                      : "border-transparent bg-transparent text-tp-text-muted hover:bg-tp-neutral-50 hover:text-tp-text-body"
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </fieldset>

          <fieldset className="flex flex-wrap items-center gap-1.5">
            <legend className="sr-only">Filtrar por vencimento</legend>
            {EXPIRY_FILTERS.map((filter) => {
              const active = expiryFilter === filter.value;
              return (
                <button
                  key={filter.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setExpiryFilter(filter.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    active
                      ? "border-tp-border bg-tp-neutral-100 text-tp-text-main"
                      : "border-transparent bg-transparent text-tp-text-muted hover:bg-tp-neutral-50 hover:text-tp-text-body"
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </fieldset>
        </div>
      </div>

      {isLoading ? (
        <p className="text-tp-text-muted">Carregando garantias...</p>
      ) : error ? null : filtered.length === 0 ? (
        <div className="rounded-tp-md border border-dashed border-tp-border bg-white px-5 py-8 text-center text-sm text-tp-text-muted">
          {warranties.length === 0
            ? "Nenhuma garantia cadastrada ainda."
            : "Nenhuma garantia encontrada para a busca ou o filtro aplicado."}
        </div>
      ) : (
        <div className="tp-table-wrap">
          <table className="tp-table" aria-label="Garantias">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Serviço</th>
                <th>Tipo</th>
                <th>Vigência</th>
                <th>Situação</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((w) => {
                const badge = warrantyBadge(w.endsAt);
                return (
                  <tr key={w.id} className="hover:bg-tp-neutral-50">
                    <td className="text-tp-text-body">{w.clientName}</td>
                    <td className="text-tp-text-body">{w.serviceTitle}</td>
                    <td className="text-tp-text-body">{WARRANTY_TYPE_META[w.type].label}</td>
                    <td className="text-tp-text-body">
                      {formatDateOnly(w.startsAt)} – {formatDateOnly(w.endsAt)}
                    </td>
                    <td>
                      <Badge tone={badge.tone}>{badge.label}</Badge>
                    </td>
                    <td className="text-right">
                      <Button variant="ghost" onClick={() => openEditForm(w)}>
                        Editar
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
