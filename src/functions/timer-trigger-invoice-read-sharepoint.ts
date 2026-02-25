import { app, type InvocationContext, type Timer } from "@azure/functions";
import { logger } from "@vestfoldfylke/loglady";

import { handleInvoices } from "../lib/handle-invoices.js";

export async function timerTrigger(_myTimer: Timer, _context: InvocationContext): Promise<void> {
  logger.info("Timer triggered to read invoices from SharePoint list");

  await handleInvoices();
}

app.timer("timerTrigger", {
  schedule: "%InvoiceReadSchedule%",
  handler: timerTrigger
});
