"use client";

import { useEffect, useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { optionalDatetimeLocal, toDatetimeLocal } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { serviceSchema } from "@/lib/schemas";
import {
  createService,
  listApprovedQuotesWithoutService,
  listClientsForService,
  updateService,
  type ApprovedQuoteOption,
  type ServiceClientOption,
  type ServiceListItem,
  type ServiceOriginValue,
} from "@/lib/services-data";

/**
 * Create/edit service form.
 *
 * Mirrors the API rules of api/src/schemas/service.schema.ts (branch
 * feat/api-services):
 * - RN-SRV-01: origin QUOTE requires an approved quote (the client comes from
 *   the quote); any other origin requires the client directly.
 * - After creation the origin/quote/client cannot change (updateServiceSchema
 *   has no such fields).
 * - Closed services (COMPLETED/CANCELLED) accept only the external OS
 *   reference, which can be filled later (RN-SRV-02).
 */

const ORIGIN_OPTIONS: { value: ServiceOriginValue; label: string }[] = [
  { value: "QUOTE", label: "Orçamento aprovado" },
  { value: "SUPPORT", label: "Suporte" },
  { value: "MAINTENANCE", label: "Manutenção" },
  { value: "REVISION", label: "Revisão" },
  { value: "WARRANTY", label: "Garantia" },
  { value: "OTHER", label: "Outro" },
];

const SELECT_CLASSES =
  "w-full rounded-tp-sm border border-tp-border bg-white px-3 py-2.5 text-base text-tp-text-main focus:outline-none focus:border-tp-primary disabled:bg-tp-neutral-100";

type ServiceFormState = {
  origin: ServiceOriginValue;
  quoteId: string;
  clientId: string;
  title: string;
  description: string;
  externalOsNumber: string;
  plannedStart: string;
  plannedEnd: string;
};

const EMPTY_FORM: ServiceFormState = {
  origin: "QUOTE",
  quoteId: "",
  clientId: "",
  title: "",
  description: "",
  externalOsNumber: "",
  plannedStart: "",
  plannedEnd: "",
};

export function ServiceFormModal({
  open,
  service,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** null = create; otherwise the service being edited. */
  service: ServiceListItem | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [clients, setClients] = useState<ServiceClientOption[]>([]);
  const [quotes, setQuotes] = useState<ApprovedQuoteOption[]>([]);
  const [isLoadingAux, setIsLoadingAux] = useState(true);
  /* The parent mounts this component only while the modal is open, so the
     initializers below reset the form on every open without an effect. */
  const [form, setForm] = useState<ServiceFormState>(() =>
    service
      ? {
          origin: service.origin,
          quoteId: service.quoteId ?? "",
          clientId: service.clientId,
          title: service.title,
          description: service.description ?? "",
          externalOsNumber: service.externalOsNumber ?? "",
          plannedStart: toDatetimeLocal(service.plannedStart),
          plannedEnd: toDatetimeLocal(service.plannedEnd),
        }
      : EMPTY_FORM,
  );
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* Load the selects data (active clients and approved quotes). */
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [clientOptions, quoteOptions] = await Promise.all([
          listClientsForService(),
          listApprovedQuotesWithoutService(),
        ]);
        if (!active) return;
        setClients(clientOptions);
        setQuotes(quoteOptions);
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

  const isEdit = service !== null;
  const isClosed =
    service !== null &&
    (service.status === "COMPLETED" || service.status === "CANCELLED");

  function updateField<K extends keyof ServiceFormState>(
    key: K,
    value: ServiceFormState[K],
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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isSubmitting) return;
    setFormError("");

    const result = serviceSchema.safeParse(form);
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

    try {
      if (service) {
        await updateService(service.id, {
          /* Closed services accept only the OS reference (RN-SRV-02). */
          ...(isClosed
            ? {}
            : {
                title: form.title.trim(),
                description: form.description.trim() ? form.description.trim() : null,
                plannedStart: optionalDatetimeLocal(form.plannedStart),
                plannedEnd: optionalDatetimeLocal(form.plannedEnd),
              }),
          externalOsNumber: form.externalOsNumber.trim()
            ? form.externalOsNumber.trim()
            : null,
        });
        onSaved("Serviço atualizado.");
      } else {
        await createService({
          origin: form.origin,
          clientId: form.origin === "QUOTE" ? null : form.clientId,
          quoteId: form.origin === "QUOTE" ? form.quoteId : null,
          title: form.title.trim(),
          description: form.description.trim() ? form.description.trim() : null,
          externalOsNumber: form.externalOsNumber.trim()
            ? form.externalOsNumber.trim()
            : null,
          plannedStart: optionalDatetimeLocal(form.plannedStart),
          plannedEnd: optionalDatetimeLocal(form.plannedEnd),
        });
        onSaved("Serviço cadastrado.");
      }
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Não foi possível salvar o serviço.",
      );
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(false);
  }

  return (
    <Modal
      open={open}
      title={service ? "Editar serviço" : "Cadastrar serviço"}
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
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="service-origin"
              className="text-sm font-semibold text-tp-text-main"
            >
              Origem *
            </label>
            <select
              id="service-origin"
              value={form.origin}
              disabled={isSubmitting || isEdit}
              onChange={(e) => updateField("origin", e.target.value as ServiceOriginValue)}
              className={SELECT_CLASSES}
            >
              {ORIGIN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {isEdit ? (
              <p className="text-sm text-tp-text-muted">
                A origem não pode ser alterada após o cadastro.
              </p>
            ) : null}
          </div>

          {isEdit ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-tp-text-main">Cliente</span>
              <p className="rounded-tp-sm border border-tp-border bg-tp-neutral-50 px-3 py-2.5 text-base text-tp-text-body">
                {service.client.name}
              </p>
              {service.quoteId ? (
                <p className="text-sm text-tp-text-muted">
                  Serviço vinculado a um orçamento aprovado.
                </p>
              ) : (
                <p className="text-sm text-tp-text-muted">Serviço direto.</p>
              )}
            </div>
          ) : form.origin === "QUOTE" ? (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="service-quote"
                className="text-sm font-semibold text-tp-text-main"
              >
                Orçamento aprovado *
              </label>
              <select
                id="service-quote"
                value={form.quoteId}
                disabled={isSubmitting || isLoadingAux}
                onChange={(e) => updateField("quoteId", e.target.value)}
                className={SELECT_CLASSES}
              >
                <option value="">Selecione…</option>
                {quotes.map((quote) => (
                  <option key={quote.id} value={quote.id}>
                    {quote.clientName} — {formatBRL(quote.totalCents)}
                  </option>
                ))}
              </select>
              {fieldErrors.quoteId ? (
                <p className="text-sm text-tp-danger">{fieldErrors.quoteId}</p>
              ) : (
                <p className="text-sm text-tp-text-muted">
                  O cliente é definido pelo orçamento (RN-SRV-01).
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="service-client"
                className="text-sm font-semibold text-tp-text-main"
              >
                Cliente *
              </label>
              <select
                id="service-client"
                value={form.clientId}
                disabled={isSubmitting || isLoadingAux}
                onChange={(e) => updateField("clientId", e.target.value)}
                className={SELECT_CLASSES}
              >
                <option value="">Selecione…</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
              {fieldErrors.clientId ? (
                <p className="text-sm text-tp-danger">{fieldErrors.clientId}</p>
              ) : null}
            </div>
          )}

          <Field
            id="service-title"
            label="Título"
            required
            maxLength={200}
            className="sm:col-span-2"
            value={form.title}
            disabled={isSubmitting || isClosed}
            error={fieldErrors.title}
            onChange={(e) => updateField("title", e.target.value)}
          />

          <Field
            id="service-os"
            label="OS externa (referência)"
            maxLength={100}
            hint="Número da OS no sistema atual — apenas referência (RN-SRV-02)."
            value={form.externalOsNumber}
            disabled={isSubmitting}
            error={fieldErrors.externalOsNumber}
            onChange={(e) => updateField("externalOsNumber", e.target.value)}
          />

          <Field
            id="service-planned-start"
            label="Início planejado"
            type="datetime-local"
            value={form.plannedStart}
            disabled={isSubmitting || isClosed}
            error={fieldErrors.plannedStart}
            onChange={(e) => updateField("plannedStart", e.target.value)}
          />

          <Field
            id="service-planned-end"
            label="Fim planejado"
            type="datetime-local"
            value={form.plannedEnd}
            disabled={isSubmitting || isClosed}
            error={fieldErrors.plannedEnd}
            onChange={(e) => updateField("plannedEnd", e.target.value)}
          />
        </div>

        <div className="mt-4">
          <label
            htmlFor="service-description"
            className="mb-1.5 block text-sm font-semibold text-tp-text-main"
          >
            Descrição
          </label>
          <textarea
            id="service-description"
            rows={3}
            value={form.description}
            disabled={isSubmitting || isClosed}
            onChange={(e) => updateField("description", e.target.value)}
            className="w-full rounded-tp-sm border border-tp-border bg-white px-3 py-2.5 text-base text-tp-text-main focus:outline-none focus:border-tp-primary disabled:bg-tp-neutral-100"
          />
        </div>

        {isClosed ? (
          <p className="mt-3 text-sm text-tp-text-muted">
            Serviço concluído ou cancelado: apenas a OS externa pode ser alterada.
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isSubmitting} loadingLabel="Salvando…">
            {service ? "Salvar alterações" : "Salvar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
