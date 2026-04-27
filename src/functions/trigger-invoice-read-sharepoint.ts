import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { logger } from "@vestfoldfylke/loglady";

import { handleInvoices } from "../lib/handle-invoices.js";
import { errorTriggerHandling } from "../middleware/error-handling.js";
import type { InvoiceItem } from "../types/sharepoint.js";

const triggerInvoiceRead = async (_request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
  logger.info("Manually triggered to read invoices from SharePoint list");

  const response: InvoiceItem[] = await handleInvoices();

  return {
    jsonBody: response
  };
};

app.http("triggerInvoiceRead", {
  methods: ["GET"],
  authLevel: "function",
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> =>
    await errorTriggerHandling(request, context, triggerInvoiceRead)
});
