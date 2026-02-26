import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import type { ListItem } from "@microsoft/microsoft-graph-types";
import { logger } from "@vestfoldfylke/loglady";

import { handleInvoices } from "../lib/handle-invoices.js";
import { errorTriggerHandling } from "../middleware/error-handling.js";

const triggerInvoiceRead = async (_request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
  logger.info("Manually triggered to read invoices from SharePoint list");

  const response: ListItem[] = await handleInvoices();

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
