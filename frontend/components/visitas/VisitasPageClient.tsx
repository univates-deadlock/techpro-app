"use client";

import { useEffect, useMemo, useState } from "react";

import { VisitExecutionModal } from "@/components/visitas/VisitExecutionModal";
import { VisitFormModal } from "@/components/visitas/VisitFormModal";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import type { UserRole } from "@/lib/auth-server";
import {
  dayKey,
  formatDayLabel,
  formatTime,
  fromDateInput,
  toDateInput,
} from "@/lib/dates";
import {
  cancelVisit,
  listTechnicians,
  listVisits,
  recordVisitStart,
  VISIT_EXECUTION_API_ENABLED,
  type TechnicianOption,
  type Visit,
  type VisitStatusValue,
} from "@/lib/visits-data";

/**
 * Visitas screen, role-aware:
 *
 * - ADMIN/PLANNING: full agenda — schedule visits for open services, assign
 *   one or more technicians (RN-SRV-03), reschedule and cancel.
 * - TECHNICIAN: only the visits assigned to them (agenda do técnico) with the
 *   execution record: real start, real end and managerial notes (RF15/RF16).
 *
 * Data comes from lib/visits-data.ts (real API contract of PR #116). The SSR
 * session check happens in the page; the API must enforce the role rules
 * again on every endpoint.
 */

export type VisitasUser = { id: string; name: string; role: UserRole };

const VISIT_LABELS: Record<VisitStatusValue, string> = {
  SCHEDULED: "Agendada",
  IN_PROGRESS: "Em execução",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};

const VISIT_TONES: Record<
  VisitStatusValue,
  "info" | "warning" | "success" | "danger"
> = {
  SCHEDULED: "info",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  CANCELLED: "danger",
};

const SELECT_CLASSES =
  "w-full rounded-tp-sm border border-tp-border bg-white px-3 py-2.5 text-base text-tp-text-main focus:outline-none focus:border-tp-primary";

