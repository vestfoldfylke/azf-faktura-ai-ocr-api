import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { logger } from "@vestfoldfylke/loglady";
import type { WithId } from "mongodb";

import { getWorkItemsInDateRangeFromDb } from "../lib/mongodb-fns.js";

import type { CsvItem, ProblematicCsvItem } from "../types/faktura-ai";
import type { WorkItemMongo } from "../types/zod-mongo.js";

const convertCsvItemsToCsv = (csvItems: CsvItem[], problematicEntries: ProblematicCsvItem[]) => {
  let csvContent = '"OppføringsId","Fakturanummer","FraDato","FraTid","TilDato","TilTid","Timer totalt","Ansatt","Prosjekt","Aktivitet","Funn"\n';

  csvItems.forEach((csvItem: CsvItem, index: number) => {
    const problemsForItem: ProblematicCsvItem[] = problematicEntries.filter(
      (problematicEntry: ProblematicCsvItem) => (problematicEntry.entryId - 1) === index
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

const triggerExport = async (request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
  const fromDateStr: string | null = request.query.get("fromDate");
  const toDateStr: string | null = request.query.get("toDate");

  if (!fromDateStr || !toDateStr) {
    return {
      status: 400,
      body: "Missing required query parameters: fromDate and/or toDate"
    };
  }

  if (Number.isNaN(Date.parse(fromDateStr)) || Number.isNaN(Date.parse(toDateStr))) {
    return {
      status: 400,
      body: "Invalid date format for fromDate and/or toDate. Specify date as an ISO string in UTC"
    };
  }

  const fromDate: Date = new Date(fromDateStr);
  const toDate: Date = new Date(toDateStr);

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

  const csvItems: CsvItem[] = (await getWorkItemsInDateRangeFromDb(fromDate, toDate)).map((workItem: WithId<WorkItemMongo>, index: number): CsvItem => {
    return {
      ...workItem,
      entryId: index + 1
    };
  });
  if (csvItems.length === 0) {
    logger.info("No work items found in the specified date range");
    return {
      status: 204
    };
  }

  logger.info("Found {CsvItemsLength} csv items", csvItems.length);

  const problematicCsvItems: ProblematicCsvItem[] = findCsvItemsWithProblems(csvItems);
  logger.warn("Found {ProblematicCsvItemsLength} problematic csv items", problematicCsvItems.length);

  // add UTF-8 BOM to ensure Excel opens the file with correct encoding
  const csvContent: string = `\uFEFF${convertCsvItemsToCsv(csvItems, problematicCsvItems)}`;
  const csvName: string = `arbeidstimer_${fromDate.toISOString().slice(0, -5)}_to_${toDate.toISOString().slice(0, -5)}.csv`;

  return {
    status: 200,
    headers: {
      "Content-Disposition": `attachment; filename="${csvName}"`,
      "Content-Type": "text/csv; charset=utf-8"
    },
    body: csvContent
  };
};

app.http("triggerExport", {
  methods: ["GET"],
  authLevel: "function",
  handler: triggerExport
});
