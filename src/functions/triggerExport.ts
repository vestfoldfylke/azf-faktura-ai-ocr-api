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
      (problematicEntry: ProblematicCsvItem) => problematicEntry.workItemIndex === index
    );

    if (problemsForItem.length === 0) {
      csvContent += `"${csvItem.entryId}","${csvItem.invoiceNumber}","${csvItem.fromDate}","${csvItem.fromTime}","${csvItem.toDate}","${csvItem.toTime}","${csvItem.totalHour.toString().replace(".", ",")}","${csvItem.employee}","${csvItem.project ?? ""}","${csvItem.activity ?? ""}",""\n`;
      return;
    }

    let problemStr: string = "";
    for (let i: number = 0; i < problemsForItem.length; i++) {
      if (problemStr.length === 0) {
        problemStr += `${i + 1}: ${problemsForItem[i].reason}`;
        continue;
      }

      problemStr += ` -- ${i + 1}: ${problemsForItem[i].reason}`;
    }

    csvContent += `"${csvItem.entryId}","${csvItem.invoiceNumber}","${csvItem.fromDate}","${csvItem.fromTime}","${csvItem.toDate}","${csvItem.toTime}","${csvItem.totalHour.toString().replace(".", ",")}","${csvItem.employee}","${csvItem.project ?? ""}","${csvItem.activity ?? ""}","${problemStr}"\n`;
  });

  return csvContent;
};

const findCsvItemsWithProblems = (csvItems: CsvItem[]): ProblematicCsvItem[] => {
  const problematicEntries: ProblematicCsvItem[] = [];

  // Check for duplicate entries and overlapping time periods
  csvItems.forEach((csvItem: CsvItem, index: number) => {
    csvItems.forEach((otherCsvItem: CsvItem, otherIndex: number) => {
      if (csvItem.employee !== otherCsvItem.employee || index === otherIndex) {
        return;
      }

      // Check for duplicate entries
      let isDuplicateEntry: boolean = false;
      if (
        csvItem.fromDateTime.getTime() === otherCsvItem.fromDateTime.getTime() &&
        csvItem.toDateTime.getTime() === otherCsvItem.toDateTime.getTime()
      ) {
        problematicEntries.push({
          ...csvItem,
          workItemIndex: index,
          otherWorkItemIndex: otherIndex,
          reason: `Duplikat av OppføringsId ${otherCsvItem.entryId}`
        });

        isDuplicateEntry = true;
      }

      // Check for overlapping time periods
      const workItemStart = csvItem.fromDateTime.getTime();
      const workItemEnd = csvItem.toDateTime.getTime();
      const otherWorkItemStart = otherCsvItem.fromDateTime.getTime();
      const otherWorkItemEnd = otherCsvItem.toDateTime.getTime();

      if (!isDuplicateEntry && workItemStart < otherWorkItemEnd && otherWorkItemStart < workItemEnd) {
        problematicEntries.push({
          ...csvItem,
          workItemIndex: index,
          otherWorkItemIndex: otherIndex,
          reason: `Overlappende tidsperiode med OppføringsId ${otherCsvItem.entryId}`
        });
      }
    });
  });

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

  const workItems: WithId<WorkItemMongo>[] = await getWorkItemsInDateRangeFromDb(fromDate, toDate);
  if (workItems.length === 0) {
    logger.info("No work items found in the specified date range");
    return {
      status: 204
    };
  }

  const csvItems: CsvItem[] = workItems.map((workItem: WithId<WorkItemMongo>, index: number) => {
    return {
      ...workItem,
      entryId: index + 1
    };
  });

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
