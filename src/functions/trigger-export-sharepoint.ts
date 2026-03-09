import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { logger } from "@vestfoldfylke/loglady";

import { handleExport } from "../lib/handleExport.js";
import { errorTriggerHandling } from "../middleware/error-handling.js";

import type { CsvResponse } from "../types/faktura-ai.js";

const dateRegex: RegExp = /^\d{4}-\d{2}-\d{2}$/;

const triggerExportSharePoint = async (request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
  const fromDateStr: string | null = request.query.get("fromDate");
  const toDateStr: string | null = request.query.get("toDate");

  logger.info("Manually triggered to export invoice work lists with fromDate: {FromDate} and toDate: {ToDate}", fromDateStr, toDateStr);

  if (!fromDateStr || !toDateStr) {
    logger.error("Missing required query parameters: fromDate and/or toDate");
    return {
      status: 400,
      body: "Missing required query parameters: fromDate and/or toDate"
    };
  }

  if (!dateRegex.test(fromDateStr) || !dateRegex.test(toDateStr)) {
    logger.error("Invalid date format for fromDate and/or toDate. Expected ISO date string: YYYY-MM-DD");
    return {
      status: 400,
      body: "Invalid date format for fromDate and/or toDate. Expected ISO date string: YYYY-MM-DD"
    };
  }

  if (Number.isNaN(Date.parse(fromDateStr)) || Number.isNaN(Date.parse(toDateStr))) {
    logger.error("Invalid date format for fromDate and/or toDate. Unable to parse dates");
    return {
      status: 400,
      body: "Invalid date format for fromDate and/or toDate. Unable to parse dates"
    };
  }

  const fromDate: Date = new Date(fromDateStr);
  const toDate: Date = new Date(toDateStr);

  const response: CsvResponse = await handleExport(fromDate, toDate);

  if (response.status === 204) {
    return {
      status: 204
    };
  }

  return {
    status: response.status,
    headers: {
      "Content-Disposition": `attachment; filename="${response.csvName}"`,
      "Content-Type": "text/csv; charset=utf-8"
    },
    body: response.csvContent
  };
};

app.http("triggerExportSharePoint", {
  methods: ["GET"],
  authLevel: "function",
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> =>
    await errorTriggerHandling(request, context, triggerExportSharePoint)
});
