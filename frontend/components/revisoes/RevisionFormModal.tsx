"use client";

import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/SelectField";
import { revisionSchema } from "@/lib/schemas";
import {
  createRevision,
  updateRevision,
  type Revision,
} from "@/lib/revisions";
import type { ServiceOption } from "@/lib/service-options";

type RevisionFormData = {
  serviceId: string;
  scheduledAt: string;
  notes: string;
};

function buildInitialFormData(revision: Revision | null): RevisionFormData {
  if (!revision) {
    return { serviceId: "", scheduledAt: "", notes: "" };
  }
  return {
    serviceId: revision.serviceId,
    scheduledAt: revision.scheduledAt,
    notes: revision.notes ?? "",
  };
}

type RevisionFormModalProps = {
  open: boolean;
  mode: "create" | "edit";
  revision: Revision | null;
  services: ServiceOption[];
  onClose: () => void;
  onSaved: () => void;
};

/** Modal for creating or editing a revision. */
export function RevisionFormModal({
  open,
  mode,
  revision,
  services,
  onClose,
  onSaved,
}: RevisionFormModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formKey =
    mode === "edit"
      ? `edit-${revision?.id ?? "none"}`
      : `create-${open ? "open" : "closed"}`;

  return (
    <Modal
      open={open}
      title={mode === "edit" ? "Editar revisão" : "Nova revisão"}
      onClose={() => (isSubmitting ? null : onClose())}
      dismissible={!isSubmitting}
    >
      <RevisionFormBody
        key={formKey}
        mode={mode}
        revision={revision}
        services={services}
        isSubmitting={isSubmitting}
        setIsSubmitting={setIsSubmitting}
        onSaved={onSaved}
      />
    </Modal>
  );
}

type RevisionFormBodyProps = {
  mode: "create" | "edit";
  revision: Revision | null;
  services: ServiceOption[];
  isSubmitting: boolean;
  setIsSubmitting: (v: boolean) => void;
  onSaved: () => void;
};

function RevisionFormBody({
  mode,
  revision,
  services,
  isSubmitting,
  setIsSubmitting,
  onSaved,
}: RevisionFormBodyProps) {
  const [formData, setFormData] = useState<RevisionFormData>(() =>
    buildInitialFormData(revision),
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const isEdit = mode === "edit";

  function update(field: keyof RevisionFormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      if (!prev[field] && !prev["form"]) return prev;
      const next = { ...prev };
      delete next[field];
      delete next["form"];
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isSubmitting) return;

    const parsed = revisionSchema.safeParse(formData);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...parsed.data,
        notes: parsed.data.notes || null,
      };
      if (isEdit && revision) {
        await updateRevision(revision.id, {
          scheduledAt: payload.scheduledAt,
          notes: payload.notes,
        });
      } else {
        await createRevision(payload);
      }
      onSaved();
    } catch (err) {
      setFieldErrors({
        form: err instanceof Error ? err.message : "Não foi possível salvar a revisão.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const serviceOptions = services.map((s) => ({
    value: s.id,
    label: `${s.title} — ${s.clientName}`,
  }));

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {fieldErrors["form"] ? <Alert tone="error">{fieldErrors["form"]}</Alert> : null}

      <SelectField
        id="revision-service"
        label="Serviço"
        value={formData.serviceId}
        disabled={isSubmitting || isEdit}
        options={serviceOptions}
        placeholder="Selecione um serviço..."
        error={fieldErrors["serviceId"]}
        onChange={(e) => update("serviceId", e.target.value)}
      />

      <Field
        id="revision-scheduled"
        label="Data prevista"
        type="date"
        value={formData.scheduledAt}
        disabled={isSubmitting}
        error={fieldErrors["scheduledAt"]}
        onChange={(e) => update("scheduledAt", e.target.value)}
      />

      <Field
        id="revision-notes"
        label="Observações"
        value={formData.notes}
        disabled={isSubmitting}
        error={fieldErrors["notes"]}
        onChange={(e) => update("notes", e.target.value)}
      />

      <Button
        type="submit"
        variant="primary"
        isLoading={isSubmitting}
        loadingLabel="Salvando…"
      >
        {isEdit ? "Salvar alterações" : "Criar revisão"}
      </Button>
    </form>
  );
}
