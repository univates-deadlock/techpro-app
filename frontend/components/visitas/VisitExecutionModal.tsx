"use client";

import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { formatDateTime } from "@/lib/money";
import { recordVisitCompletion, type Visit } from "@/lib/visits-data";

/**
 * Visit conclusion form (TECHNICIAN, RF16).
 *
 * Registers the real end (now) plus managerial notes without replacing the
 * official external OS data. The real start, when present, is displayed for
 * reference. Payload: PATCH /api/visits/:id/execution (see lib/visits-data.ts).
 */
export function VisitExecutionModal({
  open,
  visit,
  onClose,
  onSaved,
}: {
  open: boolean;
  visit: Visit | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  /* The parent mounts this component only while the modal is open, so the
     initializer below loads the current notes without an effect. */
  const [notes, setNotes] = useState(() => visit?.notes ?? "");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isSubmitting || !visit) return;
    setIsSubmitting(true);
    setFormError("");
    try {
      await recordVisitCompletion(
        visit.id,
        notes.trim() ? notes.trim() : null,
      );
      onSaved("Conclusão da visita registrada.");
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Não foi possível registrar a conclusão.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Registrar conclusão da visita"
      onClose={onClose}
      dismissible={!isSubmitting}
    >
      {visit ? (
        <form onSubmit={handleSubmit} noValidate>
          {formError ? (
            <div className="mb-4">
              <Alert tone="error">{formError}</Alert>
            </div>
          ) : null}

          <div className="mb-4 flex flex-col gap-1 rounded-tp-sm bg-tp-neutral-50 px-4 py-3 text-sm text-tp-text-body">
            <p>
              <span className="font-semibold">Serviço:</span> {visit.service.title}
            </p>
            <p>
              <span className="font-semibold">Cliente:</span>{" "}
              {visit.service.client.name} — {visit.service.client.location}
            </p>
            <p>
              <span className="font-semibold">Previsto:</span>{" "}
              {formatDateTime(visit.scheduledStart)}
              {visit.scheduledEnd
                ? ` – ${formatDateTime(visit.scheduledEnd)}`
                : ""}
            </p>
            <p>
              <span className="font-semibold">Início real:</span>{" "}
              {visit.actualStart ? formatDateTime(visit.actualStart) : "-"}
            </p>
          </div>

          <label
            htmlFor="visit-completion-notes"
            className="mb-1.5 block text-sm font-semibold text-tp-text-main"
          >
            Observações gerenciais
          </label>
          <textarea
            id="visit-completion-notes"
            rows={4}
            value={notes}
            disabled={isSubmitting}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Registros da execução, pendências, materiais utilizados…"
            className="w-full rounded-tp-sm border border-tp-border bg-white px-3 py-2.5 text-base text-tp-text-main focus:outline-none focus:border-tp-primary disabled:bg-tp-neutral-100"
          />
          <p className="mt-1.5 text-sm text-tp-text-muted">
            O fim real será registrado como o horário atual. As observações
            complementam a OS oficial, sem substituí-la (RF16).
          </p>

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSubmitting} loadingLabel="Registrando…">
              Confirmar conclusão
            </Button>
          </div>
        </form>
      ) : null}
    </Modal>
  );
}
