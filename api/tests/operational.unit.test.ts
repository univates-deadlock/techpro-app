import { describe, expect, it } from "vitest";
import { businessWindow, warrantyDateBounds } from "../src/utils/businessWindow.js";

describe("Business-day alert windows", () => {
  it("uses the Sao Paulo calendar instead of UTC day boundaries", () => {
    const beforeMidnight = businessWindow(new Date("2026-11-21T02:59:59Z"), 14);
    const afterMidnight = businessWindow(new Date("2026-11-21T03:00:01Z"), 14);
    expect(beforeMidnight.start.toISOString()).toBe("2026-11-20T03:00:00.000Z");
    expect(afterMidnight.start.toISOString()).toBe("2026-11-21T03:00:00.000Z");
    expect(afterMidnight.endExclusive.toISOString()).toBe("2026-12-05T03:00:00.000Z");
    expect(afterMidnight.timeZone).toBe("America/Sao_Paulo");
  });

  it("treats a warranty ending today as expiring, not already expired", () => {
    const window = businessWindow(new Date("2026-11-21T14:00:00Z"), 14);
    const dates = warrantyDateBounds(window);
    expect(dates.start.toISOString()).toBe("2026-11-21T00:00:00.000Z");
    expect(dates.endExclusive.toISOString()).toBe("2026-12-05T00:00:00.000Z");
  });

  it("crosses month and year boundaries without changing the configured length", () => {
    const window = businessWindow(new Date("2026-12-31T12:00:00Z"), 14);
    expect(window.start.toISOString()).toBe("2026-12-31T03:00:00.000Z");
    expect(window.endExclusive.toISOString()).toBe("2027-01-14T03:00:00.000Z");
  });
});
