import type { WorkItemMongo } from "./zod-mongo";
import type { Invoice } from "./zod-ocr";

export type BlobStorageInfo = {
  connectionString: string;
  containerName: string;
  failedFolderName: string;
  finishedFolderName: string;
  queueFolderName: string;
};

export type CsvItem = Omit<
  WorkItemMongo,
  "department" | "extras" | "id" | "insertedDate" | "pdfChunk" | "pdfChunkPageNumber" | "pdfOriginalPageNumber"
> & {
  entryId: number;
};

export type ProblematicCsvItem = Omit<CsvItem, "fromDateTime" | "toDateTime"> & {
  reason: string;
};

export type ProcessedInvoice = {
  alreadyProcessed: boolean;
  invoiceNumber: string | null;
  parsedInvoiceChunks: (Invoice | null)[];
  processedSuccessfully: boolean;
};
