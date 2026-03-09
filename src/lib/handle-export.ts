import type { HttpResponseInit } from "@azure/functions";
import type { ListItem } from "@microsoft/microsoft-graph-types";
import { logger } from "@vestfoldfylke/loglady";
import type { WithId } from "mongodb";

import { getSharePointConfig } from "../config.js";
import { SharePointStatusFailed, SharePointStatusSuccess } from "../constants.js";

import type { CsvItem, ProblematicCsvItem } from "../types/faktura-ai.js";
import type { SharePointConfig } from "../types/sharepoint.js";
import type { WorkMongoItem } from "../types/zod-mongo.js";

import { getWorkItemsInDateRangeFromDb } from "./mongodb-fns.js";
import { getCsvListItems, getCsvWebUrl, getLatestCsvItemId, markCsvItemAsHandled, uploadCsvToSharePoint } from "./sharepoint-fns.js";

const sharePointConfig: SharePointConfig = getSharePointConfig();

const dateRegex: RegExp = /^\d{4}-\d{2}-\d{2}$/;

export const handleExport = async (): Promise<HttpResponseInit> => {
  // get items from sharepoint list which isn't handled
  const items: ListItem[] = await getCsvListItems(sharePointConfig.csvOrder.siteId, sharePointConfig.csvOrder.listId);
  logger.info("Retrieved {ItemCount} CSV items to handle", items.length);

  for (let i: number = 0; i < items.length; i++) {
    const listItem: ListItem = items[i];
    const logFileIndexStr: string = `[${i + 1} / ${items.length}]`;

    logger.logConfig({
      prefix: `${logFileIndexStr} - ${listItem.id}`
    });

    const fromDateStr: string | null = (listItem.fields["FromDate"] as string | null)?.slice(0, 10);
    const toDateStr: string | null = (listItem.fields["ToDate"] as string | null)?.slice(0, 10);

    const missingDateFields: boolean = !fromDateStr || !toDateStr;
    const invalidDateFormat: boolean = !dateRegex.test(fromDateStr) || !dateRegex.test(toDateStr);
    const unableToParseDates: boolean = Number.isNaN(Date.parse(fromDateStr)) || Number.isNaN(Date.parse(toDateStr));

    if (missingDateFields || invalidDateFormat || unableToParseDates) {
      if (missingDateFields) {
        logger.error(
          "Missing required FromDate ({FromDate}) and/or ToDate ({ToDate}) fields in list item with id {ListItemId}",
          fromDateStr,
          toDateStr,
          listItem.id
        );
      }

      if (invalidDateFormat) {
        logger.error(
          "Invalid date format for FromDate ({FromDate}) and/or ToDate ({ToDate}) fields in list item with id {ListItemId}. Expected ISO string: YYYY-MM-DDTHH:mm:ssZ",
          fromDateStr,
          toDateStr,
          listItem.id
        );
      }

      if (unableToParseDates) {
        logger.error("Invalid date format for fromDate and/or toDate. Unable to parse dates");
      }

      await markCsvItemAsHandled(sharePointConfig.csvOrder.siteId, sharePointConfig.csvOrder.listId, listItem.id, SharePointStatusFailed);

      continue;
    }

    const fromDate: Date = new Date(fromDateStr);
    const toDate: Date = new Date(toDateStr);

    logger.info("Finding work items between {FromDate} and {ToDate}", fromDateStr, toDateStr);

    const csvItems: CsvItem[] = (await getWorkItemsInDateRangeFromDb(fromDate, toDate)).map(
      (workItem: WithId<WorkMongoItem>, index: number): CsvItem => {
        return {
          ...workItem,
          entryId: index + 1
        };
      }
    );

    if (csvItems.length === 0) {
      logger.info("No work items found in the specified date range");

      await markCsvItemAsHandled(sharePointConfig.csvOrder.siteId, sharePointConfig.csvOrder.listId, listItem.id, SharePointStatusSuccess);

      continue;
    }

    logger.info("Found {CsvItemsLength} csv items", csvItems.length);

    const problematicCsvItems: ProblematicCsvItem[] = findCsvItemsWithProblems(csvItems);
    if (problematicCsvItems.length > 0) {
      logger.warn("Found {ProblematicCsvItemsLength} problematic csv items", problematicCsvItems.length);
    } else {
      logger.info("No problematic csv items found");
    }

    // add UTF-8 BOM to ensure Excel opens the file with correct encoding
    const csvContent: string = `\uFEFF${convertCsvItemsToCsv(csvItems, problematicCsvItems)}`;
    const csvName: string = `arbeidstimer_${fromDate.toISOString().slice(0, -5).replaceAll(":", "_")}_to_${toDate.toISOString().slice(0, -5).replaceAll(":", "_")}.csv`;

    await uploadCsvToSharePoint(csvContent, csvName, sharePointConfig.csvExport.siteId, sharePointConfig.csvExport.driveId);

    const newCsvItemId: string = await getLatestCsvItemId(sharePointConfig.csvExport.siteId, sharePointConfig.csvExport.listId);
    const csvWebUrl: string = await getCsvWebUrl(sharePointConfig.csvExport.siteId, sharePointConfig.csvExport.listId, newCsvItemId);

    await markCsvItemAsHandled(
      sharePointConfig.csvOrder.siteId,
      sharePointConfig.csvOrder.listId,
      listItem.id,
      SharePointStatusSuccess,
      csvName,
      csvWebUrl,
      csvItems.length,
      problematicCsvItems.length
    );
  }

  return {
    status: 200
  };
};

