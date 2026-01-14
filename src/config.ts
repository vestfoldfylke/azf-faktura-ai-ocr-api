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
}

export const getMongoDbCollectionName = (): string => {
  const collectionName = process.env.MONGODB_COLLECTION_NAME;

  if (!collectionName) {
    throw new Error("MONGODB_COLLECTION_NAME is not set in environment variables");
  }

  return collectionName;
}

export const getMongoDbDatabaseName = (): string => {
  const databaseName = process.env.MONGODB_DATABASE_NAME;
  
  if (!databaseName) {
    throw new Error("MONGODB_DATABASE_NAME is not set in environment variables");
  }
  
  return databaseName;
}

/**
 * Determine whether to process files that have already been processed for OCR.<br />
 * Defaults to false if not set.
 */
export const processAlreadyProcessedFiles = (): boolean => process.env.OCR_PROCESS_ALREADY_PROCESSED_FILES?.toLowerCase() === "true";
