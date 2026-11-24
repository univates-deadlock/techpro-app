"use client";

import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/SelectField";
import { warrantySchema } from "@/lib/schemas";
import {
  createWarranty,
  updateWarranty,
  type Warranty,
} from "@/lib/warranties";
import type { ServiceOption } from "@/lib/service-options";

type WarrantyFormData = {
  serviceId: string;
  type: string;
  startsAt: string;
  endsAt: string;
  description: string;
  manufacturer: string;
  productReference: string;
};

function buildInitialFormData(warranty: Warranty | null): WarrantyFormData {
  if (!warranty) {
    return {
      serviceId: "",
      type: "SERVICE",
      startsAt: "",
      endsAt: "",
      description: "",
      manufacturer: "",
      productReference: "",
    };
  }
  return {
    serviceId: warranty.serviceId,
    type: warranty.type,
    startsAt: warranty.startsAt,
    endsAt: warranty.endsAt,
    description: warranty.description ?? "",
    manufacturer: warranty.manufacturer ?? "",
    productReference: warranty.productReference ?? "",
  };
}

type WarrantyFormModalProps = {
  open: boolean;
  mode: "create" | "edit";
  warranty: Warranty | null;
  services: ServiceOption[];
  onClose: () => void;
  onSaved: () => void;
};

/** Modal for creating or editing a warranty. */
export function WarrantyFormModal({
  open,
  mode,
  warranty,
  services,
  onClose,
  onSaved,
}: WarrantyFormModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formKey =
    mode === "edit"
      ? `edit-${warranty?.id ?? "none"}`
      : `create-${open ? "open" : "closed"}`;

  return (
    <Modal
      open={open}
      title={mode === "edit" ? "Editar garantia" : "Nova garantia"}
      onClose={() => (isSubmitting ? null : onClose())}
      dismissible={!isSubmitting}
    >
      <WarrantyFormBody
        key={formKey}
        mode={mode}
        warranty={warranty}
        services={services}
        isSubmitting={isSubmitting}
        setIsSubmitting={setIsSubmitting}
        onSaved={onSaved}
      />
    </Modal>
  );
}

type WarrantyFormBodyProps = {
  mode: "create" | "edit";
  warranty: Warranty | null;
  services: ServiceOption[];
  isSubmitting: boolean;
  setIsSubmitting: (v: boolean) => void;
  onSaved: () => void;
};

function WarrantyFormBody({
  mode,
  warranty,
  services,
  isSubmitting,
  setIsSubmitting,
  onSaved,
}: WarrantyFormBodyProps) {
  const [formData, setFormData] = useState<WarrantyFormData>(() =>
    buildInitialFormData(warranty),
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const isEdit = mode === "edit";
  const isManufacturer = formData.type === "MANUFACTURER";

  function update(field: keyof WarrantyFormData, value: string) {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      // Clear manufacturer fields when switching to SERVICE
      if (field === "type" && value === "SERVICE") {
        next.manufacturer = "";
        next.productReference = "";
      }
      return next;
    });
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

    const parsed = warrantySchema.safeParse(formData);
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
        description: parsed.data.description || null,
        manufacturer: parsed.data.manufacturer || null,
        productReference: parsed.data.productReference || null,
      };
      if (isEdit && warranty) {
        await updateWarranty(warranty.id, {
          type: payload.type,
          startsAt: payload.startsAt,
          endsAt: payload.endsAt,
          description: payload.description,
          manufacturer: payload.manufacturer,
          productReference: payload.productReference,
        });
      } else {
        await createWarranty(payload);
      }
      onSaved();
    } catch (err) {
      setFieldErrors({
        form: err instanceof Error ? err.message : "Não foi possível salvar a garantia.",
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
        id="warranty-service"
        label="Serviço"
        value={formData.serviceId}
        disabled={isSubmitting || isEdit}
        options={serviceOptions}
        placeholder="Selecione um serviço..."
        error={fieldErrors["serviceId"]}
        onChange={(e) => update("serviceId", e.target.value)}
      />

      <SelectField
        id="warranty-type"
        label="Tipo"
        value={formData.type}
        disabled={isSubmitting}
        options={[
          { value: "SERVICE", label: "Serviço" },
          { value: "MANUFACTURER", label: "Fabricante" },
        ]}
        error={fieldErrors["type"]}
        onChange={(e) => update("type", e.target.value)}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          id="warranty-starts"
          label="Início"
          type="date"
          value={formData.startsAt}
          disabled={isSubmitting}
          error={fieldErrors["startsAt"]}
          onChange={(e) => update("startsAt", e.target.value)}
        />
        <Field
          id="warranty-ends"
          label="Término"
          type="date"
          value={formData.endsAt}
          disabled={isSubmitting}
          error={fieldErrors["endsAt"]}
          onChange={(e) => update("endsAt", e.target.value)}
        />
      </div>

      <Field
        id="warranty-description"
        label="Descrição"
        value={formData.description}
        disabled={isSubmitting}
        error={fieldErrors["description"]}
        onChange={(e) => update("description", e.target.value)}
      />

      {isManufacturer ? (
        <>
          <Field
            id="warranty-manufacturer"
            label="Fabricante"
            value={formData.manufacturer}
            disabled={isSubmitting}
            error={fieldErrors["manufacturer"]}
            onChange={(e) => update("manufacturer", e.target.value)}
          />
          <Field
            id="warranty-product-ref"
            label="Referência do produto"
            value={formData.productReference}
            disabled={isSubmitting}
            error={fieldErrors["productReference"]}
            onChange={(e) => update("productReference", e.target.value)}
          />
        </>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        isLoading={isSubmitting}
        loadingLabel="Salvando…"
      >
        {isEdit ? "Salvar alterações" : "Criar garantia"}
      </Button>
    </form>
  );
}
