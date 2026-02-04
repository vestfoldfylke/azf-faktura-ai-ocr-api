import { logger } from "@vestfoldfylke/loglady";

import { getMaxPagesPerChunk, processAlreadyProcessedInvoices } from "../config.js";

import type { ProcessedInvoice } from "../types/faktura-ai";
import type { Invoice } from "../types/zod-ocr.js";

import { updateContext } from "./async-local-context.js";
import { handleOcrChunk, insertWorkItems } from "./chunk-handler.js";
import { invoiceNumberExistsInDb } from "./mongodb-fns.js";
import { chunkPdf } from "./pdf-fns.js";

const MAX_PAGES_PER_CHUNK: number = getMaxPagesPerChunk();
const PROCESS_ALREADY_PROCESSED_INVOICES: boolean = processAlreadyProcessedInvoices();

export const processInvoice = async (path: string, blobName: string, base64Data: string): Promise<ProcessedInvoice> => {
  let invoiceNumber: string | null = blobName.indexOf("_") > -1 ? blobName.substring(0, blobName.indexOf("_")) : null;

  logger.info(
    "processInvoice for blob '{BlobPath}' with maxPages: {MaxPagesPerChunk} and process already processed invoices: {ProcessAlreadyProcessedInvoices}",
    path,
    MAX_PAGES_PER_CHUNK,
    PROCESS_ALREADY_PROCESSED_INVOICES
  );

  if (invoiceNumber) {
    const invoiceNumberAlreadyExists: boolean = await invoiceNumberExistsInDb(invoiceNumber);
    if (invoiceNumberAlreadyExists) {
      if (!PROCESS_ALREADY_PROCESSED_INVOICES) {
        logger.info("Invoice number '{InvoiceNumber}' already processed. Skipping OCR processing for this pdf", invoiceNumber);
        return {
          alreadyProcessed: true,
          invoiceNumber,
          parsedInvoiceChunks: [],
          processedSuccessfully: true
        };
      }

      logger.info(
        "Invoice number '{InvoiceNumber}' already processed, but since 'PROCESS_ALREADY_PROCESSED_INVOICES' is true, we will process it again",
        invoiceNumber
      );
    }
  }

  // PDF handling
  logger.info("Processing PDF");
  const chunkedParts: string[] = await chunkPdf(base64Data, MAX_PAGES_PER_CHUNK);
  logger.info("Is pdf chunked? {IsChunked}. Chunks: {ChunkLength}", chunkedParts.length > 1, chunkedParts.length);

  // chunk handling
  let insertedChunks: number = 0;
  const processedInvoice: ProcessedInvoice = {
    alreadyProcessed: false,
    invoiceNumber,
    parsedInvoiceChunks: [],
    processedSuccessfully: true
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
    }

    if (await insertWorkItems(invoiceResponse.workLists, invoiceNumber, chunkIndex, MAX_PAGES_PER_CHUNK)) {
      insertedChunks++;
    }

    processedInvoice.parsedInvoiceChunks.push(invoiceResponse);
  }

  updateContext({
    prefix: path
  });

  const chunkEndTime: number = Date.now();
  logger.info(
    "Chunk processing for {ChunkLength} PDF chunks completed in {Duration} minutes",
    chunkedParts.length,
    (chunkEndTime - chunkStartTime) / 1000 / 60
  );

  processedInvoice.processedSuccessfully = processedInvoice.parsedInvoiceChunks.length === insertedChunks;
  return processedInvoice;
};
