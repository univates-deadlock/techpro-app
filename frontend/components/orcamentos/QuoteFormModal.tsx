"use client";

import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { formatBRL, formatCentsForInput, parseMoneyToCents } from "@/lib/money";
import { quoteSchema } from "@/lib/schemas";
import {
  createQuote,
  updateQuote,
  type Quote,
  type QuoteClientOption,
  type QuoteItemType,
  type QuoteUpdateItemPayload,
} from "@/lib/quotes";

const MAX_MONEY_CENTS = 999_999_999_999; // R$ 9.999.999.999,99
const MAX_QUANTITY = 99_999_999.99;

type QuoteItemFormData = {
  localKey: string;
  id?: string;
  type: QuoteItemType;
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string;
};

type QuoteFormData = {
  clientId: string;
  notes: string;
  discount: string;
  items: QuoteItemFormData[];
};

let nextLocalKeyId = 1;
function makeLocalKey(): string {
  return `quote-item-${nextLocalKeyId++}`;
}

function createEmptyItem(): QuoteItemFormData {
  return {
    localKey: makeLocalKey(),
    type: "SERVICE",
    description: "",
    quantity: "1",
    unitPrice: "0",
    discount: "0",
  };
}

function parseQuantity(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/^\d+([.,]\d{1,2})?$/.test(trimmed)) return null;
  const parsed = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function buildInitialFormData(quote: Quote | null): QuoteFormData {
  if (!quote) {
    return {
      clientId: "",
      notes: "",
      discount: "0",
      items: [createEmptyItem()],
    };
  }

  return {
    clientId: quote.clientId,
    notes: quote.notes ?? "",
    discount: formatCentsForInput(quote.discountCents),
    items:
      quote.items.length > 0
        ? quote.items.map((item) => ({
            localKey: makeLocalKey(),
            id: item.id,
            type: item.type,
            description: item.description,
            quantity: String(item.quantity).replace(".", ","),
            unitPrice: formatCentsForInput(item.unitPriceCents),
            discount: formatCentsForInput(item.discountCents),
          }))
        : [createEmptyItem()],
  };
}

type QuoteFormModalProps = {
  open: boolean;
  mode: "create" | "edit";
  quote: Quote | null;
  clients: QuoteClientOption[];
  fallbackClientName?: string;
  isLoadingQuote?: boolean;
  loadError?: string;
  onClose: () => void;
  onSaved: (saved: Quote) => void;
};

export function QuoteFormModal({
  open,
  mode,
  quote,
  clients,
  fallbackClientName,
  isLoadingQuote = false,
  loadError = "",
  onClose,
  onSaved,
}: QuoteFormModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formKey =
    mode === "edit"
      ? `edit-${quote?.id ?? "loading"}-${quote?.updatedAt ?? ""}`
      : `create-${open ? "open" : "closed"}`;

  return (
    <Modal
      open={open}
      title={mode === "edit" ? "Editar orçamento" : "Novo orçamento"}
      onClose={() => (isSubmitting ? null : onClose())}
      dismissible={!isSubmitting}
    >
      {isLoadingQuote ? (
        <p className="py-6 text-sm text-tp-text-muted">Carregando dados do orçamento…</p>
      ) : loadError ? (
        <div className="flex flex-col gap-4">
          <Alert tone="error">{loadError}</Alert>
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      ) : (
        <QuoteFormBody
          key={formKey}
          mode={mode}
          quote={quote}
          clients={clients}
          fallbackClientName={fallbackClientName}
          isSubmitting={isSubmitting}
          setIsSubmitting={setIsSubmitting}
          onSaved={onSaved}
        />
      )}
    </Modal>
  );
}

type QuoteFormBodyProps = {
  mode: "create" | "edit";
  quote: Quote | null;
  clients: QuoteClientOption[];
  fallbackClientName?: string;
  isSubmitting: boolean;
  setIsSubmitting: (value: boolean) => void;
  onSaved: (saved: Quote) => void;
};

