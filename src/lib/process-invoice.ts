import { logger } from "@vestfoldfylke/loglady";
import { count, countInc } from "@vestfoldfylke/vestfold-metrics";

import { getMaxPagesPerChunk, processAlreadyProcessedInvoices } from "../config.js";

import { MetricsPrefix, MetricsResultFailedLabelValue, MetricsResultLabelName, MetricsResultSuccessLabelValue } from "../constants.js";

import type { ItemsToInsert, ProcessedInvoice } from "../types/faktura-ai.js";
import type { Invoice } from "../types/zod-ocr.js";

import { getItemsToInsert, handleOcrChunk, insertWorkItems } from "./chunk-handler.js";
import { invoiceNumberExistsInDb } from "./mongodb-fns.js";
import { chunkPdf } from "./pdf-fns.js";

type ItemsToInsertForAllChunks = {
  hasFailedWorkItems: boolean;
  itemsToInsertForChunks: ItemsToInsert[];
};

const MetricsFilePrefix = "ProcessInvoice";
const MAX_PAGES_PER_CHUNK: number = getMaxPagesPerChunk();
const PROCESS_ALREADY_PROCESSED_INVOICES: boolean = processAlreadyProcessedInvoices();

const shouldProcessInvoice = async (invoiceNumber: string): Promise<boolean> => {
  if (!(await invoiceNumberExistsInDb(invoiceNumber))) {
    return true;
  }

  if (!PROCESS_ALREADY_PROCESSED_INVOICES) {
    logger.info("Invoice number '{InvoiceNumber}' already processed. Skipping further OCR processing for this pdf", invoiceNumber);
    return false;
  }

  logger.info(
    "Invoice number '{InvoiceNumber}' already processed, but since 'PROCESS_ALREADY_PROCESSED_INVOICES' is true, we will process it again",
    invoiceNumber
  );
  return true;
};

export const processInvoice = async (filename: string, base64Data: string, logFileIndexStr: string): Promise<ProcessedInvoice> => {
  let invoiceNumber: string | null = null;

  logger.info(
    "processing PDF with maxPages: {MaxPagesPerChunk} and process already processed invoices: {ProcessAlreadyProcessedInvoices}",
    MAX_PAGES_PER_CHUNK,
    PROCESS_ALREADY_PROCESSED_INVOICES
  );

  // PDF handling
  const chunkedParts: string[] = await chunkPdf(base64Data, MAX_PAGES_PER_CHUNK);
  logger.info("Is pdf chunked? {IsChunked}. Chunks: {ChunkLength}", chunkedParts.length > 1, chunkedParts.length);

  // chunk handling
  let handledChunkCount: number = 0;
  const processedInvoice: ProcessedInvoice = {
    alreadyProcessed: false,
    invoiceNumber,
    insertedWorkItemCount: 0,
    parsedInvoiceChunks: [],
    processedSuccessfully: true
  };
  const itemsToInsertForAllChunks: ItemsToInsertForAllChunks = {
    hasFailedWorkItems: false,
    itemsToInsertForChunks: []
  };
  const chunkStartTime: number = Date.now();

  for (let i: number = 0; i < chunkedParts.length; i++) {
    const chunkIndex: number = i + 1;

    logger.logConfig({
      prefix: `${logFileIndexStr} - ${filename} - chunks - [${chunkIndex} / ${chunkedParts.length}]`
    });

    const invoiceResponse: Invoice | null = await handleOcrChunk(chunkedParts[i]);
    if (!invoiceResponse) {
      if (i === 0) {
        logger.error("OCR processing failed for first chunk. Skipping invoice");
        processedInvoice.parsedInvoiceChunks.push(invoiceResponse);
        break;
      }

      logger.error("OCR processing failed for chunk. Skipping rest of invoice");
      processedInvoice.parsedInvoiceChunks.push(invoiceResponse);
      break;
    }

    if (i === 0) {
      invoiceNumber = invoiceResponse.invoice?.number || null;

      if (!invoiceNumber) {
        logger.error("No invoice number found from OCR. Skipping invoice");
        processedInvoice.parsedInvoiceChunks.push(null);
        break;
      }

      processedInvoice.invoiceNumber = invoiceNumber;
      logger.info("Invoice number '{InvoiceNumber}' extracted from OCR of first chunk", invoiceNumber);

      if (invoiceNumber && !(await shouldProcessInvoice(invoiceNumber))) {
        return {
          alreadyProcessed: true,
          invoiceNumber,
          insertedWorkItemCount: 0,
          parsedInvoiceChunks: [],
          processedSuccessfully: true
        };
      }
    }

    const itemsToInsert: ItemsToInsert = getItemsToInsert(invoiceResponse.workLists, invoiceNumber, chunkIndex, MAX_PAGES_PER_CHUNK);
    itemsToInsertForAllChunks.hasFailedWorkItems = itemsToInsertForAllChunks.hasFailedWorkItems || itemsToInsert.failedWorkItemIds.length > 0;
    itemsToInsertForAllChunks.itemsToInsertForChunks.push(itemsToInsert);

    processedInvoice.parsedInvoiceChunks.push(invoiceResponse);
  }

  logger.logConfig({
    prefix: `${logFileIndexStr} - ${filename}`
  });

  const hasNullParsedChunks: boolean = processedInvoice.parsedInvoiceChunks.some((chunk: Invoice | null) => chunk === null);

  if (!itemsToInsertForAllChunks.hasFailedWorkItems && !hasNullParsedChunks) {
    count(`${MetricsPrefix}_${MetricsFilePrefix}_Invoice`, "Number of invoices processed", [MetricsResultLabelName, MetricsResultSuccessLabelValue]);

    for (const itemsToInsertForChunk of itemsToInsertForAllChunks.itemsToInsertForChunks) {
      handledChunkCount++;

      if (itemsToInsertForChunk.workMongoItemList.length === 0) {
        continue;
      }

      await insertWorkItems(itemsToInsertForChunk);
      processedInvoice.insertedWorkItemCount += itemsToInsertForChunk.workMongoItemList.length;
      countInc(
        `${MetricsPrefix}_${MetricsFilePrefix}_InvoiceWorkItemsInserted`,
        "Number of work items from invoices inserted",
        itemsToInsertForChunk.workMongoItemList.length
      );
    }
  } else if (invoiceNumber) {
    logger.warn("Invoice number '{InvoiceNumber}' has failed work items and will NOT be inserted to DB", invoiceNumber);
    count(`${MetricsPrefix}_${MetricsFilePrefix}_Invoice`, "Number of invoices processed", [MetricsResultLabelName, MetricsResultFailedLabelValue]);
  }

  const chunkEndTime: number = Date.now();
  logger.info(
    "Chunk processing for {ChunkLength} PDF chunks completed in {Duration} minutes. Inserted {InsertedWorkItemCount} work items",
    chunkedParts.length,
    (chunkEndTime - chunkStartTime) / 1000 / 60,
    processedInvoice.insertedWorkItemCount
  );

  processedInvoice.processedSuccessfully =
    processedInvoice.parsedInvoiceChunks.length === handledChunkCount && !itemsToInsertForAllChunks.hasFailedWorkItems && !hasNullParsedChunks;
  return processedInvoice;
};
