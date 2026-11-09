"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { QuoteFormModal } from "@/components/orcamentos/QuoteFormModal";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/icons";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { formatBRL, formatDateTime, formatQuantity } from "@/lib/money";
import {
  QUOTE_ITEM_TYPE_META,
  QUOTE_STATUS_META,
  getQuote,
  isQuoteOpen,
  sendQuoteApi,
  approveQuoteApi,
  rejectQuoteApi,
  type Quote,
} from "@/lib/quotes";

/**
 * Quote detail screen: displays items, financial summary (reconciling item
 * discounts and general discount), history, and editing while open.
 */

// Texts - action needs to be confirmed by the user before proceeding
const CONFIRM_COPY = {
  send: {
    title: "Marcar como enviado",
    message: "Confirma que este orçamento foi enviado ao cliente? Ele ficará aguardando decisão.",
    confirmLabel: "Confirmar envio",
  },
  approve: {
    title: "Aprovar orçamento",
    message: "Confirmar a aprovação? Depois disso o orçamento não poderá mais ser editado.",
    confirmLabel: "Confirmar aprovação",
  },
} as const;

export function QuoteDetailPageClient({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState("");

  const [pendingAction, setPendingAction] = useState<"send" | "approve" | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setIsLoading(true);
      setError("");
      try {
        const data = await getQuote(quoteId);
        if (!active) return;
        if (!data) {
          setError("Orçamento não encontrado.");
        } else {
          setQuote(data);
        }
        setIsLoading(false);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Não foi possível carregar o orçamento.");
          setIsLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [quoteId]);

  if (isLoading) {
    return <p className="text-tp-text-muted">Carregando orçamento…</p>;
  }

  if (error || !quote) {
    return (
      <div>
        <button
          type="button"
          onClick={() => router.push("/orcamentos")}
          className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-tp-text-body hover:text-tp-text-main"
        >
          <Icon name="back" size={16} />
          Voltar para orçamentos
        </button>
        <Alert tone="error">{error || "Orçamento não encontrado."}</Alert>
      </div>
    );
  }

  const meta = QUOTE_STATUS_META[quote.status];
  const itemDiscountsCents = quote.items.reduce((sum, item) => sum + item.discountCents, 0);
  const grossItemsCents = quote.subtotalCents + itemDiscountsCents;
  const generalDiscountCents = quote.discountCents;
  const totalDiscountsCents = itemDiscountsCents + generalDiscountCents;
  const hasBothDiscountTypes = itemDiscountsCents > 0 && generalDiscountCents > 0;
  
  async function handleStatusChange(
    action: "send" | "approve" | "reject", 
    notes?: string
  ): Promise<boolean> {

    if (!quote) return false;
    setIsActionLoading(true);
    setActionError("");
    setSuccessMessage("");

    try {
      let updated: Quote;
      if (action === "send"){
        updated = await sendQuoteApi(quote.id);
        setSuccessMessage("Orçamento marcado como enviado.");
      } else if (action === "approve") {
        updated = await approveQuoteApi(quote.id, { decisionNotes: notes });
        setSuccessMessage("Orçamento aprovado com sucesso.");
      } else {
        if (!notes) throw new Error("Informe o motivo da rejeição.");
        updated = await rejectQuoteApi(quote.id, { decisionNotes: notes });
        setSuccessMessage("Orçamento marcado como rejeitado.");
      }
      setQuote(updated);
      return true;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erro ao processar ação.");
      return false;
    } finally {
      setIsActionLoading(false);
    }
  }

  async function confirmReject(){
    const reason = rejectReason.trim();

    // Validates the reason before calling the API
    if (!reason) {
      setRejectError("Informe o motivo da rejeição.");
      return;
    }

    const ok = await handleStatusChange("reject", reason);

    //closes the modal only if the rejection was successful
    if (ok) setShowRejectModal(false);
  }

  async function confirmPendingAction() {
    if (!pendingAction) return;
    await handleStatusChange(pendingAction);
    // Always close it: if an error occurred, a red alert appears at the top of the page
    setPendingAction(null);
  }

  return (
    <div>
      {/* Error alert (aprove, reject, sent) */}
      {actionError ? (
        <div className="mb-4 no-print">
          <Alert tone="error">{actionError}</Alert>
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => router.push("/orcamentos")}
            className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-tp-text-body hover:text-tp-text-main no-print"
          >
            <Icon name="back" size={16} />
            Orçamentos
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <h1
              className="text-xl font-semibold tracking-tight text-tp-text-main"
              title={quote.id}
            >
              {quote.id.slice(0, 8).toUpperCase()}
            </h1>
            <Badge tone={meta.badgeTone}>{meta.label}</Badge>
          </div>
          <p className="mt-1 text-sm text-tp-text-muted">{quote.clientName}</p>
        </div>

        {/* Grupo de Ações do Orçamento (Exportar PDF, Editar e Alterar Status) */}
        <div className="flex flex-wrap items-center gap-2 no-print">
          <Button variant="secondary" onClick={() => window.print()}>
            <Icon name="paperclip" size={16} />
            Exportar PDF
          </Button>

          {isQuoteOpen(quote.status) ? (
            <Button
              variant="secondary"
              onClick={() => {
                setSuccessMessage("");
                setShowEditModal(true);
              }}
            >
              Editar orçamento
            </Button>
          ) : null}

          {quote.status === "DRAFT" ? (
            <Button
              variant="primary"
              isLoading={isActionLoading}
              onClick={() => setPendingAction("send")}
            >
              Marcar como Enviado
            </Button>
          ) : null}

          {quote.status === "SENT" ? (
            <>
              <Button
                variant="primary"
                isLoading={isActionLoading}
                onClick={() => setPendingAction("approve")}
              >
                Aprovar
              </Button>
              <Button
              variant="secondary"
              isLoading={isActionLoading}
              onClick={() => {
                setRejectReason(""); // clears the field of a previous rejection
                setRejectError(""); // clears any old errors
                setShowRejectModal(true); // opens the modal
              }}
            >
              Rejeitar
            </Button>
            </>
          ) : null}
        </div>
      </div>

      {successMessage ? (
        <div className="mb-6 no-print">
          <Alert tone="success">{successMessage}</Alert>
        </div>
      ) : null}

      <QuoteFormModal
        open={showEditModal}
        mode="edit"
        quote={quote}
        clients={[{ id: quote.clientId, name: quote.clientName }]}
        fallbackClientName={quote.clientName}
        onClose={() => setShowEditModal(false)}
        onSaved={(saved) => {
          setQuote(saved);
          setShowEditModal(false);
          setSuccessMessage("Orçamento atualizado.");
        }}
      />

      {/* Rejection Modal */}
      <Modal
        open={showRejectModal}
        title="Rejeitar orçamento"
        onClose={() => setShowRejectModal(false)}
      >
        <div className="flex flex-col gap-4">
          <Field
            id="reject-reason"
            label="Motivo da rejeição"
            value={rejectReason}
            error={rejectError}
            onChange={(e) => {
              setRejectReason(e.target.value);
              setRejectError(""); // some o erro quando a pessoa volta a digitar
            }}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowRejectModal(false)}>
              Cancelar
            </Button>
            <Button variant="primary" isLoading={isActionLoading} onClick={confirmReject}>
              Confirmar rejeição
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirmation of sending/approving */}
      <Modal
        open={pendingAction !== null}
        title={pendingAction ? CONFIRM_COPY[pendingAction].title : ""}
        onClose={() => (isActionLoading ? null : setPendingAction(null))}
        dismissible={!isActionLoading}
      >
        {pendingAction ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-tp-text-body">{CONFIRM_COPY[pendingAction].message}</p>
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                disabled={isActionLoading}
                onClick={() => setPendingAction(null)}
              >
                Cancelar
              </Button>
              <Button variant="primary" isLoading={isActionLoading} onClick={confirmPendingAction}>
                {CONFIRM_COPY[pendingAction].confirmLabel}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold text-tp-text-main">Itens</h2>
            {quote.items.length === 0 ? (
              <p className="text-sm text-tp-text-muted">Nenhum item.</p>
            ) : (
              <div className="tp-table-wrap">
                <table className="tp-table" aria-label="Itens do orçamento">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Descrição</th>
                      <th className="text-right">Qtd.</th>
                      <th className="text-right">Valor unit. (R$)</th>
                      <th className="text-right">Desconto (R$)</th>
                      <th className="text-right">Subtotal (R$)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.items.map((item) => (
                      <tr key={item.id}>
                        <td>{QUOTE_ITEM_TYPE_META[item.type].label}</td>
                        <td>{item.description}</td>
                        <td className="text-right">{formatQuantity(item.quantity)}</td>
                        <td className="text-right">{formatBRL(item.unitPriceCents)}</td>
                        <td className="text-right">
                          {item.discountCents > 0 ? `-${formatBRL(item.discountCents)}` : "-"}
                        </td>
                        <td className="text-right font-semibold text-tp-text-main">
                          {formatBRL(item.subtotalCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {quote.notes ? (
            <Card className="p-6">
              <h2 className="mb-3 text-lg font-semibold text-tp-text-main">Observações</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-tp-text-body">
                {quote.notes}
              </p>
            </Card>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold text-tp-text-main">Resumo</h2>
            <dl className="flex flex-col gap-2 text-sm">
              {hasBothDiscountTypes ? (
                <>
                  <div className="flex justify-between">
                    <dt className="text-tp-text-body">Subtotal bruto</dt>
                    <dd className="font-semibold text-tp-text-main">
                      {formatBRL(grossItemsCents)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-tp-text-body">Descontos nos itens</dt>
                    <dd className="font-semibold text-tp-danger">
                      -{formatBRL(itemDiscountsCents)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-tp-text-body">Subtotal</dt>
                    <dd className="font-semibold text-tp-text-main">
                      {formatBRL(quote.subtotalCents)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-tp-text-body">Desconto geral</dt>
                    <dd className="font-semibold text-tp-danger">
                      -{formatBRL(generalDiscountCents)}
                    </dd>
                  </div>
                  <div className="flex justify-between border-t border-tp-border-light pt-2">
                    <dt className="text-tp-text-body">Descontos totais</dt>
                    <dd className="font-semibold text-tp-danger">
                      -{formatBRL(totalDiscountsCents)}
                    </dd>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between">
                    <dt className="text-tp-text-body">
                      {itemDiscountsCents > 0 ? "Subtotal bruto" : "Subtotal"}
                    </dt>
                    <dd className="font-semibold text-tp-text-main">
                      {formatBRL(itemDiscountsCents > 0 ? grossItemsCents : quote.subtotalCents)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-tp-text-body">Descontos</dt>
                    <dd className="font-semibold text-tp-danger">
                      {totalDiscountsCents > 0
                        ? `-${formatBRL(totalDiscountsCents)}`
                        : formatBRL(0)}
                    </dd>
                  </div>
                </>
              )}
              <div className="mt-1 flex justify-between border-t border-tp-border-light pt-3 text-base">
                <dt className="font-bold text-tp-text-main">Total</dt>
                <dd className="font-bold text-tp-green-600">{formatBRL(quote.totalCents)}</dd>
              </div>
            </dl>
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold text-tp-text-main">Histórico</h2>
            <dl className="flex flex-col gap-3 text-sm">
              <div>
                <dt className="text-tp-text-muted">Criado em</dt>
                <dd className="font-medium text-tp-text-main">
                  {formatDateTime(quote.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="text-tp-text-muted">Enviado em</dt>
                <dd className="font-medium text-tp-text-main">{formatDateTime(quote.sentAt)}</dd>
              </div>
              {quote.status === "DRAFT" ? (
                <div>
                  <dt className="text-tp-text-muted">Situação</dt>
                  <dd className="font-medium text-tp-text-main">Rascunho em elaboração.</dd>
                </div>
              ) : null}
              {quote.decidedAt ? (
                <>
                  <div>
                    <dt className="text-tp-text-muted">Decidido em</dt>
                    <dd className="font-medium text-tp-text-main">
                      {formatDateTime(quote.decidedAt)}
                    </dd>
                  </div>
                  {quote.decisionNotes ? (
                    <div>
                      <dt className="text-tp-text-muted">Observação da decisão</dt>
                      <dd className="font-medium text-tp-text-main">{quote.decisionNotes}</dd>
                    </div>
                  ) : null}
                  {quote.decisionEvidenceUrl ? (
                    <div>
                      <dt className="text-tp-text-muted">Evidência</dt>
                      <dd className="inline-flex items-center gap-1.5 font-medium text-tp-blue-900">
                        <Icon name="paperclip" size={14} />
                        {quote.decisionEvidenceUrl}
                      </dd>
                    </div>
                  ) : null}
                </>
              ) : null}
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
