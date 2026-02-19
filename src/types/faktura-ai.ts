import type { WorkMongoItem } from "./zod-mongo.js";
import type { Invoice, WorkItemList } from "./zod-ocr.js";

export type BlobStorageInfo = {
  connectionString: string;
  containerName: string;
  failedFolderName: string;
  finishedFolderName: string;
  queueFolderName: string;
};

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
  parsedInvoiceChunks: (Invoice | null)[];
  processedSuccessfully: boolean;
};
