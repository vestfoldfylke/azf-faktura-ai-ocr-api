import type { Invoice, WorkItemList } from "./ai/zod-ocr.js";
import type { WorkMongoItem } from "./zod-mongo.js";

export type CsvItem = Omit<
  WorkMongoItem,
  "department" | "extras" | "id" | "insertedDate" | "pdfChunk" | "pdfChunkPageNumber" | "pdfOriginalPageNumber"
> & {
  entryId: number;
};

export type ItemsToInsert = {
  workItemList: WorkItemList;
  workMongoItemList: WorkMongoItem[];
  failedWorkItemIds: number[];
  chunkIndex: number;
};

export type ProblematicCsvItem = Omit<CsvItem, "fromDateTime" | "toDateTime"> & {
  reason: string;
};

export type ProcessedInvoice = {
  alreadyProcessed: boolean;
  invoiceNumber: string | null;
  insertedWorkItemCount: number;
  parsedInvoiceChunks: (Invoice | null)[];
  processedSuccessfully: boolean;
};
