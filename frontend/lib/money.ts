/**
 * Currency and date helpers for quote screens.
 *
 * Money is handled in integer cents end to end (never floating point) and
 * only formatted for display. The API stores the Decimal columns with two
 * decimal places; lib/quotes.ts converts them to cents at the boundary.
 */

/** Formats integer cents as Brazilian currency ("1.234,56"). */
export function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((cents ?? 0) / 100);
}

/**
 * Parses typed text into cents. Accepts "1.234,56", "1234,56", "1234.56",
 * "1.500", "R$ 12" — rejects negative numbers, letters, malformed separators,
 * or more than 2 decimal places by returning null.
 */
export function parseMoneyToCents(text: string): number | null {
  const stripped = (text ?? "").trim().replace(/^R\$\s*/i, "").trim();
  if (!stripped) return null;
  if (!/^[0-9.,]+$/.test(stripped) || !/\d/.test(stripped)) return null;

  const hasComma = stripped.includes(",");
  const hasDot = stripped.includes(".");

  let wholeDigits = "";
  let decimalDigits = "";

  if (hasComma && hasDot) {
    const lastComma = stripped.lastIndexOf(",");
    const lastDot = stripped.lastIndexOf(".");
    if (lastComma > lastDot) {
      // pt-BR: "1.234,56"
      const parts = stripped.split(",");
      if (parts.length !== 2) return null;
      if (!/^\d{1,3}(\.\d{3})*$/.test(parts[0])) return null;
      if (!/^\d{1,2}$/.test(parts[1])) return null;
      wholeDigits = parts[0].replace(/\./g, "");
      decimalDigits = parts[1];
    } else {
      // en-US: "1,234.56"
      const parts = stripped.split(".");
      if (parts.length !== 2) return null;
      if (!/^\d{1,3}(,\d{3})*$/.test(parts[0])) return null;
      if (!/^\d{1,2}$/.test(parts[1])) return null;
      wholeDigits = parts[0].replace(/,/g, "");
      decimalDigits = parts[1];
    }
  } else if (hasComma) {
    const parts = stripped.split(",");
    if (parts.length !== 2) return null;
    if (!/^\d*$/.test(parts[0]) || !/^\d{0,2}$/.test(parts[1])) return null;
    wholeDigits = parts[0];
    decimalDigits = parts[1];
  } else if (hasDot) {
    const parts = stripped.split(".");
    if (parts.length > 2) {
      // Multiple dots: valid only as thousands separators ("1.000.000")
      if (!/^\d{1,3}(\.\d{3})+$/.test(stripped)) return null;
      wholeDigits = stripped.replace(/\./g, "");
    } else if (/^[1-9]\d{0,2}\.\d{3}$/.test(stripped)) {
      // Single dot with 3 digits after non-zero leading group ("1.500" -> R$ 1.500,00)
      wholeDigits = parts[0] + parts[1];
    } else {
      if (!/^\d*$/.test(parts[0]) || !/^\d{0,2}$/.test(parts[1])) return null;
      wholeDigits = parts[0];
      decimalDigits = parts[1];
    }
  } else {
    wholeDigits = stripped;
  }

  const whole = Number.parseInt(wholeDigits || "0", 10);
  const decimals = Number.parseInt((decimalDigits + "00").slice(0, 2), 10);
  if (!Number.isSafeInteger(whole * 100 + decimals)) return null;
  return whole * 100 + decimals;
}

/** Formats integer cents for a plain text money field ("0" or "250,50"). */
export function formatCentsForInput(cents: number): string {
  if (!cents) return "0";
  return (cents / 100).toFixed(2).replace(".", ",");
}

/**
 * Formats cents for a money input: thousands separated with dots and up to
 * two decimal places after a comma ("12.345,67"). Empty text stays empty.
 */
export function maskMoney(cents: number | null): string {
  if (cents === null || Number.isNaN(cents)) return "";
  const whole = Math.trunc(Math.abs(cents) / 100);
  const decimals = Math.abs(cents) % 100;
  const wholeFmt = whole.toLocaleString("pt-BR");
  return `${wholeFmt},${String(decimals).padStart(2, "0")}`;
}

/** Formats a quantity (up to 2 decimal places, pt-BR) for display. */
export function formatQuantity(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Formats "2026-03-01T10:00:00.000Z" style dates as "01/03/2026". */
export function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return "-";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Same as formatDate but includes the time ("01/03/2026 10:04"). */
export function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return "-";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Formats date-only values ("2026-12-01" or "2026-12-01T00:00:00.000Z") as "01/12/2026". Never builds a Date, so no timezone shifts the day. */
export function formatDateOnly(value: string | null | undefined): string {
  if (!value) return "-";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return "-";
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

/** Whole days from today (local calendar) to a date-only value. Negative = already past. */
export function daysUntilDateOnly(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const target = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86_400_000);
}