"use client";

import { useEffect, useState } from "react";

import { RevisionFormModal } from "@/components/revisoes/RevisionFormModal";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { daysUntilDateOnly, formatDateOnly } from "@/lib/money";
import {
  REVISION_STATUS_META,
  changeRevisionStatus,
  listRevisions,
  type Revision,
  type RevisionStatus,
} from "@/lib/revisions";
import { listServiceOptions, type ServiceOption } from "@/lib/service-options";

type StatusFilter = RevisionStatus | "ALL" | "OVERDUE";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "Todos" },
  { value: "PENDING", label: "Pendente" },
  { value: "SCHEDULED", label: "Agendada" },
  { value: "COMPLETED", label: "Realizada" },
  { value: "CANCELLED", label: "Cancelada" },
  { value: "OVERDUE", label: "Atrasadas" },
];

/** Whether a revision is overdue (past date with actionable status). */
function isOverdue(r: Revision): boolean {
  if (r.status !== "PENDING" && r.status !== "SCHEDULED") return false;
  const days = daysUntilDateOnly(r.scheduledAt);
  return days !== null && days < 0;
}

type PendingChange = {
  revision: Revision;
  targetStatus: RevisionStatus;
  title: string;
  message: string;
  confirmLabel: string;
};

function buildPendingChange(revision: Revision, targetStatus: RevisionStatus): PendingChange {
  const map: Record<string, { title: string; message: string; confirmLabel: string }> = {
    SCHEDULED: {
      title: "Marcar como agendada",
      message: `Confirmar que a revisão do serviço "${revision.serviceTitle}" foi agendada?`,
      confirmLabel: "Confirmar agendamento",
    },
    COMPLETED: {
      title: "Marcar como realizada",
      message: `Confirmar que a revisão do serviço "${revision.serviceTitle}" foi realizada?`,
      confirmLabel: "Confirmar realização",
    },
    CANCELLED: {
      title: "Cancelar revisão",
      message: `Confirmar o cancelamento da revisão do serviço "${revision.serviceTitle}"? Essa ação não pode ser desfeita.`,
      confirmLabel: "Confirmar cancelamento",
    },
  };
  const copy = map[targetStatus] ?? {
    title: "Alterar status",
    message: "Confirmar a alteração?",
    confirmLabel: "Confirmar",
  };
  return { revision, targetStatus, ...copy };
}

/**
 * Revision list screen: list, search, filter, create, edit and change status.
 */
