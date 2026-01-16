import { logger } from "@vestfoldfylke/loglady";

import { getMaxPagesPerChunk, processAlreadyProcessedInvoices } from "../config.js";

import type { Invoice } from "../types/zod-ocr.js";

import { updateContext } from "./async-local-context.js";
import { handleOcrChunk, insertWorkItemsToDb } from "./chunk-handler.js";
import { closeDatabaseConnection, invoiceNumberExistsInDb } from "./mongodb-fns.js";
import { chunkPdf } from "./pdf-fns.js";

const MAX_PAGES_PER_CHUNK: number = getMaxPagesPerChunk();
const PROCESS_ALREADY_PROCESSED_INVOICES: boolean = processAlreadyProcessedInvoices();

export const processInvoice = async (path: string, blobName: string, base64Data: string): Promise<void> => {
  let invoiceNumber: string | null = blobName.indexOf("_") > -1 ? blobName.substring(0, blobName.indexOf("_")) : null;

  logger.info(
    "Invoice read trigger initialized for blob name {BlobName} with maxPages: {MaxPagesPerChunk} and process already processed invoices: {ProcessAlreadyProcessedInvoices}",
    blobName,
    MAX_PAGES_PER_CHUNK,
    PROCESS_ALREADY_PROCESSED_INVOICES
  );

  updateContext({
    prefix: path
  });

  if (invoiceNumber) {
    const invoiceNumberAlreadyExists: boolean = await invoiceNumberExistsInDb(invoiceNumber);
    if (invoiceNumberAlreadyExists) {
      if (!PROCESS_ALREADY_PROCESSED_INVOICES) {
        logger.info("Invoice number '{InvoiceNumber}' already processed. Skipping OCR processing for this pdf", invoiceNumber);
        return;
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
  const chunkStartTime: number = Date.now();
  for (let i: number = 0; i < chunkedParts.length; i++) {
    const chunkIndex: number = i + 1;

    updateContext({
      prefix: `${path} - chunks - ${chunkIndex} / ${chunkedParts.length}]`
    });

    const invoiceResponse: Invoice | null = await handleOcrChunk(chunkedParts[i]);
    if (!invoiceResponse) {
      continue;
    }

    if (!invoiceNumber && i === 0) {
      invoiceNumber = invoiceResponse.invoice?.number || null;

      if (!invoiceNumber) {
        logger.error("No invoice number found from blob name, and OCR did not find an invoice number on extraction. Skipping invoice");
        continue;
      }

      logger.info("Invoice number '{InvoiceNumber}' extracted from OCR of first chunk", invoiceNumber);
    }

    await insertWorkItemsToDb(invoiceResponse.workLists, invoiceNumber, i + 1, MAX_PAGES_PER_CHUNK);
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

  await closeDatabaseConnection();
};
