const storedFilename = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|png|jpg)$/;

/** Keep S3 keys private to the API and expose only authenticated HTTP paths. */
export function evidenceDownloadUrl(quoteId: string, objectKey: string | null) {
  if (!objectKey) return null;
  const prefix = "quotes/" + quoteId + "/";
  if (!objectKey.startsWith(prefix)) return null;
  const filename = objectKey.slice(prefix.length);
  if (!storedFilename.test(filename)) return null;
  return "/api/quotes/" + quoteId + "/evidence/" + filename;
}

export function asPublicQuote<T extends { id: string; decisionEvidenceUrl: string | null }>(quote: T): T {
  return {
    ...quote,
    decisionEvidenceUrl: evidenceDownloadUrl(quote.id, quote.decisionEvidenceUrl),
  };
}
