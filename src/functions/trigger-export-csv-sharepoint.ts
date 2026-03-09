import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { logger } from "@vestfoldfylke/loglady";

import { handleExport } from "../lib/handle-export.js";
import { errorTriggerHandling } from "../middleware/error-handling.js";

const triggerExportCsvSharePoint = async (_request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
  logger.info("Manually triggered to export invoice work lists from SharePoint list");

  return await handleExport();
};

app.http("triggerExportCsvSharePoint", {
  methods: ["GET"],
  authLevel: "function",
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> =>
    await errorTriggerHandling(request, context, triggerExportCsvSharePoint)
});