const convertCsvItemsToCsv = (csvItems: CsvItem[], problematicEntries: ProblematicCsvItem[]) => {
  let csvContent = '"OppføringsId","Fakturanummer","FraDato","FraTid","TilDato","TilTid","Timer totalt","Ansatt","Prosjekt","Aktivitet","Funn"\n';

  csvItems.forEach((csvItem: CsvItem, index: number) => {
    const problemsForItem: ProblematicCsvItem[] = problematicEntries.filter(
      (problematicEntry: ProblematicCsvItem) => problematicEntry.entryId - 1 === index
    );
    if (problemsForItem.length === 0) {
      csvContent += `"${csvItem.entryId}","${csvItem.invoiceNumber}","${csvItem.fromDate}","${csvItem.fromTime}","${csvItem.toDate}","${csvItem.toTime}","${csvItem.totalHour.toString().replace(".", ",")}","${csvItem.employee}","${csvItem.project ?? ""}","${csvItem.activity ?? ""}",""\n`;
      return;
    }

    const problemStr: string = problemsForItem.map((problemForItem: ProblematicCsvItem) => problemForItem.reason).join(" -- ");

    csvContent += `"${csvItem.entryId}","${csvItem.invoiceNumber}","${csvItem.fromDate}","${csvItem.fromTime}","${csvItem.toDate}","${csvItem.toTime}","${csvItem.totalHour.toString().replace(".", ",")}","${csvItem.employee}","${csvItem.project ?? ""}","${csvItem.activity ?? ""}","${problemStr}"\n`;
  });

  return csvContent;
};

const findCsvItemsWithProblems = (csvItems: CsvItem[]): ProblematicCsvItem[] => {
  const problematicEntries: ProblematicCsvItem[] = [];

  // Check for duplicate entries and overlapping time periods
  for (const csvItem of csvItems) {
    for (const otherCsvItem of csvItems) {
      if (csvItem.employee !== otherCsvItem.employee || csvItem.entryId === otherCsvItem.entryId) {
        continue;
      }

      // Check for duplicate entries
      let isDuplicateEntry: boolean = false;
      if (
        csvItem.fromDateTime.getTime() === otherCsvItem.fromDateTime.getTime() &&
        csvItem.toDateTime.getTime() === otherCsvItem.toDateTime.getTime()
      ) {
        problematicEntries.push({
          ...csvItem,
          reason: `Duplikat av OppføringsId ${otherCsvItem.entryId}`
        });

        isDuplicateEntry = true;
      }

      // Check for overlapping time periods
      const workItemStart: number = csvItem.fromDateTime.getTime();
      const workItemEnd: number = csvItem.toDateTime.getTime();
      const otherWorkItemStart: number = otherCsvItem.fromDateTime.getTime();
      const otherWorkItemEnd: number = otherCsvItem.toDateTime.getTime();

      if (!isDuplicateEntry && workItemStart < otherWorkItemEnd && otherWorkItemStart < workItemEnd) {
        problematicEntries.push({
          ...csvItem,
          reason: `Overlappende tidsperiode med OppføringsId ${otherCsvItem.entryId}`
        });
      }
    }
  }

  return problematicEntries;
};
