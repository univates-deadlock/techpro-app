"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatBRL, formatDate } from "@/lib/money";
import { getOperationalDashboard, type OperationalDashboard } from "@/lib/operational";
import {
  QUOTE_STATUS_META,
  listQuotes,
  type QuoteListItem,
  type QuoteStatus,
} from "@/lib/quotes";

/**
 * Operational home for ADMIN and PLANNING: what needs attention, not shortcuts.
 *
 * Quote cards use GET /api/quotes; operational indicators use GET /api/dashboard.
 * Both sources require an authenticated ADMIN or PLANNING session.
 */
export function DashboardQuotesView() {
  const [quotes, setQuotes] = useState<QuoteListItem[] | null>(null);
  const [error, setError] = useState("");
  const [operations, setOperations] = useState<OperationalDashboard | null>(null);
  const [operationsError, setOperationsError] = useState("");

  useEffect(() => {
    let active = true;
    listQuotes()
      .then((data) => {
        if (active) setQuotes(data);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Não foi possível carregar os orçamentos.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    getOperationalDashboard()
      .then((data) => { if (active) setOperations(data); })
      .catch((err: unknown) => {
        if (active) setOperationsError(
          err instanceof Error ? err.message : "Não foi possível carregar os indicadores.",
        );
      });
    return () => { active = false; };
  }, []);

  const all = quotes ?? [];
  const pending = all.filter(
    (quote) => quote.status === "SENT" || quote.status === "DRAFT",
  );
  const sent = all.filter((quote) => quote.status === "SENT");
  const drafts = all.filter((quote) => quote.status === "DRAFT");

  const totalOpenCents = pending.reduce((sum, quote) => sum + quote.totalCents, 0);

  const countsByStatus = all.reduce<Record<string, number>>((acc, quote) => {
    acc[quote.status] = (acc[quote.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <PageHeader title="Visão geral" />

      {error ? (
        <div className="mb-6">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      {/* Indicators row: derived from the same quote data as the list. */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-tp-text-muted">
            Em aberto
          </p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-tp-text-main">
            {quotes === null ? "—" : pending.length}
          </p>
          <p className="mt-1 text-xs text-tp-text-muted">rascunhos e enviados</p>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-tp-text-muted">
            Aguardando decisão
          </p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-tp-text-main">
            {quotes === null ? "—" : sent.length}
          </p>
          <p className="mt-1 text-xs text-tp-text-muted">orçamentos enviados</p>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-tp-text-muted">
            Rascunhos
          </p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-tp-text-main">
            {quotes === null ? "—" : drafts.length}
          </p>
          <p className="mt-1 text-xs text-tp-text-muted">em elaboração</p>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-tp-text-muted">
            Valor em aberto
          </p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-tp-green-600">
            {quotes === null ? "—" : formatBRL(totalOpenCents)}
          </p>
          <p className="mt-1 text-xs text-tp-text-muted">soma dos orçamentos abertos</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-0 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-tp-border-light px-5 py-4">
            <h2 className="text-sm font-semibold text-tp-text-main">
              Orçamentos em aberto
            </h2>
            <Link
              href="/orcamentos"
              className="text-xs font-semibold text-tp-blue-900 hover:underline"
            >
              Ver todos
            </Link>
          </div>

          {error ? null : quotes === null ? (
            <p className="px-5 py-8 text-sm text-tp-text-muted">Carregando…</p>
          ) : pending.length === 0 ? (
            <p className="px-5 py-8 text-sm text-tp-text-muted">
              Nenhum orçamento em aberto.
            </p>
          ) : (
            <ul className="divide-y divide-tp-border-light text-sm">
              {pending.map((quote) => (
                <li
                  key={quote.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 transition-colors hover:bg-tp-neutral-50"
                >
                  <Link
                    href={`/orcamentos/${quote.id}`}
                    className="flex min-w-0 flex-col"
                  >
                    <span className="truncate font-semibold text-tp-text-main hover:underline">
                      {quote.clientName}
                    </span>
                    <span className="mt-0.5 text-xs text-tp-text-muted">
                      {quote.id.slice(0, 8).toUpperCase()} · {quote.itemCount}{" "}
                      {quote.itemCount === 1 ? "item" : "itens"}
                    </span>
                  </Link>
                  <span className="flex shrink-0 items-center gap-4">
                    <span className="hidden text-xs text-tp-text-muted sm:inline">
                      {quote.sentAt ? `enviado ${formatDate(quote.sentAt)}` : "não enviado"}
                    </span>
                    <span className="font-semibold tabular-nums text-tp-text-main">
                      {formatBRL(quote.totalCents)}
                    </span>
                    <Badge tone={QUOTE_STATUS_META[quote.status].badgeTone}>
                      {QUOTE_STATUS_META[quote.status].label}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="flex min-w-0 flex-col gap-6">
          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-tp-text-main">
              Situação dos orçamentos
            </h2>
            {quotes === null ? (
              <p className="py-2.5 text-sm text-tp-text-muted">Carregando…</p>
            ) : (
              <dl className="flex flex-col gap-2.5 text-sm">
                {(
                  ["DRAFT", "SENT", "APPROVED", "REJECTED", "EXPIRED"] as QuoteStatus[]
                ).map((status) => (
                  <div key={status} className="flex items-center justify-between">
                    <dt className="flex items-center gap-2 text-tp-text-body">
                      <Badge tone={QUOTE_STATUS_META[status].badgeTone}>
                        {QUOTE_STATUS_META[status].label}
                      </Badge>
                    </dt>
                    <dd className="font-bold tabular-nums text-tp-text-main">
                      {countsByStatus[status] ?? 0}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </Card>

          {operationsError ? <Alert tone="error">{operationsError}</Alert> : null}
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-tp-text-main">
                Próximos serviços e visitas
              </h2>
              <Link href="/servicos" className="text-xs font-semibold text-tp-blue-900 hover:underline">
                Ver serviços
              </Link>
            </div>
            {operations === null ? (
              <p className="text-sm text-tp-text-muted">{operationsError || "Carregando…"}</p>
            ) : (
              <>
                <p className="mb-3 text-sm text-tp-text-body">
                  <strong>{operations.services.upcoming.count}</strong> serviços e{" "}
                  <strong>{operations.visits.upcoming.count}</strong> visitas nos próximos{" "}
                  {operations.window.days} dias.
                </p>
                <ul className="space-y-2 text-sm">
                  {operations.services.upcoming.items.slice(0, 4).map((service) => (
                    <li key={service.id} className="flex justify-between gap-2 border-t border-tp-border-light pt-2">
                      <span className="min-w-0 truncate text-tp-text-body">
                        {service.client.name} · {service.title}
                      </span>
                      <span className="shrink-0 text-xs text-tp-text-muted">
                        {formatDate(service.plannedStart)}
                      </span>
                    </li>
                  ))}
                </ul>
                {operations.services.upcoming.count === 0 && operations.visits.upcoming.count === 0 ? (
                  <p className="text-xs text-tp-text-muted">Nenhum atendimento próximo.</p>
                ) : null}
              </>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-tp-text-main">
              Revisões e garantias
            </h2>
            {operations === null ? (
              <p className="text-sm text-tp-text-muted">{operationsError || "Carregando…"}</p>
            ) : (
              <dl className="space-y-3 text-sm">
                {([
                  ["Revisões atrasadas", operations.alerts.revisions.overdue.count, "/revisoes"],
                  ["Revisões próximas", operations.alerts.revisions.upcoming.count, "/revisoes"],
                  ["Garantias vencidas", operations.alerts.warranties.expired.count, "/garantias"],
                  ["Garantias próximas do fim", operations.alerts.warranties.expiring.count, "/garantias"],
                ] as const).map(([label, count, href]) => (
                  <div key={label} className="flex items-center justify-between gap-3">
                    <dt>
                      <Link href={href} className="text-tp-text-body hover:underline">{label}</Link>
                    </dt>
                    <dd className="font-bold tabular-nums text-tp-text-main">{count}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
