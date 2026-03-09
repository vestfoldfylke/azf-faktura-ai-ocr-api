import type { AIVendor } from "./ai/ai-agent.js";
import type { Invoice, WorkItemList } from "./ai/zod-ocr.js";
import type { WorkMongoItem } from "./zod-mongo.js";

export type CsvItem = Omit<
  WorkMongoItem,
  "department" | "extras" | "id" | "insertedDate" | "pdfChunk" | "pdfChunkPageNumber" | "pdfOriginalPageNumber"
> & {
  entryId: number;
};

export type CsvResponse = {
  csvContent?: string;
  csvName?: string;
  status: number;
};

export type ItemsToInsert = {
  workItemList: WorkItemList;
  workMongoItemList: WorkMongoItem[];
  failedWorkItemIds: number[];
  skippedWorkItemIds: number[];
  chunkIndex: number;
};

export type OcrProcessedResponse = {
  invoice: Invoice | null;
  vendorModel: string;
  vendorName: AIVendor;
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