export function RevisoesPageClient() {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingRevision, setEditingRevision] = useState<Revision | null>(null);

  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [changeError, setChangeError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      setIsLoading(true);
      setError("");
      try {
        const [revisionsData, servicesData] = await Promise.all([
          listRevisions(),
          listServiceOptions().catch(() => [] as ServiceOption[]),
        ]);
        if (!active) return;
        setRevisions(revisionsData);
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
    setEditingRevision(null);
    setSuccessMessage("");
    setShowForm(true);
  }

  function openEditForm(revision: Revision) {
    setFormMode("edit");
    setEditingRevision(revision);
    setSuccessMessage("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingRevision(null);
  }

  function handleSaved() {
    const wasEdit = formMode === "edit";
    closeForm();
    setSuccessMessage(wasEdit ? "Revisão atualizada." : "Revisão criada.");
    reload();
  }

  async function handleConfirmChange() {
    if (isChangingStatus || !pendingChange) return;
    setChangeError("");
    setIsChangingStatus(true);
    try {
      await changeRevisionStatus(pendingChange.revision.id, pendingChange.targetStatus);
      setPendingChange(null);
      setSuccessMessage("Status atualizado.");
      reload();
    } catch (err) {
      setChangeError(
        err instanceof Error ? err.message : "Não foi possível alterar o status.",
      );
    } finally {
      setIsChangingStatus(false);
    }
  }

  const term = searchTerm.trim().toLowerCase();
  const filtered = revisions.filter((r) => {
    if (statusFilter === "OVERDUE") {
      if (!isOverdue(r)) return false;
    } else if (statusFilter !== "ALL" && r.status !== statusFilter) {
      return false;
    }
    if (!term) return true;
    return (
      r.clientName.toLowerCase().includes(term) ||
      r.serviceTitle.toLowerCase().includes(term)
    );
  });

  const canEdit = (r: Revision) => r.status === "PENDING" || r.status === "SCHEDULED";

  return (
    <div>
      <PageHeader
        title="Revisões"
        action={
          <Button variant="primary" onClick={openCreateForm}>
            Nova revisão
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

      <RevisionFormModal
        open={showForm}
        mode={formMode}
        revision={editingRevision}
        services={services}
        onClose={closeForm}
        onSaved={handleSaved}
      />

      {/* Status change confirmation modal */}
      <Modal
        open={pendingChange !== null}
        title={pendingChange?.title ?? ""}
        onClose={() => (isChangingStatus ? null : setPendingChange(null))}
        dismissible={!isChangingStatus}
      >
        {pendingChange ? (
          <div className="flex flex-col gap-4">
            {changeError ? <Alert tone="error">{changeError}</Alert> : null}
            <p className="text-sm text-tp-text-body">{pendingChange.message}</p>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                disabled={isChangingStatus}
                onClick={() => setPendingChange(null)}
              >
                Voltar
              </Button>
              <Button
                type="button"
                variant="primary"
                isLoading={isChangingStatus}
                loadingLabel="Salvando…"
                onClick={handleConfirmChange}
              >
                {pendingChange.confirmLabel}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="w-full max-w-xs">
          <label htmlFor="revision-search" className="sr-only">
            Buscar
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tp-text-muted">
              <Icon name="search" size={16} />
            </span>
            <input
              id="revision-search"
              type="search"
              placeholder="Buscar por cliente ou serviço..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-tp-sm border border-tp-border bg-white py-2 pl-9 pr-3 text-sm text-tp-text-main placeholder:text-tp-text-muted focus:outline-none focus:border-tp-primary"
            />
          </div>
        </div>

        <fieldset className="flex flex-wrap items-center gap-1.5">
          <legend className="sr-only">Filtrar por status</legend>
          {STATUS_FILTERS.map((filter) => {
            const active = statusFilter === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                aria-pressed={active}
                onClick={() => setStatusFilter(filter.value)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${active
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

      {isLoading ? (
        <p className="text-tp-text-muted">Carregando revisões...</p>
      ) : error ? null : filtered.length === 0 ? (
        <div className="rounded-tp-md border border-dashed border-tp-border bg-white px-5 py-8 text-center text-sm text-tp-text-muted">
          {revisions.length === 0
            ? "Nenhuma revisão cadastrada ainda."
            : "Nenhuma revisão encontrada para a busca ou o filtro aplicado."}
        </div>
      ) : (
        <div className="tp-table-wrap">
          <table className="tp-table" aria-label="Revisões">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Serviço</th>
                <th>Data prevista</th>
                <th>Status</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const meta = REVISION_STATUS_META[r.status];
                const overdue = isOverdue(r);
                return (
                  <tr key={r.id} className="hover:bg-tp-neutral-50">
                    <td className="text-tp-text-body">{r.clientName}</td>
                    <td className="text-tp-text-body">{r.serviceTitle}</td>
                    <td className="text-tp-text-body">{formatDateOnly(r.scheduledAt)}</td>
                    <td>
                      <span className="inline-flex items-center gap-2">
                        <Badge tone={meta.badgeTone}>{meta.label}</Badge>
                        {overdue ? <Badge tone="danger">Atrasada</Badge> : null}
                      </span>
                    </td>
                    <td className="text-right">
                      {canEdit(r) ? (
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button variant="ghost" onClick={() => openEditForm(r)}>
                            Editar
                          </Button>
                          {r.status === "PENDING" ? (
                            <Button
                              variant="ghost"
                              onClick={() =>
                                setPendingChange(buildPendingChange(r, "SCHEDULED"))
                              }
                            >
                              Marcar como agendada
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            onClick={() =>
                              setPendingChange(buildPendingChange(r, "COMPLETED"))
                            }
                          >
                            Marcar como realizada
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() =>
                              setPendingChange(buildPendingChange(r, "CANCELLED"))
                            }
                          >
                            Cancelar Revisão
                          </Button>
                        </div>
                      ) : null}
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
