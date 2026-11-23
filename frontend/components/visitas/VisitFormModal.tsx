"use client";

import { useEffect, useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import {
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
  type SchedulableServiceOption,
  type TechnicianOption,
  type Visit,
} from "@/lib/visits-data";

/**
 * Schedule/edit visit form (ADMIN and PLANNING).
 *
 * The service is chosen among the open ones (PLANNED/IN_PROGRESS); a visit
 * always carries at least one technician (RN-SRV-03: a visit can have several
 * technicians and a technician can take part in several visits). The payload
 * mirrors the contract documented in lib/visits-data.ts.
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
  const [services, setServices] = useState<SchedulableServiceOption[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
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
          technicianIds: visit.technicians.map((technician) => technician.id),
        }
      : { ...EMPTY_FORM, serviceId: defaultServiceId ?? "" },
  );
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* Load open services and the technicians available for assignment. */
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [serviceOptions, technicianOptions] = await Promise.all([
          listSchedulableServices(),
          listTechnicians(),
        ]);
        if (!active) return;
        setServices(serviceOptions);
        setTechnicians(technicianOptions);
      } catch (err) {
        if (active) {
          setFormError(
            err instanceof Error
              ? err.message
              : "Não foi possível carregar os dados do formulário.",
          );
        }
      } finally {
        if (active) setIsLoadingAux(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isSubmitting) return;
    setFormError("");

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

    setFieldErrors({});
    setIsSubmitting(true);

    const payload = {
      scheduledStart: fromDatetimeLocal(form.scheduledStart),
      scheduledEnd: optionalDatetimeLocal(form.scheduledEnd),
      description: form.description.trim() ? form.description.trim() : null,
      technicianIds: form.technicianIds,
    };

    try {
      if (visit) {
        await updateVisit(visit.id, payload);
        onSaved("Visita atualizada.");
      } else {
        await createVisit({ ...payload, serviceId: form.serviceId });
        onSaved("Visita agendada.");
      }
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Não foi possível salvar a visita.",
      );
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
                onChange={(e) => updateField("serviceId", e.target.value)}
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

        {/* Técnicos atribuídos (RN-SRV-03). */}
        <div className="mt-4 flex flex-col gap-1.5">
          <span
            id="visit-technicians-label"
            className="text-sm font-semibold text-tp-text-main"
          >
            Técnicos atribuídos *
          </span>
          {fieldErrors.technicianIds ? (
            <p className="text-sm text-tp-danger">{fieldErrors.technicianIds}</p>
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
              <p className="text-sm text-tp-text-muted">Carregando técnicos…</p>
            ) : (
              technicians.map((technician) => {
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
                      disabled={isSubmitting}
                      onChange={() => toggleTechnician(technician.id)}
                    />
                    {technician.name}
                  </label>
                );
              })
            )}
          </div>
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
