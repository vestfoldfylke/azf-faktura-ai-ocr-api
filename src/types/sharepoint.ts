import type {
  SharePointStatusFailedNoRetry,
  SharePointStatusFailedWillRetry,
  SharePointStatusQueued,
  SharePointStatusSuccess
} from "../constants.js";

export type CollectionResponse<T> = {
  "@odata.context": string;
  value: T[];
};

export type Status =
  | typeof SharePointStatusQueued
  | typeof SharePointStatusFailedWillRetry
  | typeof SharePointStatusFailedNoRetry
  | typeof SharePointStatusSuccess;

export type MarkItemAsHandledRequest = {
  HandledAt: string;
  Status: Status;
  HandledCount: number;
  InsertedCount: number;
  InvoiceNumber: string;
  Error?: string;
};

export type SharePointConfig = {
  handledErrorThreshold: number;
  listId: string;
  siteId: string;
  unhandledTop: number;
};
