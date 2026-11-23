/**
 * Date helpers for the services and visits screens.
 *
 * Forms use native `datetime-local` and `date` inputs, while the API contract
 * (see api/src/schemas/service.schema.ts on branch feat/api-services) expects
 * ISO 8601 strings. These helpers convert between the two and format
 * agenda-specific values. Generic date formatting (formatDate/formatDateTime)
 * lives in lib/money.ts alongside the other shared display helpers.
 */

/** Pads a number to two digits ("9" -> "09"). */
const pad = (value: number) => String(value).padStart(2, "0");

/** "2026-11-20T17:30:00.000Z" -> "2026-11-20T14:30" (browser local time). */
export function toDatetimeLocal(isoString: string | null | undefined): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** "2026-11-20T14:30" -> "2026-11-20T17:30:00.000Z" (ISO 8601). */
export function fromDatetimeLocal(value: string): string {
  return new Date(value).toISOString();
}

/** Blank datetime-local value -> null, filled value -> ISO (optional fields). */
export function optionalDatetimeLocal(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? fromDatetimeLocal(trimmed) : null;
}

/** "2026-11-20" -> ISO start of that local day (agenda "from" filter). */
export function fromDateInput(value: string): string {
  return new Date(`${value}T00:00`).toISOString();
}

/** "2026-11-20" -> ISO end of that local day (agenda "to" filter). */
export function toDateInput(value: string): string {
  return new Date(`${value}T23:59:59.999`).toISOString();
}

/** Formats only the time of an ISO string ("14:30"). */
export function formatTime(isoString: string | null | undefined): string {
  if (!isoString) return "-";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "-";
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Local-day key used to group the agenda by date ("2026-11-20"). */
export function dayKey(isoString: string): string {
  const date = new Date(isoString);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Section label for an agenda day: "Hoje", "Amanhã" or "sex., 20 de nov.". */
export function formatDayLabel(isoString: string): string {
  const date = new Date(isoString);
  const today = new Date();
  const diffDays = Math.round(
    (new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      86_400_000,
  );
  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Amanhã";
  if (diffDays === -1) return "Ontem";
  return date.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
