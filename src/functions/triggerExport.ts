import { writeFileSync } from "node:fs";
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { logger } from "@vestfoldfylke/loglady";
import type { WithId } from "mongodb";

import { textChat } from "../lib/mistral-fns.js";
import { getWorkItemsInDateRangeFromDb } from "../lib/mongodb-fns.js";

import type { WorkItemMongo } from "../types/zod-mongo.js";

const convertWorkItemsToCsv = (workItems: WithId<WorkItemMongo>[]) => {
  let csvContent = '"Fakturanummer","FraDato","FraTid","TilDato","TilTid","Timer totalt","Ansatt","Prosjekt","Aktivitet"\n';

  for (const item of workItems) {
    csvContent += `"${item.invoiceNumber}","${item.fromDate}","${item.fromTime}","${item.toDate}","${item.toTime}","${item.totalHour.toString().replace(".", ",")}","${item.employee}","${item.project ?? ""}","${item.activity ?? ""}"\n`;
  }

  return csvContent;
}

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

  // add UTF-8 BOM to ensure Excel opens the file with correct encoding
  const csvContent: string = convertWorkItemsToCsv(workItems);
  const csvName: string = `arbeidstimer_${fromDate.toISOString().slice(0, -5)}_to_${toDate.toISOString().slice(0, -5)}.csv`;
  logger.info("Found {WorkItemsLength} work items", workItems.length);
  writeFileSync(`./input/${csvName}`, `\uFEFF${csvContent}`, "utf8");
  
  logger.info("Asking Mistral to find any anomalies in the work items");
  /*const systemPrompt: string = `Du skal analysere en liste over arbeidstimer som ligger vedlagt.
  Du skal finne:
    - eventuelle dobbeltoppføringer, kun for samme bruker
    - overlappende arbeidstimer i samme tidsrom, kun for samme bruker, og tidsrommene må være like eller overlappende. To oppføringer med samme

  Flere brukere kan jobbe på samme tidspunkt, dette er greit og skal ikke registreres som et funn.
  En bruker kan avslutte arbeidet etter midnatt og starte opp igjen samme dag men senere, dette er greit og skal ikke registreres som et funn.
  Resulatene skal vises i en kolonne på slutten av hver rad som har et funn.
  De uten funn skal ha denne kolonnen kun som en tom streng.
  Bruk KUN komma (,) som skilletegn mellom kolonner og putt all tekst i dobbeltfnutter.`;*/
  //const aiCsvContent: string = await textChat(systemPrompt, `Her er arbeidstimene:\n\n${csvContent}\n\nAnalyser arbeidstimene og list opp eventuelle uregelmessigheter i en csv tabell. Det er KUN csv tabellen som skal returneres, uten noen ekstra tekst eller forklaringer. Det skal heller ikke puttes i "\`\`\` rundt csv tabellen.`);
  
  /*const systemPrompt: string = `Målet her er å finne ut om det er noen som dobbeltfakturerer. Det vil si samme menneske gjør forskjellige jobber innenfor samme tidsrom.
  Resulatene skal vises i en kolonne på slutten av hver rad som har et funn.
  De uten funn skal ha denne kolonnen kun som en tom streng.
  Bruk KUN komma (,) som skilletegn mellom kolonner og putt all tekst i dobbeltfnutter.`;*/

  const systemPrompt: string = `You are a deterministic audit engine.

Task:
Identify ONLY cases where the SAME person has OVERLAPPING work time intervals.

Definition:
Two time entries overlap if and only if:
start_A < end_B AND start_B < end_A

Rules:
- Compare entries ONLY for the same person.
- Use exact timestamps (date + time).
- Ignore:
  - same day without time overlap
  - long working days
  - multiple jobs on the same date
  - logical or subjective assumptions
  - partial days without overlap
- Do NOT infer or guess.
- If there is no overlap, do NOT report anything.

Output:
Return ONLY valid overlaps as a JSON array.
Each object MUST contain:
- person
- entry_1_start
- entry_1_end
- entry_1_index (0-based)
- entry_2_start
- entry_2_end
- entry_2_index (0-based)
- overlap_start
- overlap_end

If no overlaps exist, return an empty JSON array: []

Do not explain.
Do not add commentary.
Do not add extra fields.`;
  const aiCsvContent: string = await textChat(systemPrompt, csvContent);
  //const validExcelCsvContent: string = `\uFEFF${aiCsvContent}`;

  return {
    status: 200,
    body: aiCsvContent
  };

  /*return {
    status: 200,
    headers: {
      "Content-Disposition": `attachment; filename="${csvName}"`,
      "Content-Type": "text/csv; charset=utf-8"
    },
    body: validExcelCsvContent
  };*/
};

app.http("triggerExport", {
  methods: ["GET"],
  authLevel: "function",
  handler: triggerExport
});
