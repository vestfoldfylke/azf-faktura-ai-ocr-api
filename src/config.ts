import type { AIVendor, AIVendorConfigMap } from "./types/ai/ai-agent.js";
import type { SharePointConfig } from "./types/sharepoint.js";

const getMistralConfig = (): AIVendorConfigMap["mistral"] | undefined => {
  const apiKey: string = process.env.MISTRAL_API_KEY;
  const model: string = process.env.MISTRAL_MODEL_NAME || "mistral-ocr-latest";

  if (!apiKey) {
    return undefined;
  }

  return {
    apiKey,
    model
  };
};

const getOpenAIConfig = (): AIVendorConfigMap["openai"] | undefined => {
  const apiKey: string = process.env.OPENAI_API_KEY;
  const model: string = process.env.OPENAI_MODEL_NAME || "gpt-4o";

  if (!apiKey) {
    return undefined;
  }

  return {
    apiKey,
    model
  };
};

export const getAIAgentConfig = (): Partial<Record<AIVendor, AIVendorConfigMap[AIVendor]>> => {
  const configs: Partial<Record<AIVendor, AIVendorConfigMap[AIVendor]>> = {};

  const mistral: AIVendorConfigMap["mistral"] | undefined = getMistralConfig();
  if (mistral) {
    configs.mistral = mistral;
  }

  const openai: AIVendorConfigMap["openai"] | undefined = getOpenAIConfig();
  if (openai) {
    configs.openai = openai;
  }

  const aiAgentConfigCount: number = Object.keys(configs).length;
  if (aiAgentConfigCount === 0) {
    throw new Error("No AI vendor config are set in environment variables");
  }

  if (aiAgentConfigCount > 1) {
    throw new Error(`Multiple (${aiAgentConfigCount}) AI vendor config are set in environment variables. Please set only one to avoid conflicts.`);
  }

  return configs;
};

/**
 * Get the maximum number of pages per PDF chunk for OCR processing on OCR agents.<br />
 * Defaults to 4 if not set, invalid or greater than 8.
 */
export const getOcrMaxPagesPerPdfChunk = (): number => {
  const maxPages: number | undefined = process.env.OCR_MAX_PAGES_PER_CHUNK ? parseInt(process.env.OCR_MAX_PAGES_PER_CHUNK, 10) : undefined;

  return Number.isInteger(maxPages) && maxPages > 0 && maxPages <= 8 ? maxPages : 4;
};

export const getMongoDbConnectionString = (): string => {
  const connectionString: string = process.env.MONGODB_CONNECTION_STRING;

  if (!connectionString) {
    throw new Error("MONGODB_CONNECTION_STRING is not set in environment variables");
  }

  return connectionString;
};

export const getMongoDbCollectionName = (): string => {
  const collectionName: string = process.env.MONGODB_COLLECTION_NAME;

  if (!collectionName) {
    throw new Error("MONGODB_COLLECTION_NAME is not set in environment variables");
  }

  return collectionName;
};

export const getMongoDbDatabaseName = (): string => {
  const databaseName: string = process.env.MONGODB_DATABASE_NAME;

  if (!databaseName) {
    throw new Error("MONGODB_DATABASE_NAME is not set in environment variables");
  }

  return databaseName;
};

export const getSharePointConfig = (): SharePointConfig => {
  const csvOrderSiteId: string = process.env.SP_CSV_ORDER_SITE_ID;
  const csvOrderListId: string = process.env.SP_CSV_ORDER_LIST_ID;

  const csvExportSiteId: string = process.env.SP_CSV_EXPORT_SITE_ID;
  const csvExportDriveId: string = process.env.SP_CSV_EXPORT_DRIVE_ID;
  const csvExportListId: string = process.env.SP_CSV_EXPORT_LIST_ID;

  const invoiceSiteId: string = process.env.SP_INVOICE_SITE_ID;
  const invoiceListId: string = process.env.SP_INVOICE_LIST_ID;
  const invoiceHandledErrorThreshold: number = parseInt(process.env.SP_INVOICE_HANDLED_ERROR_THRESHOLD ?? "3", 10);
  const invoiceUnhandledTop: number = parseInt(process.env.SP_INVOICE_LIST_UNHANDLED_TOP ?? "3", 10);

  if (!csvOrderSiteId) {
    throw new Error("SP_CSV_ORDER_SITE_ID is not set in environment variables");
  }

  if (!csvOrderListId) {
    throw new Error("SP_CSV_ORDER_LIST_ID is not set in environment variables");
  }

  if (!csvExportSiteId) {
    throw new Error("SP_CSV_EXPORT_SITE_ID is not set in environment variables");
  }

  if (!csvExportDriveId) {
    throw new Error("SP_CSV_EXPORT_DRIVE_ID is not set in environment variables");
  }

  if (!csvExportListId) {
    throw new Error("SP_CSV_EXPORT_LIST_ID is not set in environment variables");
  }

  if (!invoiceSiteId) {
    throw new Error("SP_INVOICE_SITE_ID is not set in environment variables");
  }

  if (!invoiceListId) {
    throw new Error("SP_INVOICE_LIST_ID is not set in environment variables");
  }

  if (!Number.isInteger(invoiceHandledErrorThreshold) || invoiceHandledErrorThreshold < 1) {
    throw new Error("SP_INVOICE_HANDLED_ERROR_THRESHOLD must be a positive integer");
  }

  if (!Number.isInteger(invoiceUnhandledTop) || invoiceUnhandledTop < 1) {
    throw new Error("SP_INVOICE_LIST_UNHANDLED_TOP must be a positive integer");
  }

  return {
    csvOrder: {
      listId: csvOrderListId,
      siteId: csvOrderSiteId
    },
    csvExport: {
      driveId: csvExportDriveId,
      listId: csvExportListId,
      siteId: csvExportSiteId
    },
    invoice: {
      handledErrorThreshold: invoiceHandledErrorThreshold,
      listId: invoiceListId,
      siteId: invoiceSiteId,
      unhandledTop: invoiceUnhandledTop
    }
  };
};

/**
 * Determine whether to process invoices that have already been processed for OCR.<br />
 * Requires that blob name has invoice number in the name followed by a `_` (Example: `1234567_` or `1234567_something...`). Otherwise, it needs to be OCR processed to find the invoice number anyway.<br />
 * Defaults to false if not set.
 */
export const processAlreadyProcessedInvoices = (): boolean => process.env.OCR_PROCESS_ALREADY_PROCESSED_FILES?.toLowerCase() === "true";
