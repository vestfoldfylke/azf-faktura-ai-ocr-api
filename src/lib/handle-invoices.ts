import type { ListItem } from "@microsoft/microsoft-graph-types";
import { logger } from "@vestfoldfylke/loglady";

import { getSharePointConfig } from "../config.js";
import {
  SharePointErrorReasonAlreadyProcessed,
  SharePointErrorReasonFailed,
  SharePointErrorReasonNoRetry,
  SharePointErrorReasonWillRetry,
  SharePointStatusFailedNoRetry,
  SharePointStatusFailedWillRetry,
  SharePointStatusSuccess
} from "../constants.js";

import type { ProcessedInvoice } from "../types/faktura-ai.js";
import type { SharePointConfig } from "../types/sharepoint.js";

import { processInvoice } from "./process-invoice.js";
import { getItemContentAsBase64, getListItems, markItemAsHandled } from "./sharepoint-fns.js";

const sharePointConfig: SharePointConfig = getSharePointConfig();

export const handleInvoices = async (): Promise<ListItem[]> => {
  // get items from sharepoint list which isn't handled or has failed previously
  const items: ListItem[] = await getListItems(
    sharePointConfig.siteId,
    sharePointConfig.listId,
    sharePointConfig.handledErrorThreshold,
    sharePointConfig.unhandledTop
  );
  logger.info(
    "Retrieved {ItemCount} items to handle: {@FileNames}",
    items.length,
    items.map((item: ListItem) => item.fields["LinkFilename"])
  );

  for (let i: number = 0; i < items.length; i++) {
    const listItem: ListItem = items[i];
    const filename: string = listItem.fields["LinkFilename"];
    const logFileIndexStr: string = `[${i + 1} / ${items.length}]`;

    logger.logConfig({
      prefix: `${logFileIndexStr} - ${filename}`
    });

    const content: string = await getItemContentAsBase64(sharePointConfig.siteId, sharePointConfig.listId, listItem.id);

    const processedInvoice: ProcessedInvoice = await processInvoice(filename, content, logFileIndexStr);
    const handledCount: number = (listItem.fields["HandledCount"] as number) + 1;

    logger.logConfig({
      prefix: logFileIndexStr
    });

    if (processedInvoice.alreadyProcessed) {
      const insertedCount: number = listItem.fields["InsertedCount"] as number;
      const invoiceNumber: string = listItem.fields["InvoiceNumber"] as string;
      await markItemAsHandled(
        sharePointConfig.siteId,
        sharePointConfig.listId,
        listItem.id,
        SharePointStatusSuccess,
        handledCount,
        insertedCount,
        invoiceNumber,
        SharePointErrorReasonAlreadyProcessed
      );
      logger.info("Item with Id {ItemId} already processed. Marked as {Status} in SharePoint", listItem.id, SharePointStatusSuccess);

      continue;
    }

    if (processedInvoice.processedSuccessfully) {
      await markItemAsHandled(
        sharePointConfig.siteId,
        sharePointConfig.listId,
        listItem.id,
        SharePointStatusSuccess,
        handledCount,
        processedInvoice.insertedWorkItemCount,
        processedInvoice.invoiceNumber
      );
      logger.info("Item with Id {ItemId} processed successfully. Marked as {Status} in SharePoint", listItem.id, SharePointStatusSuccess);

      continue;
    }

    const willRetry: boolean = handledCount < sharePointConfig.handledErrorThreshold;
    const retryMessage: string = willRetry ? SharePointErrorReasonWillRetry : SharePointErrorReasonNoRetry;

    await markItemAsHandled(
      sharePointConfig.siteId,
      sharePointConfig.listId,
      listItem.id,
      willRetry ? SharePointStatusFailedWillRetry : SharePointStatusFailedNoRetry,
      handledCount,
      processedInvoice.insertedWorkItemCount,
      processedInvoice.invoiceNumber ?? "N/A",
      `${SharePointErrorReasonFailed} ${retryMessage}`
    );

    if (willRetry) {
      logger.warn(
        "Item with Id {ItemId} failed to process. Marked as {Status} in SharePoint. Will retry processing this item next time",
        listItem.id,
        SharePointStatusFailedWillRetry
      );
    } else {
      logger.error(
        "Item with Id {ItemId} failed to process. Marked as {Status} in SharePoint. Reached maximum retry attempts ({MaxAttempts}). Will not retry this item anymore",
        listItem.id,
        SharePointStatusFailedNoRetry,
        sharePointConfig.handledErrorThreshold
      );
    }
  }

  logger.logConfig({
    prefix: undefined
  });

  return items;
};
