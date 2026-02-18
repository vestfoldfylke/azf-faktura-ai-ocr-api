import { logger } from "@vestfoldfylke/loglady";

import { getMaxPagesPerChunk, processAlreadyProcessedInvoices } from "../config.js";

import type { ItemsToInsert, ProcessedInvoice } from "../types/faktura-ai";
import type { Invoice } from "../types/zod-ocr.js";

import { updateContext } from "./async-local-context.js";
import { getItemsToInsert, handleOcrChunk, insertWorkItems } from "./chunk-handler.js";
import { invoiceNumberExistsInDb } from "./mongodb-fns.js";
import { chunkPdf } from "./pdf-fns.js";

type ItemsToInsertForAllChunks = {
  hasFailedWorkItems: boolean;
  itemsToInsertForChunks: ItemsToInsert[];
};

const MAX_PAGES_PER_CHUNK: number = getMaxPagesPerChunk();
const PROCESS_ALREADY_PROCESSED_INVOICES: boolean = processAlreadyProcessedInvoices();

const shouldProcessInvoice = async (invoiceNumber: string): Promise<boolean> => {
  if (!(await invoiceNumberExistsInDb(invoiceNumber))) {
    return true;
  }

  if (!PROCESS_ALREADY_PROCESSED_INVOICES) {
    logger.info("Invoice number '{InvoiceNumber}' already processed. Skipping OCR processing for this pdf", invoiceNumber);
    return false;
  }

  logger.info(
    "Invoice number '{InvoiceNumber}' already processed, but since 'PROCESS_ALREADY_PROCESSED_INVOICES' is true, we will process it again",
    invoiceNumber
  );
  return true;
};

export const processInvoice = async (path: string, blobName: string, base64Data: string): Promise<ProcessedInvoice> => {
  let invoiceNumber: string | null = blobName.indexOf("_") > -1 ? blobName.substring(0, blobName.indexOf("_")) : null;

  logger.info(
    "processInvoice for blob '{BlobPath}' with maxPages: {MaxPagesPerChunk} and process already processed invoices: {ProcessAlreadyProcessedInvoices}",
    path,
    MAX_PAGES_PER_CHUNK,
    PROCESS_ALREADY_PROCESSED_INVOICES
  );

  if (invoiceNumber && !(await shouldProcessInvoice(invoiceNumber))) {
    return {
      alreadyProcessed: true,
      invoiceNumber,
      parsedInvoiceChunks: [],
      processedSuccessfully: true
    };
  }

  // PDF handling
  logger.info("Processing PDF");
  const chunkedParts: string[] = await chunkPdf(base64Data, MAX_PAGES_PER_CHUNK);
  logger.info("Is pdf chunked? {IsChunked}. Chunks: {ChunkLength}", chunkedParts.length > 1, chunkedParts.length);

  // chunk handling
  let handledChunkCount: number = 0;
  const processedInvoice: ProcessedInvoice = {
    alreadyProcessed: false,
    invoiceNumber,
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

    updateContext({
      prefix: `${path} - chunks - ${chunkIndex} / ${chunkedParts.length}]`
    });

    const invoiceResponse: Invoice | null = await handleOcrChunk(chunkedParts[i]);
    if (!invoiceResponse) {
      if (i === 0) {
        logger.error("OCR processing failed for first chunk. Skipping invoice");
        processedInvoice.parsedInvoiceChunks.push(null);
        break;
      }

      logger.warn("OCR processing failed for chunk {ChunkIndex}. Skipping this chunk", chunkIndex);
      processedInvoice.parsedInvoiceChunks.push(null);
      continue;
    }

    if (!invoiceNumber && i === 0) {
      invoiceNumber = invoiceResponse.invoice?.number || null;

      if (!invoiceNumber) {
        logger.error("No invoice number found from blob name, and OCR did not find an invoice number on extraction. Skipping invoice");
        processedInvoice.parsedInvoiceChunks.push(null);
        break;
      }

      processedInvoice.invoiceNumber = invoiceNumber;
      logger.info("Invoice number '{InvoiceNumber}' extracted from OCR of first chunk", invoiceNumber);

      if (invoiceNumber && !(await shouldProcessInvoice(invoiceNumber))) {
        return {
          alreadyProcessed: true,
          invoiceNumber,
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

  updateContext({
    prefix: path
  });

  if (!itemsToInsertForAllChunks.hasFailedWorkItems) {
    for (const itemsToInsertForChunk of itemsToInsertForAllChunks.itemsToInsertForChunks) {
      handledChunkCount++;

      if (itemsToInsertForChunk.workMongoItemList.length === 0) {
        continue;
      }

      await insertWorkItems(itemsToInsertForChunk);
    }
  } else {
    logger.warn("Invoice number '{InvoiceNumber}' has failed work items and will NOT be inserted to DB", invoiceNumber);
  }

  const chunkEndTime: number = Date.now();
  logger.info(
    "Chunk processing for {ChunkLength} PDF chunks completed in {Duration} minutes",
    chunkedParts.length,
    (chunkEndTime - chunkStartTime) / 1000 / 60
  );

  processedInvoice.processedSuccessfully = processedInvoice.parsedInvoiceChunks.length === handledChunkCount;
  return processedInvoice;
};
