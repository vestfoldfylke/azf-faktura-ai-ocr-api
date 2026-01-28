import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import type { WithId } from "mongodb";

import { getWorkItemsInDateRangeFromDb } from "../lib/mongodb-fns.js";

import type { WorkItemMongo } from "../types/zod-mongo.js";
import {logger} from "@vestfoldfylke/loglady";

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
    fromDate.toLocaleString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", hour12: false, minute: "2-digit", second: "2-digit" }),
    fromDate.toISOString(),
    toDate.toLocaleString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", hour12: false, minute: "2-digit", second: "2-digit" }),
    toDate.toISOString()
  );
  const workItems: WithId<WorkItemMongo>[] = await getWorkItemsInDateRangeFromDb(fromDate, toDate);
  logger.info("Found {WorkItemsLength} work items", workItems.length);

  return {
    status: 200,
    body: JSON.stringify(workItems, null, 2)
  };
};

app.http("triggerExport", {
  methods: ["GET"],
  authLevel: "function",
  handler: triggerExport
});
