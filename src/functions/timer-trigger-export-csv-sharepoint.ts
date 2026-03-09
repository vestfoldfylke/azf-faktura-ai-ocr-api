import { app, type InvocationContext, type Timer } from "@azure/functions";
import { logger } from "@vestfoldfylke/loglady";

import { handleExport } from "../lib/handle-export.js";
import { errorTimerHandling } from "../middleware/error-handling.js";

const timerTriggerExportCsvSharePoint = async (_myTimer: Timer, _context: InvocationContext): Promise<void> => {
  logger.info("Timer triggered to export csv from SharePoint list");

  await handleExport();
};

app.timer("timerTriggerExportCsvSharePoint", {
  schedule: "%ExportCsvSchedule%",
  handler: async (timer: Timer, context: InvocationContext): Promise<void> =>
    await errorTimerHandling(timer, context, timerTriggerExportCsvSharePoint, "timerTriggerExportCsvSharePoint")
});