function QuoteFormBody({
  mode,
  quote,
  clients,
  fallbackClientName,
  isSubmitting,
  setIsSubmitting,
  onSaved,
}: QuoteFormBodyProps) {
  const [formData, setFormData] = useState<QuoteFormData>(() => buildInitialFormData(quote));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const isEdit = mode === "edit";
  const clientName = quote?.clientName || fallbackClientName || "Cliente selecionado";
  const hasSelectedClientOption =
    !formData.clientId || clients.some((client) => client.id === formData.clientId);

  function clearFieldError(fieldKey: string) {
    setFieldErrors((prev) => {
      if (!prev[fieldKey] && !prev["form"]) return prev;
      const next = { ...prev };
      delete next[fieldKey];
      delete next["form"];
      return next;
    });
  }

  function clearItemFieldErrors() {
    setFieldErrors((prev) => {
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (!k.startsWith("items.") && k !== "form") {
          next[k] = v;
        }
      }
      return next;
    });
  }

  function addItem() {
    setFormData((prev) => ({ ...prev, items: [...prev.items, createEmptyItem()] }));
    clearItemFieldErrors();
  }

  function removeItem(index: number) {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.length > 1 ? prev.items.filter((_, i) => i !== index) : prev.items,
    }));
    clearItemFieldErrors();
  }

  function updateItem(
    index: number,
    field: Exclude<keyof QuoteItemFormData, "localKey" | "id">,
    value: string,
  ) {
    setFormData((prev) => {
      const nextItems = [...prev.items];
      nextItems[index] = { ...nextItems[index], [field]: value };
      return { ...prev, items: nextItems };
    });
    clearFieldError(`items.${index}.${field}`);
  }

  // Live financial preview (computed in integer cents matching server rules).
  let previewGrossCents = 0;
  let previewItemDiscountsCents = 0;
  let previewSubtotalCents = 0;

  for (const item of formData.items) {
    const qty = parseQuantity(item.quantity);
    const unitCents = parseMoneyToCents(item.unitPrice);
    const discCents = item.discount.trim() === "" ? 0 : (parseMoneyToCents(item.discount) ?? 0);
    if (qty !== null && qty > 0 && unitCents !== null && unitCents >= 0) {
      const gross = Math.round(qty * unitCents);
      const safeDisc = Math.max(0, Math.min(discCents, gross));
      previewGrossCents += gross;
      previewItemDiscountsCents += safeDisc;
      previewSubtotalCents += gross - safeDisc;
    }
  }

  const rawGeneralDiscCents =
    formData.discount.trim() === "" ? 0 : (parseMoneyToCents(formData.discount) ?? 0);
  const previewGeneralDiscCents = Math.max(0, rawGeneralDiscCents);
  const previewTotalDiscountsCents = previewItemDiscountsCents + previewGeneralDiscCents;
  const previewTotalCents = Math.max(0, previewSubtotalCents - previewGeneralDiscCents);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isSubmitting) return;

    const errors: Record<string, string> = {};
    if (!formData.clientId) {
      errors["clientId"] = "Selecione um cliente.";
    }
    if (formData.items.length === 0) {
      errors["form"] = "Adicione pelo menos 1 item ao orçamento.";
    }
    if (formData.items.length > 100) {
      errors["form"] = "Máximo de 100 itens por orçamento.";
    }

    const itemsPayload: QuoteUpdateItemPayload[] = [];
    let itemsSubtotalCents = 0;

    formData.items.forEach((item, index) => {
      const trimmedDesc = item.description.trim();
      if (!trimmedDesc) {
        errors[`items.${index}.description`] = "Informe a descrição do item.";
      }

      const quantity = parseQuantity(item.quantity);
      if (quantity === null || quantity <= 0) {
        errors[`items.${index}.quantity`] = "Informe uma quantidade válida maior que zero.";
      } else if (quantity > MAX_QUANTITY) {
        errors[`items.${index}.quantity`] = "Quantidade acima do limite permitido.";
      }

      const unitPriceCents = parseMoneyToCents(item.unitPrice);
      if (unitPriceCents === null || unitPriceCents < 0) {
        errors[`items.${index}.unitPrice`] = "Informe um valor unitário válido.";
      } else if (unitPriceCents > MAX_MONEY_CENTS) {
        errors[`items.${index}.unitPrice`] = "Valor unitário acima do limite permitido.";
      }

      const discountText = item.discount.trim();
      const discountCents = discountText === "" ? 0 : parseMoneyToCents(discountText);
      if (discountText.includes("%")) {
        errors[`items.${index}.discount`] =
          "Informe o desconto em reais (R$), não em percentual (%).";
      } else if (discountCents === null || discountCents < 0) {
        errors[`items.${index}.discount`] = "Informe um desconto em reais (R$) válido.";
      } else if (discountCents > MAX_MONEY_CENTS) {
        errors[`items.${index}.discount`] = "Desconto acima do limite permitido.";
      }

      if (
        quantity !== null &&
        quantity > 0 &&
        unitPriceCents !== null &&
        unitPriceCents >= 0 &&
        discountCents !== null &&
        discountCents >= 0
      ) {
        const grossCents = Math.round(quantity * unitPriceCents);
        if (discountCents > grossCents) {
          errors[`items.${index}.discount`] =
            "O desconto do item não pode ser maior que quantidade × valor unitário.";
        } else {
          itemsSubtotalCents += grossCents - discountCents;
        }
      }

      itemsPayload.push({
        ...(item.id ? { id: item.id } : {}),
        type: item.type,
        description: trimmedDesc,
        quantity: quantity ?? 0,
        unitPrice: (unitPriceCents ?? 0) / 100,
        discount: (discountCents ?? 0) / 100,
      });
    });

    const generalDiscountText = formData.discount.trim();
    const generalDiscountCents =
      generalDiscountText === "" ? 0 : parseMoneyToCents(generalDiscountText);

    if (generalDiscountText.includes("%")) {
      errors["discount"] = "Informe o desconto geral em reais (R$), não em percentual (%).";
    } else if (generalDiscountCents === null || generalDiscountCents < 0) {
      errors["discount"] = "Informe um desconto geral em reais (R$) válido.";
    } else if (generalDiscountCents > MAX_MONEY_CENTS) {
      errors["discount"] = "Desconto geral acima do limite permitido.";
    } else if (
      Object.keys(errors).filter((k) => k.startsWith("items.")).length === 0 &&
      generalDiscountCents > itemsSubtotalCents
    ) {
      errors["discount"] = "O desconto geral não pode ser maior que o subtotal dos itens.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    // Final check against the shared schema (mirror of the backend)
    const parsed = quoteSchema.safeParse({
      clientId: formData.clientId,
      notes: formData.notes.trim() ? formData.notes.trim() : null,
      discount: (generalDiscountCents ?? 0) / 100,
      items: itemsPayload.map(({ type, description, quantity, unitPrice, discount }) => ({
        type, description, quantity, unitPrice, discount,
      })),
    });
    if (!parsed.success) {
      //Displays the first error message in the form alert
      setFieldErrors({ form: parsed.error.issues[0]?.message ?? "Dados inválidos." });
      return;
    }

    setIsSubmitting(true);
    try {
      const notes = formData.notes.trim() ? formData.notes.trim() : null;
      const discountReais = (generalDiscountCents ?? 0) / 100;

      if (isEdit) {
        if (!quote) {
          setFieldErrors({ form: "Orçamento não carregado para edição." });
          return;
        }
        const saved = await updateQuote(quote.id, {
          notes,
          discount: discountReais,
          items: itemsPayload,
        });
        onSaved(saved);
      } else {
        const saved = await createQuote({
          clientId: formData.clientId,
          notes,
          discount: discountReais,
          items: itemsPayload.map(({ type, description, quantity, unitPrice, discount }) => ({
            type,
            description,
            quantity,
            unitPrice,
            discount,
          })),
        });
        onSaved(saved);
      }
    } catch (err) {
      setFieldErrors({
        form: err instanceof Error ? err.message : "Não foi possível salvar o orçamento.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {fieldErrors["form"] ? <Alert tone="error">{fieldErrors["form"]}</Alert> : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="quote-client" className="text-sm font-semibold text-tp-text-main">
          Cliente
        </label>
        <select
          id="quote-client"
          value={formData.clientId}
          disabled={isSubmitting || isEdit}
          onChange={(e) => {
            setFormData((p) => ({ ...p, clientId: e.target.value }));
            clearFieldError("clientId");
          }}
          className="w-full rounded-tp-sm border border-tp-border bg-white px-3 py-2.5 text-base text-tp-text-main focus:outline-none focus:border-tp-primary disabled:bg-tp-neutral-100"
        >
          <option value="">Selecione um cliente...</option>
          {!hasSelectedClientOption ? (
            <option value={formData.clientId}>{clientName}</option>
          ) : null}
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
        {fieldErrors["clientId"] ? (
          <span className="text-xs text-tp-danger">{fieldErrors["clientId"]}</span>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 border-t border-b border-tp-border-light py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-tp-text-main">Itens do Orçamento</h3>
          <Button type="button" variant="ghost" disabled={isSubmitting} onClick={addItem}>
            + Adicionar item
          </Button>
        </div>

        {formData.items.map((item, index) => (
          <div
            key={item.localKey}
            className="flex flex-col gap-2 rounded border border-tp-border-light bg-tp-neutral-50 p-3"
          >
            <div className="flex items-center gap-2">
              <select
                aria-label={`Tipo do item ${index + 1}`}
                value={item.type}
                disabled={isSubmitting}
                onChange={(e) =>
                  updateItem(index, "type", e.target.value as QuoteItemFormData["type"])
                }
                className="rounded border border-tp-border bg-white px-2 py-1 text-sm"
              >
                <option value="SERVICE">Serviço</option>
                <option value="PRODUCT">Produto</option>
                <option value="OTHER">Outro</option>
              </select>
              <input
                type="text"
                aria-label={`Descrição do item ${index + 1}`}
                placeholder="Descrição do item..."
                value={item.description}
                disabled={isSubmitting}
                onChange={(e) => updateItem(index, "description", e.target.value)}
                className="flex-1 rounded border border-tp-border bg-white px-2 py-1 text-sm"
              />
              {formData.items.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isSubmitting}
                  onClick={() => removeItem(index)}
                >
                  Remover
                </Button>
              ) : null}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Field
                id={`qty-${index}`}
                label="Qtd"
                inputMode="decimal"
                value={item.quantity}
                disabled={isSubmitting}
                error={fieldErrors[`items.${index}.quantity`]}
                onChange={(e) => updateItem(index, "quantity", e.target.value)}
              />
              <Field
                id={`price-${index}`}
                label="Preço Un. (R$)"
                inputMode="decimal"
                value={item.unitPrice}
                disabled={isSubmitting}
                error={fieldErrors[`items.${index}.unitPrice`]}
                onChange={(e) => updateItem(index, "unitPrice", e.target.value)}
              />
              <Field
                id={`disc-${index}`}
                label="Desc. Item (R$)"
                inputMode="decimal"
                value={item.discount}
                disabled={isSubmitting}
                error={fieldErrors[`items.${index}.discount`]}
                onChange={(e) => updateItem(index, "discount", e.target.value)}
              />
            </div>
            {fieldErrors[`items.${index}.description`] ? (
              <span className="text-xs text-tp-danger">
                {fieldErrors[`items.${index}.description`]}
              </span>
            ) : null}
          </div>
        ))}
      </div>

      <Field
        id="quote-discount"
        label="Desconto geral (R$)"
        inputMode="decimal"
        value={formData.discount}
        disabled={isSubmitting}
        error={fieldErrors["discount"]}
        onChange={(e) => {
          setFormData((p) => ({ ...p, discount: e.target.value }));
          clearFieldError("discount");
        }}
      />

      <Field
        id="quote-notes"
        label="Observações / Notas"
        value={formData.notes}
        disabled={isSubmitting}
        onChange={(e) => {
          setFormData((p) => ({ ...p, notes: e.target.value }));
          clearFieldError("notes");
        }}
      />

      <div className="rounded-tp-sm border border-tp-border-light bg-tp-neutral-50 px-3.5 py-2.5 text-sm">
        <div className="flex justify-between text-tp-text-body">
          <span>Subtotal bruto</span>
          <span className="font-medium text-tp-text-main">{formatBRL(previewGrossCents)}</span>
        </div>
        <div className="mt-1 flex justify-between text-tp-text-body">
          <span>Descontos totais</span>
          <span className="font-medium text-tp-danger">
            {previewTotalDiscountsCents > 0
              ? `-${formatBRL(previewTotalDiscountsCents)}`
              : formatBRL(0)}
          </span>
        </div>
        <div className="mt-1.5 flex justify-between border-t border-tp-border-light pt-1.5 font-bold">
          <span className="text-tp-text-main">Total estimado</span>
          <span className="text-tp-green-600">{formatBRL(previewTotalCents)}</span>
        </div>
      </div>

      <Button
        type="submit"
        variant="primary"
        isLoading={isSubmitting}
        loadingLabel="Salvando…"
      >
        {isEdit ? "Salvar alterações" : "Criar orçamento"}
      </Button>
    </form>
  );
}
