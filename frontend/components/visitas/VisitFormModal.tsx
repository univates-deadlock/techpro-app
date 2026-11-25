"use client";

import { useEffect, useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import {
  formatDayLabel,
  formatTime,
  fromDatetimeLocal,
  optionalDatetimeLocal,
  toDatetimeLocal,
} from "@/lib/dates";
import { visitSchema } from "@/lib/schemas";
import {
  createVisit,
  listSchedulableServices,
  listTechnicians,
  updateVisit,
  VisitConflictError,
  type SchedulableServiceOption,
  type TechnicianOption,
  type Visit,
  type VisitConflict,
} from "@/lib/visits-data";

/**
 * Schedule/edit visit form (ADMIN and PLANNING).
 *
 * The service is chosen among the open ones (PLANNED/IN_PROGRESS); a visit can
 * carry zero or more technicians (RN-SRV-03: a visit can have several
 * technicians and a technician can take part in several visits — the API also
 * accepts visits without technicians, assigning them later).
 *
 * Save flow against the API contract (PR #116, merged to main):
 * - create: POST /api/services/:id/visits (horário + técnicos in one request);
 * - edit: PATCH /api/visits/:id updates changed schedule, text and assignments atomically.
 *
 * When the API answers 409 with a conflict list nothing is saved; the form
 * shows the conflicts and repeats the SAME request with confirmConflicts
 * after an explicit confirmation.
 */

const SELECT_CLASSES =
  "w-full rounded-tp-sm border border-tp-border bg-white px-3 py-2.5 text-base text-tp-text-main focus:outline-none focus:border-tp-primary disabled:bg-tp-neutral-100";

const TEXTAREA_CLASSES =
  "w-full rounded-tp-sm border border-tp-border bg-white px-3 py-2.5 text-base text-tp-text-main focus:outline-none focus:border-tp-primary disabled:bg-tp-neutral-100";

type VisitFormState = {
  serviceId: string;
  scheduledStart: string;
  scheduledEnd: string;
  description: string;
  technicianIds: string[];
};

const EMPTY_FORM: VisitFormState = {
  serviceId: "",
  scheduledStart: "",
  scheduledEnd: "",
  description: "",
  technicianIds: [],
};

/** "2026-12-01T12:00:00.000Z" -> "Hoje, 09:00 – 12:00" for the conflict list. */
function formatConflictWindow(conflict: VisitConflict): string {
  const day = formatDayLabel(conflict.visit.scheduledStart);
  const start = formatTime(conflict.visit.scheduledStart);
  const end = conflict.visit.scheduledEnd
    ? ` – ${formatTime(conflict.visit.scheduledEnd)}`
    : " (fim não definido)";
  return `${day}, ${start}${end}`;
}

export function VisitFormModal({
  open,
  visit,
  defaultServiceId,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** null = schedule; otherwise the visit being rescheduled/reassigned. */
  visit: Visit | null;
  /** Preselected service (e.g. arriving from /visitas?serviceId=…). */
  defaultServiceId?: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [minimumStart] = useState(() => toDatetimeLocal(new Date(Math.ceil(Date.now() / 60000) * 60000).toISOString()));
  const [services, setServices] = useState<SchedulableServiceOption[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [techniciansUnavailable, setTechniciansUnavailable] = useState(false);
  const [isLoadingAux, setIsLoadingAux] = useState(true);
  /* The parent mounts this component only while the modal is open, so the
     initializer below resets the form on every open without an effect. */
  const [form, setForm] = useState<VisitFormState>(() =>
    visit
      ? {
          serviceId: visit.serviceId,
          scheduledStart: toDatetimeLocal(visit.scheduledStart),
          scheduledEnd: toDatetimeLocal(visit.scheduledEnd),
          description: visit.description ?? "",
          technicianIds: visit.technicians.map(
            (link) => link.technician.id,
          ),
        }
      : { ...EMPTY_FORM, serviceId: defaultServiceId ?? "" },
  );
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [conflicts, setConflicts] = useState<VisitConflict[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* Load open services and the technicians available for assignment. The two
     loads are independent: a missing technicians route must not break the
     whole form. */
  useEffect(() => {
    let active = true;
    (async () => {
      const [servicesResult, techniciansResult] = await Promise.allSettled([
        listSchedulableServices(),
        listTechnicians(),
      ]);
      if (!active) return;
      if (servicesResult.status === "fulfilled") {
        setServices(servicesResult.value);
        if (!visit && defaultServiceId) {
          const selected = servicesResult.value.find((item) => item.id === defaultServiceId);
          if (selected) setForm((current) => current.serviceId === defaultServiceId && !current.scheduledStart ? {
            ...current,
            scheduledStart: selected.plannedStart && new Date(selected.plannedStart).getTime() >= Date.now() ? toDatetimeLocal(selected.plannedStart) : "",
            scheduledEnd: selected.plannedStart && new Date(selected.plannedStart).getTime() >= Date.now() ? toDatetimeLocal(selected.plannedEnd) : "",
          } : current);
        }
      } else {
        setFormError(
          servicesResult.reason instanceof Error
            ? servicesResult.reason.message
            : "Não foi possível carregar os dados do formulário.",
        );
      }
      if (techniciansResult.status === "fulfilled") {
        setTechnicians(techniciansResult.value);
      } else {
        setTechniciansUnavailable(true);
      }
      setIsLoadingAux(false);
    })();
    return () => {
      active = false;
    };
  }, [defaultServiceId, visit]);

  function updateField<K extends keyof VisitFormState>(
    key: K,
    value: VisitFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    if (fieldErrors[key]) {
      setFieldErrors((errors) => {
        const next = { ...errors };
        delete next[key];
        return next;
      });
    }
  }

  function toggleTechnician(id: string) {
    setForm((current) => ({
      ...current,
      technicianIds: current.technicianIds.includes(id)
        ? current.technicianIds.filter((item) => item !== id)
        : [...current.technicianIds, id],
    }));
    if (fieldErrors.technicianIds) {
      setFieldErrors((errors) => {
        const next = { ...errors };
        delete next.technicianIds;
        return next;
      });
    }
  }

  async function handleSubmit(event: React.FormEvent, confirmed = false) {
    event.preventDefault();
    if (isSubmitting) return;
    setFormError("");
    setConflicts(null);

    const result = visitSchema.safeParse(form);
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && !errors[field]) errors[field] = issue.message;
      }
      setFieldErrors(errors);
      setFormError("Verifique os campos destacados.");
      return;
    }

    const startChanged = !visit || form.scheduledStart !== toDatetimeLocal(visit.scheduledStart) || form.scheduledEnd !== toDatetimeLocal(visit.scheduledEnd);
    if (startChanged && new Date(form.scheduledStart).getTime() < Date.now()) {
      setFieldErrors({ scheduledStart: "Não é possível agendar uma visita no passado." });
      return;
    }
    setFieldErrors({});
    setIsSubmitting(true);

    const basePayload = {
      scheduledStart: fromDatetimeLocal(form.scheduledStart),
      scheduledEnd: optionalDatetimeLocal(form.scheduledEnd),
      description: form.description.trim() ? form.description.trim() : null,
    };

    try {
      if (visit) {
        const current = visit;
        /* PATCH only the time/text fields that actually changed (the API
           schema is a strictObject and rejects unknown fields). */
        const patch: Record<string, unknown> = {};
        if (
          form.scheduledStart !== toDatetimeLocal(current.scheduledStart)
        ) {
          patch.scheduledStart = basePayload.scheduledStart;
        }
        if (
          form.scheduledEnd !== toDatetimeLocal(current.scheduledEnd)
        ) {
          patch.scheduledEnd = basePayload.scheduledEnd;
        }
        if (basePayload.description !== (current.description ?? null)) {
          patch.description = basePayload.description;
        }

        if (!techniciansUnavailable && [...form.technicianIds].sort().join(",") !== current.technicians.map((link) => link.technician.id).sort().join(",")) {
          patch.technicianIds = form.technicianIds;
        }
        if (Object.keys(patch).length === 0) {
          onSaved("Nenhuma alteração para salvar.");
          return;
        }

        await updateVisit(current.id, {
          ...patch,
          ...(confirmed ? { confirmConflicts: true } : {}),
        });
        onSaved("Visita atualizada.");
      } else {
        await createVisit({
          ...basePayload,
          serviceId: form.serviceId,
          technicianIds: form.technicianIds,
          ...(confirmed ? { confirmConflicts: true } : {}),
        });
        onSaved("Visita agendada.");
      }
    } catch (err) {
      if (err instanceof VisitConflictError) {
        /* Nothing was saved: show the conflicts and wait for the explicit
           confirmation, which repeats the same request with confirmConflicts. */
        setConflicts(err.conflicts);
      } else {
        setFormError(
          err instanceof Error ? err.message : "Não foi possível salvar a visita.",
        );
      }
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(false);
  }

  return (
    <Modal
      open={open}
      title={visit ? "Editar visita" : "Agendar visita"}
      onClose={onClose}
      dismissible={!isSubmitting}
    >
      <form onSubmit={handleSubmit} noValidate>
        {formError ? (
          <div className="mb-4">
            <Alert tone="error">{formError}</Alert>
          </div>
        ) : null}

        {conflicts ? (
          <div className="mb-4" data-testid="visit-conflicts">
            <Alert tone="warning">
              <p className="font-semibold">
                Conflito de horário: nada foi salvo.
              </p>
              <ul className="mt-1.5 list-disc pl-4">
                {conflicts.map((conflict) => (
                  <li key={`${conflict.technician.id}-${conflict.visit.id}`}>
                    <strong>{conflict.technician.name}</strong> já tem visita em{" "}
                    {formatConflictWindow(conflict)} ({conflict.visit.serviceTitle}).
                  </li>
                ))}
              </ul>
              <div className="mt-3">
                <Button
                  type="button"
                  variant="primary"
                  disabled={isSubmitting}
                  onClick={(e) => {
                    void handleSubmit(e, true);
                  }}
                >
                  {visit ? "Salvar mesmo assim" : "Agendar mesmo assim"}
                </Button>
              </div>
            </Alert>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          {visit ? (
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-sm font-semibold text-tp-text-main">Serviço</span>
              <p className="rounded-tp-sm border border-tp-border bg-tp-neutral-50 px-3 py-2.5 text-base text-tp-text-body">
                {visit.service.title} — {visit.service.client.name}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label
                htmlFor="visit-service"
                className="text-sm font-semibold text-tp-text-main"
              >
                Serviço *
              </label>
              <select
                id="visit-service"
                value={form.serviceId}
                disabled={isSubmitting || isLoadingAux}
                onChange={(e) => {
                  const id = e.target.value;
                  const selected = services.find((item) => item.id === id);
                  const future = selected?.plannedStart && new Date(selected.plannedStart).getTime() >= Date.now();
                  setForm((current) => ({ ...current, serviceId: id,
                    scheduledStart: future ? toDatetimeLocal(selected?.plannedStart) : "",
                    scheduledEnd: future ? toDatetimeLocal(selected?.plannedEnd) : "",
                  }));
                  setFieldErrors({});
                }}
                className={SELECT_CLASSES}
              >
                <option value="">Selecione um serviço aberto…</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.title} — {service.clientName}
                  </option>
                ))}
              </select>
              {fieldErrors.serviceId ? (
                <p className="text-sm text-tp-danger">{fieldErrors.serviceId}</p>
              ) : (
                <p className="text-sm text-tp-text-muted">
                  Somente serviços abertos (planejados ou em andamento) recebem
                  visitas.
                </p>
              )}
            </div>
          )}

          <Field
            id="visit-start"
            label="Início previsto"
            type="datetime-local"
            required
            value={form.scheduledStart}
            disabled={isSubmitting}
            min={visit ? undefined : minimumStart}
            hint="A previsão do serviço é sugerida automaticamente; ajuste se necessário."
            error={fieldErrors.scheduledStart}
            onChange={(e) => updateField("scheduledStart", e.target.value)}
          />
          <Field
            id="visit-end"
            label="Fim previsto"
            type="datetime-local"
            value={form.scheduledEnd}
            disabled={isSubmitting}
            error={fieldErrors.scheduledEnd}
            onChange={(e) => updateField("scheduledEnd", e.target.value)}
          />
        </div>

        <div className="mt-4">
          <label
            htmlFor="visit-description"
            className="mb-1.5 block text-sm font-semibold text-tp-text-main"
          >
            Descrição
          </label>
          <textarea
            id="visit-description"
            rows={2}
            value={form.description}
            disabled={isSubmitting}
            onChange={(e) => updateField("description", e.target.value)}
            className={TEXTAREA_CLASSES}
          />
        </div>

        {/* Técnicos ativos (RN-SRV-03). */}
        <div className="mt-4 flex flex-col gap-1.5">
          <span
            id="visit-technicians-label"
            className="text-sm font-semibold text-tp-text-main"
          >
            Técnicos atribuídos
          </span>
            <>
              {fieldErrors.technicianIds ? (
                <p className="text-sm text-tp-danger">
                  {fieldErrors.technicianIds}
                </p>
              ) : techniciansUnavailable ? (
                <p className="text-sm text-tp-text-muted">
                  Não foi possível carregar os técnicos. A atribuição existente será preservada.
                </p>
              ) : (
                <p className="text-sm text-tp-text-muted">
                  Uma visita pode ter vários técnicos (RN-SRV-03).
                </p>
              )}
              <div
                role="group"
                aria-labelledby="visit-technicians-label"
                className="grid gap-2 sm:grid-cols-2"
              >
                {isLoadingAux ? (
                  <p className="text-sm text-tp-text-muted">
                    Carregando técnicos…
                  </p>
                ) : technicians.length === 0 && !visit?.technicians.length ? (
                  <p className="text-sm text-tp-text-muted">
                    Nenhum técnico disponível para atribuição.
                  </p>
                ) : (
                  [...technicians, ...(visit?.technicians.map((link) => link.technician).filter((item) => !technicians.some((active) => active.id === item.id)) ?? [])].map((technician) => {
                    const checked = form.technicianIds.includes(technician.id);
                    return (
                      <label
                        key={technician.id}
                        className={`flex cursor-pointer items-center gap-2 rounded-tp-sm border px-3 py-2 text-sm text-tp-text-main ${
                          checked
                            ? "border-tp-primary bg-tp-neutral-50"
                            : "border-tp-border bg-white"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-tp-primary"
                          checked={checked}
                          disabled={isSubmitting || techniciansUnavailable || (!checked && !technicians.some((active) => active.id === technician.id))}
                          onChange={() => toggleTechnician(technician.id)}
                        />
                        {technician.name}
                      </label>
                    );
                  })
                )}
              </div>
            </>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isSubmitting} loadingLabel="Salvando…">
            {visit ? "Salvar alterações" : "Agendar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
