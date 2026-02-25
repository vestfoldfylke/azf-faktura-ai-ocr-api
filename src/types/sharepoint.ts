export type CollectionResponse<T> = {
  "@odata.context": string;
  value: T[];
};

export type HandledType = "NotHandled" | "Success" | "Error";

export type MarkItemAsHandledRequest = {
  HandledAt: string;
  HandledType: HandledType;
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
