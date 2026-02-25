import type { SharePointConfig } from "./types/sharepoint.js";

export const getMistralApiKey = (): string => {
  const apiKey = process.env.MISTRAL_API_KEY;

  if (!apiKey) {
    throw new Error("MISTRAL_API_KEY is not set in environment variables");
  }

  return apiKey;
};

/**
 * Get the maximum number of pages per chunk for OCR processing.<br />
 * Defaults to 4 if not set, invalid or greater than 8.
 */
export const getMaxPagesPerChunk = (): number => {
  const maxPages: number | undefined = process.env.MISTRAL_MAX_PAGES_PER_CHUNK ? parseInt(process.env.MISTRAL_MAX_PAGES_PER_CHUNK, 10) : undefined;

  return Number.isInteger(maxPages) && maxPages > 0 && maxPages <= 8 ? maxPages : 4;
};

export const getMongoDbConnectionString = (): string => {
  const connectionString = process.env.MONGODB_CONNECTION_STRING;

  if (!connectionString) {
    throw new Error("MONGODB_CONNECTION_STRING is not set in environment variables");
  }

  return connectionString;
};

export const getMongoDbCollectionName = (): string => {
  const collectionName = process.env.MONGODB_COLLECTION_NAME;

  if (!collectionName) {
    throw new Error("MONGODB_COLLECTION_NAME is not set in environment variables");
  }

  return collectionName;
};

export const getMongoDbDatabaseName = (): string => {
  const databaseName = process.env.MONGODB_DATABASE_NAME;

  if (!databaseName) {
    throw new Error("MONGODB_DATABASE_NAME is not set in environment variables");
  }

  return databaseName;
};

export const getSharePointConfig = (): SharePointConfig => {
  const siteId: string = process.env.SP_SITE_ID;
  const listId: string = process.env.SP_LIST_ID;
  const handledErrorThreshold: number = parseInt(process.env.SP_HANDLED_ERROR_THRESHOLD ?? "3", 10);
  const unhandledTop: number = parseInt(process.env.SP_LIST_UNHANDLED_TOP ?? "3", 10);

  if (!siteId) {
    throw new Error("SP_SITE_ID is not set in environment variables");
  }

  if (!listId) {
    throw new Error("SP_LIST_ID is not set in environment variables");
  }

  if (!Number.isInteger(handledErrorThreshold) || handledErrorThreshold < 1) {
    throw new Error("SP_HANDLED_ERROR_THRESHOLD must be a positive integer");
  }

  if (!Number.isInteger(unhandledTop) || unhandledTop < 1) {
    throw new Error("SP_LIST_UNHANDLED_TOP must be a positive integer");
  }

  return {
    handledErrorThreshold,
    listId,
    siteId,
    unhandledTop
  };
};

/**
 * Determine whether to process invoices that have already been processed for OCR.<br />
 * Requires that blob name has invoice number in the name followed by a `_` (Example: `1234567_` or `1234567_something..`). Otherwise, it needs to be OCR processed to find the invoice number anyway.<br />
 * Defaults to false if not set.
 */
export const processAlreadyProcessedInvoices = (): boolean => process.env.OCR_PROCESS_ALREADY_PROCESSED_FILES?.toLowerCase() === "true";
