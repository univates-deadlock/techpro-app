"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { QuoteFormModal } from "@/components/orcamentos/QuoteFormModal";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/Modal";
import { formatBRL } from "@/lib/money";
import {
  QUOTE_STATUS_META,
  deleteQuote,
  getQuote,
  isQuoteOpen,
  listQuoteClients,
  listQuotes,
  type Quote,
  type QuoteClientOption,
  type QuoteListItem,
  type QuoteStatus,
} from "@/lib/quotes";

/**
 * Quote list screen: list, search, create, edit and delete draft quotes.
 */

type QuoteStatusFilter = QuoteStatus | "ALL";

const STATUS_FILTERS: { value: QuoteStatusFilter; label: string }[] = [
  { value: "ALL", label: "Todos" },
  { value: "DRAFT", label: "Rascunho" },
  { value: "SENT", label: "Enviada" },
  { value: "APPROVED", label: "Aprovado" },
  { value: "REJECTED", label: "Rejeitado" },
  { value: "EXPIRED", label: "Expirado" },
];

export function OrcamentosPageQuote() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<QuoteListItem[]>([]);
  const [clients, setClients] = useState<QuoteClientOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [editingClientName, setEditingClientName] = useState("");
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailLoadError, setDetailLoadError] = useState("");
  const detailRequestIdRef = useRef(0);

  /* Delete confirmation: only DRAFT quotes can be deleted (API returns 409 otherwise). */
  const [deleteTarget, setDeleteTarget] = useState<QuoteListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<QuoteStatusFilter>("ALL");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      setIsLoading(true);
      setError("");
      try {
        const [quotesData, clientsData] = await Promise.all([
          listQuotes(),
          listQuoteClients().catch(() => [] as QuoteClientOption[]),
        ]);
        if (!active) return;
        setQuotes(quotesData);
        setClients(clientsData);
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
    detailRequestIdRef.current += 1;
    setFormMode("create");
    setEditingQuote(null);
    setEditingClientName("");
    setIsLoadingDetail(false);
    setDetailLoadError("");
    setSuccessMessage("");
    setShowForm(true);
  }

  /** Opens the edit modal and fetches the quote detail with its items. */
  async function openEditForm(quoteRow: QuoteListItem) {
    const requestId = ++detailRequestIdRef.current;
    setFormMode("edit");
    setEditingQuote(null);
    setEditingClientName(quoteRow.clientName);
    setIsLoadingDetail(true);
    setDetailLoadError("");
    setSuccessMessage("");
    setShowForm(true);

    try {
      const detail = await getQuote(quoteRow.id);
      if (detailRequestIdRef.current !== requestId) return;
      if (!detail) {
        setDetailLoadError("Orçamento não encontrado.");
        return;
      }
      setEditingQuote(detail);
    } catch (err) {
      if (detailRequestIdRef.current !== requestId) return;
      setDetailLoadError(
        err instanceof Error ? err.message : "Não foi possível carregar o orçamento.",
      );
    } finally {
      if (detailRequestIdRef.current === requestId) {
        setIsLoadingDetail(false);
      }
    }
  }

  function closeForm() {
    detailRequestIdRef.current += 1;
    setShowForm(false);
    setEditingQuote(null);
    setEditingClientName("");
    setIsLoadingDetail(false);
    setDetailLoadError("");
  }

  function handleSaved() {
    const wasEdit = formMode === "edit";
    closeForm();
    setSuccessMessage(wasEdit ? "Orçamento atualizado." : "Orçamento criado.");
    reload();
  }

  /** Confirms the deletion: calls the API, then reloads the list. */
  async function handleDelete() {
    if (isDeleting || !deleteTarget) return;
    setDeleteError("");
    setIsDeleting(true);
    try {
      await deleteQuote(deleteTarget.id);
      setDeleteTarget(null);
      setSuccessMessage("Orçamento excluído.");
      reload();
    } catch (err) {
      /* 409 = the quote is no longer a draft (or has a decision recorded). */
      setDeleteError(err instanceof Error ? err.message : "Não foi possível excluir o orçamento.");
    } finally {
      setIsDeleting(false);
    }
  }

  const term = searchTerm.trim().toLowerCase();
  const filtered = quotes.filter((quote) => {
    if (statusFilter !== "ALL" && quote.status !== statusFilter) return false;
    if (!term) return true;
    return (
      quote.clientName.toLowerCase().includes(term) ||
      quote.id.toLowerCase().includes(term)
    );
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="mb-1 text-sm font-medium uppercase tracking-[0.15em] text-tp-primary">
            Comercial
          </p>
          <h1 className="text-2xl font-bold text-tp-text-main">Orçamentos</h1>
        </div>
        <Button variant="primary" onClick={() => (showForm ? closeForm() : openCreateForm())}>
          {showForm ? "Cancelar" : "Novo orçamento"}
        </Button>
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

      <QuoteFormModal
        open={showForm}
        mode={formMode}
        quote={editingQuote}
        clients={clients}
        fallbackClientName={editingClientName}
        isLoadingQuote={isLoadingDetail}
        loadError={detailLoadError}
        onClose={closeForm}
        onSaved={handleSaved}
      />

      {/* Delete confirmation: destructive action, so it is explicit. */}
      <Modal
        open={deleteTarget !== null}
        title="Excluir orçamento"
        onClose={() => (isDeleting ? null : setDeleteTarget(null))}
        dismissible={!isDeleting}
      >
        {deleteTarget ? (
          <div className="flex flex-col gap-4">
            {deleteError ? <Alert tone="error">{deleteError}</Alert> : null}
            <p className="text-sm text-tp-text-body">
              Excluir o orçamento de{" "}
              <strong className="text-tp-text-main">{deleteTarget.clientName}</strong>{" "}
              ({deleteTarget.id.slice(0, 8).toUpperCase()})? Os itens são excluídos
              junto e não há como desfazer.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                isLoading={isDeleting}
                loadingLabel="Excluindo…"
                onClick={handleDelete}
              >
                Excluir
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="w-full max-w-xs">
          <label htmlFor="quote-search" className="sr-only">
            Buscar
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tp-text-muted">
              <Icon name="search" size={16} />
            </span>
            <input
              id="quote-search"
              type="search"
              placeholder="Buscar por código ou cliente..."
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

      {isLoading ? (
        <p className="text-tp-text-muted">Carregando orçamentos...</p>
      ) : error ? null : filtered.length === 0 ? (
        <div className="rounded-tp-md border border-dashed border-tp-border bg-white px-5 py-8 text-center text-sm text-tp-text-muted">
          {quotes.length === 0
            ? "Nenhum orçamento cadastrado ainda."
            : "Nenhum orçamento encontrado para a busca ou o filtro aplicado."}
        </div>
      ) : (
        <div className="tp-table-wrap">
          <table className="tp-table" aria-label="Orçamentos">
            <thead>
              <tr>
                <th>Código</th>
                <th>Cliente</th>
                <th className="text-right">Valor Total</th>
                <th>Status</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((quote) => (
                <tr key={quote.id} className="hover:bg-tp-neutral-50">
                  <td className="font-medium text-tp-text-main" title={quote.id}>
                    {quote.id.slice(0, 8).toUpperCase()}
                  </td>
                  <td className="text-tp-text-body">
                    <button
                      type="button"
                      onClick={() => router.push(`/orcamentos/${quote.id}`)}
                      className="font-medium text-tp-text-main hover:underline"
                    >
                      {quote.clientName || "Cliente não informado"}
                    </button>
                  </td>
                  <td className="text-right font-medium text-tp-text-main">
                    {formatBRL(quote.totalCents)}
                  </td>
                  <td>
                    <Badge tone={QUOTE_STATUS_META[quote.status].badgeTone}>
                      {QUOTE_STATUS_META[quote.status].label}
                    </Badge>
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => router.push(`/orcamentos/${quote.id}`)}
                      >
                        Visualizar
                      </Button>
                      {isQuoteOpen(quote.status) ? (
                        <Button variant="ghost" onClick={() => openEditForm(quote)}>
                          Editar
                        </Button>
                      ) : null}
                      {quote.status === "DRAFT" ? (
                        <Button variant="ghost" onClick={() => setDeleteTarget(quote)}>
                          Excluir
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
