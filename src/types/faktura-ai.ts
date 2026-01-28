import type { Invoice } from "./zod-ocr";

export type BlobStorageInfo = {
  connectionString: string;
  containerName: string;
  failedFolderName: string;
  finishedFolderName: string;
  queueFolderName: string;
};

export type ProcessedInvoice = {
  alreadyProcessed: boolean;
  invoiceNumber: string | null;
  parsedInvoiceChunks: (Invoice | null)[];
  processedSuccessfully: boolean;
};
