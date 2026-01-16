import { app, type InvocationContext } from "@azure/functions";
import { logger } from "@vestfoldfylke/loglady";

import type { LogConfig } from "@vestfoldfylke/loglady/dist/types/types/log-config.types";

import { getBlobStorageContainerName } from "../config.js";
import { runInContext } from "../lib/async-local-context.js";
import { processInvoice } from "../lib/process-invoice.js";

const BLOB_STORAGE_CONTAINER_NAME_QUEUE: string = getBlobStorageContainerName();

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

    await processInvoice(blobPath, blobName, base64Data);
  });
};

app.storageBlob("triggerInvoiceReadStorageBlob", {
  path: `${BLOB_STORAGE_CONTAINER_NAME_QUEUE}/{name}`,
  handler: triggerInvoiceRead,
  connection: "BLOB_STORAGE_CONNECTION_STRING"
});
