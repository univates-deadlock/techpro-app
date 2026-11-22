/**
 * Minimal format structure checks: reject spoofed headers and truncated files
 * before sending their bytes to the private object store.
 *
 * This is not a PDF renderer or full image decoder. Keep the upload private
 * and never execute, unpack or embed user-provided file content.
 */
export type EvidenceMime = "application/pdf" | "image/png" | "image/jpeg";

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const pngEnd = Buffer.from([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);

export function isValidEvidenceContent(bytes: unknown, type: EvidenceMime): bytes is Buffer {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > 10 * 1024 * 1024) {
    return false;
  }

  switch (type) {
    case "application/pdf": {
      if (bytes.length < 16 || bytes.subarray(0, 5).toString("ascii") !== "%PDF-") return false;
      // The EOF marker must exist at the end (allow trailing whitespace).
      const tail = bytes.subarray(Math.max(0, bytes.length - 2048)).toString("latin1").trimEnd();
      return tail.endsWith("%%EOF");
    }
    case "image/jpeg":
      return bytes.length > 10 &&
        bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff &&
        bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
    case "image/png":
      return bytes.length >= 45 &&
        bytes.subarray(0, 8).equals(pngSignature) &&
        bytes.readUInt32BE(8) === 13 &&
        bytes.toString("ascii", 12, 16) === "IHDR" &&
        bytes.readUInt32BE(16) > 0 &&
        bytes.readUInt32BE(20) > 0 &&
        bytes.subarray(-pngEnd.length).equals(pngEnd);
  }
}
