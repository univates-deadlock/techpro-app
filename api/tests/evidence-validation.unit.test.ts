import { describe, expect, it } from "vitest";
import { isValidEvidenceContent } from "../src/utils/evidenceValidation.js";

describe("Evidence file validation", () => {
  const pdf = Buffer.from("%PDF-1.7\n1 0 obj\nendobj\n%%EOF\n");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mP4//8/AAX+Av4zEpUUAAAAAElFTkSuQmCC",
    "base64",
  );
  const jpeg = Buffer.from(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/ALMAD//Z",
    "base64",
  );

  it("accepts representative PDF, PNG and JPEG buffers", () => {
    expect(isValidEvidenceContent(pdf, "application/pdf")).toBe(true);
    expect(isValidEvidenceContent(png, "image/png")).toBe(true);
    expect(isValidEvidenceContent(jpeg, "image/jpeg")).toBe(true);
  });

  it("rejects mismatched, truncated and oversized file bodies", () => {
    expect(isValidEvidenceContent(pdf, "image/png")).toBe(false);
    expect(isValidEvidenceContent(pdf.subarray(0, -6), "application/pdf")).toBe(false);
    expect(isValidEvidenceContent(png.subarray(0, -12), "image/png")).toBe(false);
    expect(isValidEvidenceContent(jpeg.subarray(0, -2), "image/jpeg")).toBe(false);
    expect(isValidEvidenceContent(Buffer.alloc(10 * 1024 * 1024 + 1), "application/pdf")).toBe(false);
  });
});
