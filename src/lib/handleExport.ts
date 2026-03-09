import { logger } from "@vestfoldfylke/loglady";
import type { WithId } from "mongodb";
import type { CsvItem, CsvResponse, ProblematicCsvItem } from "../types/faktura-ai.js";
import type { WorkMongoItem } from "../types/zod-mongo.js";
import { getWorkItemsInDateRangeFromDb } from "./mongodb-fns.js";

export const handleExport = async (fromDate: Date, toDate: Date): Promise<CsvResponse> => {
  logger.info(
    "Finding work items between {FromDate} ({FromDateISO}) and {ToDate} ({ToDateISO})",
    fromDate.toLocaleString("nb-NO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      hour12: false,
      minute: "2-digit",
      second: "2-digit"
    }),
    fromDate.toISOString(),
    toDate.toLocaleString("nb-NO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      hour12: false,
      minute: "2-digit",
      second: "2-digit"
    }),
    toDate.toISOString()
  );

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
    return {
      status: 204
    };
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
  const csvName: string = `arbeidstimer_${fromDate.toISOString().slice(0, -5)}_to_${toDate.toISOString().slice(0, -5)}.csv`;

  return {
    csvContent,
    csvName,
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
