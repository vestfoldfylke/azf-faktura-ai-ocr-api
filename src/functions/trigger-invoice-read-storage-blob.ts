import { basename } from "node:path";
import { app, type InvocationContext } from "@azure/functions";
import { BlobStorageClient } from "@vestfoldfylke/azure-blob-client";
import { logger } from "@vestfoldfylke/loglady";

import type { LogConfig } from "@vestfoldfylke/loglady/dist/types/types/log-config.types";

import { getBlobStorageInfo } from "../config.js";
import { runInContext } from "../lib/async-local-context.js";
import { processInvoice } from "../lib/process-invoice.js";

import type { BlobStorageInfo, ProcessedInvoice } from "../types/faktura-ai";

const BLOB_STORAGE_INFO: BlobStorageInfo = getBlobStorageInfo();

const blobStorageClient = new BlobStorageClient({
  connectionString: BLOB_STORAGE_INFO.connectionString,
  containerName: BLOB_STORAGE_INFO.containerName
});

const triggerInvoiceRead = async (blob: Buffer, context: InvocationContext): Promise<void> => {
  const blobPath: string = context.triggerMetadata.blobTrigger as string;
  const logContext: LogConfig = {
    contextId: context.invocationId,
    prefix: blobPath
  };

  await runInContext<void>(logContext, async (): Promise<void> => {
    const blobName: string = context.triggerMetadata.name as string;
    logger.info("BlobTrigger: {TriggerName}. Name: {BlobName}", blobPath, blobName);

    const base64Data: string = blob.toString("base64");

    const processedInvoice: ProcessedInvoice = await processInvoice(blobPath, blobName, base64Data);

    if (processedInvoice.alreadyProcessed || processedInvoice.processedSuccessfully) {
      const ocrInvoicePath: string = `${BLOB_STORAGE_INFO.finishedFolderName}/${processedInvoice.invoiceNumber}/ocr_invoice_chunks.json`;
      if (await blobStorageClient.save(ocrInvoicePath, JSON.stringify(processedInvoice.parsedInvoiceChunks, null, 2))) {
        logger.info("OCR result for invoice number: {InvoiceNumber} saved to {OcrInvoicePath}", processedInvoice.invoiceNumber, ocrInvoicePath);
      }

      const newBlobPath: string = await blobStorageClient.move(
        `${BLOB_STORAGE_INFO.queueFolderName}/${blobName}`,
        `${BLOB_STORAGE_INFO.finishedFolderName}/${processedInvoice.invoiceNumber}/${blobName}`
      );
      logger.info("Processed invoice moved to finished folder: {NewBlobPath}", newBlobPath);

      return;
    }

    const invoiceFolderName: string = processedInvoice.invoiceNumber ? processedInvoice.invoiceNumber : basename(blobName, ".pdf");
    if (processedInvoice.parsedInvoiceChunks.length > 0) {
      const ocrInvoicePath: string = `${BLOB_STORAGE_INFO.failedFolderName}/${invoiceFolderName}/ocr_invoice_chunks.json`;
      if (await blobStorageClient.save(ocrInvoicePath, JSON.stringify(processedInvoice.parsedInvoiceChunks, null, 2))) {
        logger.info(
          "OCR result for invoiceNumber {InvoiceNumber} / blobFolderName {BlobFolderName} saved to {OcrInvoicePath}",
          processedInvoice.invoiceNumber,
          invoiceFolderName,
          ocrInvoicePath
        );
      }
    }

    const newFailedBlobPath: string = await blobStorageClient.move(
      `${BLOB_STORAGE_INFO.queueFolderName}/${blobName}`,
      `${BLOB_STORAGE_INFO.failedFolderName}/${invoiceFolderName}/${blobName}`
    );
    logger.error(
      "Failed to process invoice for blob name: {BlobName}. Blob moved to failed folder: {NewFailedBlobPath}",
      blobName,
      newFailedBlobPath
    );
  });
};

app.storageBlob("triggerInvoiceReadStorageBlob", {
  path: `${BLOB_STORAGE_INFO.containerName}/${BLOB_STORAGE_INFO.queueFolderName}/{name}`,
  handler: triggerInvoiceRead,
  connection: "BLOB_STORAGE_CONNECTION_STRING",
  source: "LogsAndContainerScan"
});