export function VisitasPageClient({
  user,
  initialServiceId,
}: {
  user: VisitasUser;
  /** Service preselected via /visitas?serviceId=… (link from the services screen). */
  initialServiceId?: string;
}) {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  /* /api/technicians is remaining backend work (#72): PLANNING cannot list
     technicians until it exists, so the filter shows a notice instead of an
     empty list pretending to be complete. */
  const [techniciansLoadFailed, setTechniciansLoadFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [serviceFilter, setServiceFilter] = useState(initialServiceId ?? "");
  const [technicianFilter, setTechnicianFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | VisitStatusValue>("");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Visit | null>(null);
  const [executionVisit, setExecutionVisit] = useState<Visit | null>(null);
  const [startConfirm, setStartConfirm] = useState<Visit | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<Visit | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const isPlanner = user.role === "ADMIN" || user.role === "PLANNING";

  /* Load the agenda: technicians see only their own visits (server scope). */
  useEffect(() => {
    let active = true;

    (async () => {
      setIsLoading(true);
      setError("");
      try {
        const data = await listVisits({
          technicianId: user.role === "TECHNICIAN" ? user.id : undefined,
        });
        if (!active) return;
        setVisits(data);
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Não foi possível carregar as visitas.",
          );
        }
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [reloadKey, user]);

  /* Planners need the technicians list for the filter and the assignment. */
  useEffect(() => {
    if (!isPlanner) return;
    let active = true;
    (async () => {
      try {
        const data = await listTechnicians();
        if (active) setTechnicians(data);
      } catch {
        /* Filter select stays empty; assignment errors surface in the modal. */
        if (active) setTechniciansLoadFailed(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [isPlanner]);

  function reload() {
    setReloadKey((key) => key + 1);
  }

  function openCreateForm() {
    setEditing(null);
    setShowForm(true);
    setSuccessMessage("");
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
  }

  function handleSaved(message: string) {
    closeForm();
    setExecutionVisit(null);
    setSuccessMessage(message);
    reload();
  }

  async function runAction(
    id: string,
    action: () => Promise<unknown>,
    success: string,
  ) {
    setActionId(id);
    setError("");
    setSuccessMessage("");
    try {
      await action();
      setSuccessMessage(success);
      reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível concluir a ação.",
      );
    } finally {
      setActionId(null);
      setStartConfirm(null);
      setCancelConfirm(null);
    }
  }

  const hasFilters = Boolean(
    serviceFilter || technicianFilter || statusFilter || fromFilter || toFilter,
  );

  /* Local filtering; the API supports the same params (see lib/visits-data.ts). */
  const filtered = useMemo(() => {
    const fromMs = fromFilter ? new Date(fromDateInput(fromFilter)).getTime() : null;
    const toMs = toFilter ? new Date(toDateInput(toFilter)).getTime() : null;
    return visits.filter((visit) => {
      if (serviceFilter && visit.serviceId !== serviceFilter) return false;
      if (statusFilter && visit.status !== statusFilter) return false;
      if (isPlanner && technicianFilter) {
        if (
          !visit.technicians.some(
            (link) => link.technician.id === technicianFilter,
          )
        ) {
          return false;
        }
      }
      const start = new Date(visit.scheduledStart).getTime();
      if (fromMs !== null && start < fromMs) return false;
      if (toMs !== null && start > toMs) return false;
      return true;
    });
  }, [visits, serviceFilter, statusFilter, technicianFilter, fromFilter, toFilter, isPlanner]);

  /* Agenda grouped by day (visits are sorted by scheduledStart already). */
  const groups = useMemo(() => {
    const byDay = new Map<string, Visit[]>();
    for (const visit of filtered) {
      const key = dayKey(visit.scheduledStart);
      const list = byDay.get(key);
      if (list) list.push(visit);
      else byDay.set(key, [visit]);
    }
    return Array.from(byDay.entries());
  }, [filtered]);

  const serviceFilterTitle =
    visits.find((visit) => visit.serviceId === serviceFilter)?.service.title ??
    "serviço selecionado";

  function renderVisit(visit: Visit) {
    const isBusy = actionId === visit.id;
    const isOpen = visit.status === "SCHEDULED" || visit.status === "IN_PROGRESS";
    return (
      <article key={visit.id} className="rounded-tp-md border border-tp-border bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-tp-text-main">
              {visit.service.title}
            </p>
            <p className="text-xs text-tp-text-muted">
              {visit.service.client.name} — {visit.service.client.location}
            </p>
          </div>
          <Badge tone={VISIT_TONES[visit.status]}>{VISIT_LABELS[visit.status]}</Badge>
        </div>

        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <div className="flex gap-1">
            <dt className="text-tp-text-muted">Previsto:</dt>
            <dd className="text-tp-text-body">
              {formatTime(visit.scheduledStart)}
              {visit.scheduledEnd ? ` – ${formatTime(visit.scheduledEnd)}` : ""}
            </dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-tp-text-muted">Técnicos:</dt>
            <dd className="text-tp-text-body">
              {visit.technicians.length > 0
                ? visit.technicians
                    .map((link) => link.technician.name)
                    .join(", ")
                : "—"}
            </dd>
          </div>
          {visit.actualStart ? (
            <div className="flex gap-1">
              <dt className="text-tp-text-muted">Início real:</dt>
              <dd className="text-tp-text-body">{formatTime(visit.actualStart)}</dd>
            </div>
          ) : null}
          {visit.actualEnd ? (
            <div className="flex gap-1">
              <dt className="text-tp-text-muted">Fim real:</dt>
              <dd className="text-tp-text-body">{formatTime(visit.actualEnd)}</dd>
            </div>
          ) : null}
        </dl>

        {visit.description ? (
          <p className="mt-2 text-sm text-tp-text-body">{visit.description}</p>
        ) : null}
        {visit.notes ? (
          <p className="mt-1 text-sm text-tp-text-muted">Obs.: {visit.notes}</p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          {user.role === "TECHNICIAN" ? (
            /* Execution endpoints are remaining backend work (#72) and must
               not be presented as available in the browser
               (docs/entrega-final.md). */
            VISIT_EXECUTION_API_ENABLED ? (
              <>
                {visit.status === "SCHEDULED" ? (
                  <Button
                    variant="ghost"
                    disabled={isBusy}
                    onClick={() => setStartConfirm(visit)}
                  >
                    Iniciar execução
                  </Button>
                ) : null}
                {visit.status === "IN_PROGRESS" ? (
                  <Button
                    variant="ghost"
                    disabled={isBusy}
                    onClick={() => setExecutionVisit(visit)}
                  >
                    Registrar conclusão
                  </Button>
                ) : null}
              </>
            ) : null
          ) : (
            isOpen && (
              <>
                <Button
                  variant="ghost"
                  disabled={isBusy}
                  onClick={() => {
                    setEditing(visit);
                    setShowForm(true);
                    setSuccessMessage("");
                  }}
                >
                  Editar
                </Button>
                {/* Cancellation is also an execution endpoint (status
                    transition) and stays hidden until the API serves it. */}
                {VISIT_EXECUTION_API_ENABLED ? (
                  <Button
                    variant="ghost"
                    disabled={isBusy}
                    onClick={() => setCancelConfirm(visit)}
                  >
                    Cancelar
                  </Button>
                ) : null}
              </>
            )
          )}
        </div>
      </article>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="mb-1 text-sm font-medium uppercase tracking-[0.15em] text-tp-primary">
            {isPlanner ? "Planejamento" : "Operação"}
          </p>
          <h1 className="text-2xl font-bold text-tp-text-main">
            {isPlanner ? "Visitas" : "Minha agenda"}
          </h1>
        </div>
        {isPlanner ? (
          <Button variant="primary" onClick={openCreateForm}>
            Agendar visita
          </Button>
        ) : null}
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

      {serviceFilter ? (
        <div className="mb-4 flex items-center gap-2">
          <p className="text-sm text-tp-text-body">
            Filtrado por serviço:{" "}
            <strong className="text-tp-text-main">{serviceFilterTitle}</strong>
          </p>
          <Button variant="ghost" onClick={() => setServiceFilter("")}>
            Limpar
          </Button>
        </div>
      ) : null}

      <div
        className={`mb-6 grid gap-3 sm:grid-cols-2 ${isPlanner ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
      >
        {isPlanner ? (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="visit-technician-filter"
              className="text-sm font-semibold text-tp-text-main"
            >
              Técnico
            </label>
            <select
              id="visit-technician-filter"
              value={technicianFilter}
              onChange={(e) => setTechnicianFilter(e.target.value)}
              className={SELECT_CLASSES}
            >
              <option value="">Todos</option>
              {technicians.map((technician) => (
                <option key={technician.id} value={technician.id}>
                  {technician.name}
                </option>
              ))}
            </select>
            {techniciansLoadFailed ? (
              <p className="text-sm text-tp-text-muted">
                A lista de técnicos não está disponível para o seu perfil.
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="visit-status-filter"
            className="text-sm font-semibold text-tp-text-main"
          >
            Status
          </label>
          <select
            id="visit-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | VisitStatusValue)}
            className={SELECT_CLASSES}
          >
            <option value="">Todos</option>
            {Object.entries(VISIT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <Field
          id="visit-from"
          label="De"
          type="date"
          value={fromFilter}
          onChange={(e) => setFromFilter(e.target.value)}
        />
        <Field
          id="visit-to"
          label="Até"
          type="date"
          value={toFilter}
          onChange={(e) => setToFilter(e.target.value)}
        />
      </div>

      {isLoading ? (
        <p className="text-tp-text-muted">Carregando visitas…</p>
      ) : groups.length === 0 ? (
        <div className="rounded-tp-md border border-dashed border-tp-border bg-white px-5 py-8 text-center">
          <p className="text-sm text-tp-text-muted">
            {hasFilters
              ? "Nenhuma visita encontrada para os filtros."
              : user.role === "TECHNICIAN"
                ? "Você não tem visitas atribuídas."
                : "Nenhuma visita agendada."}
          </p>
        </div>
      ) : (
        groups.map(([key, dayVisits]) => (
          <section key={key} className="mb-6 last:mb-0">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-tp-text-muted">
              {formatDayLabel(dayVisits[0].scheduledStart)}
            </h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {dayVisits.map((visit) => renderVisit(visit))}
            </div>
          </section>
        ))
      )}

      {/* Mounted only while open: the modal state resets on every open. */}
      {showForm ? (
        <VisitFormModal
          open={showForm}
          visit={editing}
          defaultServiceId={serviceFilter || undefined}
          onClose={closeForm}
          onSaved={handleSaved}
        />
      ) : null}

      {executionVisit ? (
        <VisitExecutionModal
          open={executionVisit !== null}
          visit={executionVisit}
          onClose={() => setExecutionVisit(null)}
          onSaved={handleSaved}
        />
      ) : null}

      <Modal
        open={startConfirm !== null}
        title="Iniciar execução"
        onClose={() => setStartConfirm(null)}
        dismissible={actionId === null}
      >
        {startConfirm ? (
          <div>
            <p className="text-sm leading-relaxed text-tp-text-body">
              Registrar o início real da visita de{" "}
              <strong className="text-tp-text-main">
                {startConfirm.service.title}
              </strong>{" "}
              para{" "}
              <strong className="text-tp-text-main">
                {startConfirm.service.client.name}
              </strong>{" "}
              agora?
            </p>
            <p className="mt-1 text-sm text-tp-text-muted">
              O horário atual será salvo como início real (RF16).
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setStartConfirm(null)}
                disabled={actionId !== null}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                disabled={actionId !== null}
                onClick={() =>
                  runAction(
                    startConfirm.id,
                    () => recordVisitStart(startConfirm.id),
                    "Início real registrado.",
                  )
                }
              >
                Confirmar início
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={cancelConfirm !== null}
        title="Cancelar visita"
        onClose={() => setCancelConfirm(null)}
        dismissible={actionId === null}
      >
        {cancelConfirm ? (
          <div>
            <p className="text-sm leading-relaxed text-tp-text-body">
              Cancelar a visita de{" "}
              <strong className="text-tp-text-main">
                {cancelConfirm.service.title}
              </strong>{" "}
              para{" "}
              <strong className="text-tp-text-main">
                {cancelConfirm.service.client.name}
              </strong>
              ?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setCancelConfirm(null)}
                disabled={actionId !== null}
              >
                Voltar
              </Button>
              <Button
                variant="primary"
                disabled={actionId !== null}
                onClick={() =>
                  runAction(
                    cancelConfirm.id,
                    () => cancelVisit(cancelConfirm.id),
                    "Visita cancelada.",
                  )
                }
              >
                Confirmar cancelamento
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
