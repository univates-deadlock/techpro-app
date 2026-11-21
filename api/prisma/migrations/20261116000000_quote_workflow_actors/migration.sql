ALTER TABLE "quote" ADD COLUMN "sent_by" TEXT,
ADD COLUMN "decided_by" TEXT;

ALTER TABLE "quote" ADD CONSTRAINT "quote_sent_by_fkey"
FOREIGN KEY ("sent_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "quote" ADD CONSTRAINT "quote_decided_by_fkey"
FOREIGN KEY ("decided_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
