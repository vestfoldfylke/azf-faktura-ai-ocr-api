import type {
  SharePointStatusFailed,
  SharePointStatusFailedNoRetry,
  SharePointStatusFailedWillRetry,
  SharePointStatusQueued,
  SharePointStatusSuccess
} from "../constants.js";

export type CollectionResponse<T> = {
  "@odata.context": string;
  value: T[];
};

export type CsvStatus = typeof SharePointStatusQueued | typeof SharePointStatusFailed | typeof SharePointStatusSuccess;

export type InvoiceStatus =
  | typeof SharePointStatusQueued
  | typeof SharePointStatusFailedWillRetry
  | typeof SharePointStatusFailedNoRetry
  | typeof SharePointStatusSuccess;

export type MarkCsvItemAsHandledRequest = {
  HandledAt: string;
  Status: CsvStatus;
  Download?: {
    Description: string;
    Url: string;
  };
  WorkItemCount?: number;
  FindingsCount?: number;
};

export type MarkInvoiceItemAsHandledRequest = {
  HandledAt: string;
  Status: InvoiceStatus;
  HandledCount: number;
  InsertedCount: number;
  InvoiceNumber: string;
  Error?: string;
};

export type SharePointConfig = {
  csvOrder: {
    listId: string;
    siteId: string;
  };
  csvExport: {
    driveId: string;
    listId: string;
    siteId: string;
  };
  invoice: {
    handledErrorThreshold: number;
    listId: string;
    siteId: string;
    unhandledTop: number;
  };
};
