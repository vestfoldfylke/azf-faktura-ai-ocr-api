import type { ListItem } from "@microsoft/microsoft-graph-types";
import { logger } from "@vestfoldfylke/loglady";

import { getSharePointConfig } from "../config.js";

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
        "Success",
        handledCount,
        insertedCount,
        invoiceNumber,
        "Faktura har allerede blitt behandlet tidligere"
      );
      logger.info("Item with Id {ItemId} already processed. Marked as handled in SharePoint", listItem.id);

      continue;
    }

    if (processedInvoice.processedSuccessfully) {
      await markItemAsHandled(
        sharePointConfig.siteId,
        sharePointConfig.listId,
        listItem.id,
        "Success",
        handledCount,
        processedInvoice.insertedWorkItemCount,
        processedInvoice.invoiceNumber
      );
      logger.info("Item with Id {ItemId} processed successfully. Marked as handled in SharePoint", listItem.id);

      continue;
    }

    const retryMessage: string =
      handledCount < sharePointConfig.handledErrorThreshold
        ? "OCR-lesing vil bli forsøkt igjen ved neste kjøring"
        : "Denne filen vil ikke bli forsøkt igjen";

    await markItemAsHandled(
      sharePointConfig.siteId,
      sharePointConfig.listId,
      listItem.id,
      "Error",
      handledCount,
      processedInvoice.insertedWorkItemCount,
      processedInvoice.invoiceNumber ?? "N/A",
      `OCR-lesing mislyktes. ${retryMessage}`
    );

    if (handledCount < sharePointConfig.handledErrorThreshold) {
      logger.warn("Item with Id {ItemId} failed to process. Marked as error in SharePoint. Will retry processing this item next time", listItem.id);
    } else {
      logger.error(
        "Item with Id {ItemId} failed to process. Marked as error in SharePoint. Reached maximum retry attempts ({MaxAttempts}). Will not retry this item anymore",
        listItem.id,
        sharePointConfig.handledErrorThreshold
      );
    }
  }

  logger.logConfig({
    prefix: undefined
  });

  return items;
};
