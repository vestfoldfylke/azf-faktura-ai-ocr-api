import { z } from "zod";

const WorkItemSchema = z
  .object({
    department: z.string().nullish().describe("Avdeling, enhet eller team som utførte arbeidet"),
    employee: z.string().describe("Navn på ansatt eller kontraktør som utførte arbeidet. SKAL være en tom streng hvis ikke tilgjengelig"),
    project: z.string().nullish().describe("Prosjektnavn, prosjektnummer eller prosjektbeskrivelse knyttet til arbeidet"),
    activity: z.string().nullish().describe("Type aktivitet eller arbeidsbeskrivelse"),
    fromTime: z
      .string()
      .describe(
        "Starttidsperiode for arbeidet, 'HH:mm'. Hvis arbeidet startet på hel time, settes minuttene til '00'. Hvis minuttene ikke er tilgjengelig, settes denne til 'HH:00'"
      ),
    toTime: z
      .string()
      .describe(
        "Sluttidsperiode for arbeidet, 'HH:mm'. Hvis arbeidet sluttet på hel time, settes minuttene til '00'. Hvis minuttene ikke er tilgjengelig, settes denne til 'HH:00'"
      ),
    fromDate: z.string().describe("Startdato for arbeidsperioden i format DD.MM.YYYY, basert på dato-feltet når arbeidet startet"),
    toDate: z
      .string()
      .describe(
        "Sluttdato for arbeidsperioden i format DD.MM.YYYY, basert på dato-feltet når arbeidet startet. Hvis sluttiden går over midnatt (00:00), settes denne til neste dag."
      ),
    extras: z.string().nullish().describe("Tilleggskoder og beskrivelse av tillegg, SKAL være en tom streng hvis ikke tilgjengelig"),
    total: z
      .string()
      .describe(
        "Timer brukt totalt på arbeidsoppføringen, som desimaltall, bruk punktum som desimalskilletegn. Vil aldri være urimelig høyt. Alltid lavere enn 100. SKAL være en tom streng hvis ikke tilgjengelig"
      ),
    machineHours: z
      .string()
      .nullish()
      .describe(
        "Maskintimer med utstyrskoder brukt, som desimaltall, bruk punktum som desimalskilletegn. Vil aldri være urimelig høyt. Alltid lavere enn 100. SKAL være en tom streng hvis ikke tilgjengelig"
      ),
    pageNumber: z
      .number()
      .describe("Sidenummer i PDF-dokumentet hvor arbeidsoppføringen ble funnet. Starter ALLTID på 1 og øker med 1 for hver side i PDF'en"),
    id: z.number().describe("Unikt løpenummer som starter på 1 og øker med 1 for hver oppføring")
  })
  .describe("Denne skal KUN brukes når oppføringen er for en arbeidsoppføring fra en timeliste utført av en person!");

const WorkItemListSchema = z.array(WorkItemSchema);

export const InvoiceSchema = z.object({
  // Related time lists (if applicable)
  workLists: z
    .array(WorkItemSchema)
    .describe("Liste over timelister knyttet til fakturaen. Denne skal være et tomt array hvis ingen timelister er funnet."),

  // Invoice header details
  invoice: z
    .object({
      number: z.string().nullish().describe("Fakturanummer"),
      date: z.string().nullish().describe("Fakturadato i format DD.MM.YYYY"),
      dueDate: z.string().nullish().describe("Forfallsdato i format DD.MM.YYYY"),
      kid: z.string().nullish().describe("KID-nummer, vanligvis 10 siffer. SKAL være en tom streng hvis ikke tilgjengelig")
    })
    .nullish()
    .describe("Denne skal KUN opprettes når minimum ett felt er tilstede i OCR-resultatet.")
});

// BBox Annotation response formats
export const ImageSchema = z.object({
  index: z.number().describe("Index of the image, i guess."),
  base64: z.string().describe("Base64 encoded image data."),
  shortDescription: z.string().describe("A description in Norwegian describing the image."),
  summary: z.string().describe("Summarize the image.")
});

// TypeScript types
export type Invoice = z.infer<typeof InvoiceSchema>;
export type WorkItem = z.infer<typeof WorkItemSchema>;
export type WorkItemList = z.infer<typeof WorkItemListSchema>;
