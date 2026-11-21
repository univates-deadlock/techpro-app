const TIME_ZONE = "America/Sao_Paulo";
const dateFormat = new Intl.DateTimeFormat("sv-SE", {
  timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
});
const offsetFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE, timeZoneName: "longOffset",
});

// Return the UTC instant of midnight in the business timezone. Use the zone's
// actual offset, not a machine-local date or a permanently hard-coded UTC-3.
function businessMidnight(year: number, month: number, day: number): Date {
  const noon = new Date(Date.UTC(year, month - 1, day, 12));
  const name = offsetFormat.formatToParts(noon).find((part) => part.type === "timeZoneName")?.value;
  const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(name ?? "");
  if (!match) throw new Error("Não foi possível determinar o fuso horário do negócio");
  const sign = match[1] === "+" ? 1 : -1;
  const minutes = sign * (Number(match[2]) * 60 + Number(match[3]));
  return new Date(Date.UTC(year, month - 1, day) - minutes * 60_000);
}

export function businessWindow(now: Date, days: number) {
  const day = dateFormat.format(now);
  const [year, month, date] = day.split("-").map(Number);
  return {
    days,
    timeZone: TIME_ZONE,
    start: businessMidnight(year, month, date),
    endExclusive: businessMidnight(year, month, date + days),
  };
}

