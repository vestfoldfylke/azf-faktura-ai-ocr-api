import type { BlobStorageInfo } from "./types/faktura-ai";

export const getBlobStorageInfo = (): BlobStorageInfo => {
  const connectionString: string = process.env.BLOB_STORAGE_CONNECTION_STRING;
  const containerName: string = process.env.BLOB_STORAGE_CONTAINER_NAME;
  const failedFolderName: string = process.env.BLOB_STORAGE_FAILED_FOLDER_NAME;
  const finishedFolderName: string = process.env.BLOB_STORAGE_FINISHED_FOLDER_NAME;
  const queueFolderName: string = process.env.BLOB_STORAGE_QUEUE_FOLDER_NAME;

  if (!connectionString) {
    throw new Error("BLOB_STORAGE_CONNECTION_STRING is not set in environment variables");
  }

  if (!containerName) {
    throw new Error("BLOB_STORAGE_CONTAINER_NAME is not set in environment variables");
  }

  if (!failedFolderName) {
    throw new Error("BLOB_STORAGE_FAILED_FOLDER_NAME is not set in environment variables");
  }

  if (!finishedFolderName) {
    throw new Error("BLOB_STORAGE_FINISHED_FOLDER_NAME is not set in environment variables");
  }

  if (!queueFolderName) {
    throw new Error("BLOB_STORAGE_QUEUE_FOLDER_NAME is not set in environment variables");
  }

  return {
    connectionString,
    containerName,
    failedFolderName,
    finishedFolderName,
    queueFolderName
  };
};

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

/**
 * Determine whether to process invoices that have already been processed for OCR.<br />
 * Requires that blob name has invoice number in the name followed by a `_` (Example: `1234567_` or `1234567_something..`). Otherwise, it needs to be OCR processed to find the invoice number anyway.<br />
 * Defaults to false if not set.
 */
export const processAlreadyProcessedInvoices = (): boolean => process.env.OCR_PROCESS_ALREADY_PROCESSED_FILES?.toLowerCase() === "true";
