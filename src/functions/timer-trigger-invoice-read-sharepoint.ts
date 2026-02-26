import { app, type InvocationContext, type Timer } from "@azure/functions";
import { logger } from "@vestfoldfylke/loglady";

import { handleInvoices } from "../lib/handle-invoices.js";
import { errorTimerHandling } from "../middleware/error-handling.js";

export async function timerTrigger(_myTimer: Timer, _context: InvocationContext): Promise<void> {
  logger.info("Timer triggered to read invoices from SharePoint list");

  await handleInvoices();
}

app.timer("timerTrigger", {
  schedule: "0 */1 * * * *",
  handler: async (timer: Timer, context: InvocationContext): Promise<void> => await errorTimerHandling(timer, context, timerTrigger, "timerTrigger")
});
