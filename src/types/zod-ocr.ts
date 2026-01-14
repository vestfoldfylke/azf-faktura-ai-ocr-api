import { z } from "zod";

// Document Annotation response formats
const ProductSchema = z.object({
  productNumber: z.string().describe("Produktnummer eller produktkode, SKAL være en tom streng hvis ikke tilgjengelig"),
  description: z.string().describe("Beskrivelse av produktet eller tjenesten, SKAL være en tom streng hvis ikke tilgjengelig"),
  quantity: z.string().describe("Antall enheter av produktet eller tjenesten som desimaltall, bruk punktum som desimalskilletegn. SKAL være en tom streng hvis ikke tilgjengelig"),
  unit: z.string().describe("Enhet for mengde, f.eks. 'stk', 'kg', SKAL være en tom streng hvis ikke tilgjengelig"),
  unitPrice: z
    .string()
    .describe(
      "Pris per enhet av produktet eller tjenesten som desimaltall, bruk punktum som desimalskilletegn. Kan være skrevet som et helt tall eller med mellomrom mellom hver tusen. SKAL være en tom streng hvis ikke tilgjengelig"
    ),
  totalPrice: z
    .string()
    .describe(
      "Totalpris for linjeelementet (quantity * unitPrice) som desimaltall, bruk punktum som desimalskilletegn. Kan være skrevet som et helt tall eller med mellomrom mellom hver tusen. SKAL være en tom streng hvis ikke tilgjengelig"
    )
});

export const WorkItemSchema = z
  .object({
    department: z.string().nullable().describe("Avdeling, enhet eller team som utførte arbeidet"),
    employee: z.string().describe("Navn på ansatt eller kontraktør som utførte arbeidet"),
    project: z.string().nullable().describe("Prosjektnavn, prosjektnummer eller prosjektbeskrivelse knyttet til arbeidet"),
    activity: z.string().nullable().describe("Type aktivitet eller arbeidsbeskrivelse"),
    fromPeriod: z
      .string()
      .describe(
        "Starttidsperiode for arbeidet, 'HH:mm'. Hvis arbeidet startet på hel time, settes minuttene til '00'. Hvis minuttene ikke er tilgjengelig, settes denne til 'HH:00'"
      ),
    toPeriod: z
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
    payType: z.string().nullable().describe("Lønnsart eller lønnskode knyttet til arbeidet"),
    extras: z.string().describe("Tilleggskoder og beskrivelse av tillegg, SKAL være en tom streng hvis ikke tilgjengelig"),
    total: z.string().describe("Timer brukt totalt på arbeidsoppføringen, som desimaltall, bruk punktum som desimalskilletegn. Vil aldri være urimelig høyt. Alltid lavere enn 100. SKAL være en tom streng hvis ikke tilgjengelig"),
    machineHours: z.string().describe("Maskintimer med utstyrskoder brukt, som desimaltall, bruk punktum som desimalskilletegn. Vil aldri være urimelig høyt. Alltid lavere enn 100. SKAL være en tom streng hvis ikke tilgjengelig"),
    // NOTE: Disabled comments since on some invoices where the column height in some rows are different, makes the OCR read fewer lines...
/*    comments: z
      .string()
      .describe("Eventuelle kommentarer eller notater knyttet til arbeidsoppføringen, SKAL være en tom streng hvis ikke tilgjengelig"),*/
    pageNumber: z.number().describe("Sidenummer i PDF-dokumentet hvor arbeidsoppføringen ble funnet"),
    id: z.number().describe("Unikt løpenummer som starter på 1 og øker med 1 for hver oppføring")
  })
  .describe("Denne skal KUN opprettes når alle påkrevde felter er tilstede i OCR-resultatet.");

const WorkItemListSchema = z.array(WorkItemSchema);

export const InvoiceSchema = z.object({
  // Related time lists (if applicable)
  workLists: z.array(WorkItemSchema).describe("Liste over timelister knyttet til fakturaen. Denne skal være et tomt array hvis ingen timelister er funnet."),

  // Line items/products
  lineItems: z
    .array(ProductSchema)
    .nullable()
    .describe("Liste over alle produkter eller tjenester på fakturaen, kan være null hvis ikke tilgjengelig"),

  // Invoice header details
  invoice: z
    .object({
      number: z.string().nullable().describe("Fakturanummer"),
      date: z.string().nullable().describe("Fakturadato i format DD.MM.YYYY"),
      dueDate: z.string().nullable().describe("Forfallsdato i format DD.MM.YYYY"),
      kid: z.string().describe("KID-nummer, vanligvis 10 siffer. SKAL være en tom streng hvis ikke tilgjengelig")
    })
    .nullable()
    .describe("Denne skal KUN opprettes når minimum ett felt er tilstede i OCR-resultatet."),

  // Customer / Recipient details
  recipient: z
    .object({
      name: z.string().nullable().describe("Mottakers organisasjonsnavn eller personnavn"),
      streetAddress: z.string().nullable().describe("Gateadresse eller postboksadresse til mottakeren"),
      postalCode: z.string().nullable().describe("Postnummer til mottakeren"),
      city: z.string().nullable().describe("Poststed eller by til mottakeren")
    })
    .nullable()
    .describe("Denne skal KUN opprettes når minimum ett felt er tilstede i OCR-resultatet."),

  // Reference details
  reference: z
    .object({
      ourReference: z.string().describe("Vår referanse, kontaktperson hos avsender, SKAL være en tom streng hvis ikke tilgjengelig"),
      theirReference: z.string().describe("Deres referanse eller kontraktsnummer, SKAL være en tom streng hvis ikke tilgjengelig")
    })
    .nullable()
    .describe("Denne skal KUN opprettes når minimum ett felt er tilstede i OCR-resultatet."),

  // Totals and amounts
  totals: z
    .object({
      excludingMva: z.string().describe("Totalbeløp ekskl. MVA som desimaltall, bruk punktum som desimalskilletegn. SKAL være en tom streng hvis ikke tilgjengelig"),
      mvaAmount: z.string().describe("Total MVA-beløp som desimaltall, bruk punktum som desimalskilletegn. SKAL være en tom streng hvis ikke tilgjengelig"),
      includingMva: z.string().describe("Totalbeløp inkl. MVA som desimaltall, bruk punktum som desimalskilletegn. SKAL være en tom streng hvis ikke tilgjengelig")
    })
    .nullable()
    .describe("Denne skal KUN opprettes når minimum ett felt er tilstede i OCR-resultatet."),

  // Sender / Company details
  sender: z
    .object({
      name: z.string().describe("Avsenders organisasjonsnavn eller personnavn, SKAL være en tom streng hvis ikke tilgjengelig"),
      streetAddress: z.string().describe("Gateadresse eller postboksadresse til avsender, SKAL være en tom streng hvis ikke tilgjengelig"),
      orgNumber: z.string().describe("Organisasjonsnummer til avsender, SKAL være en tom streng hvis ikke tilgjengelig"),
      businessRegistration: z.string().describe("Foretaksregister informasjon, SKAL være en tom streng hvis ikke tilgjengelig"),
      euRegistration: z.string().describe("EU registreringsnummer for MVA, SKAL være en tom streng hvis ikke tilgjengelig"),
      mvaRegistration: z.string().describe("MVA registreringsnummer, SKAL være en tom streng hvis ikke tilgjengelig"),
      postalCode: z.string().describe("Postnummer til avsender, SKAL være en tom streng hvis ikke tilgjengelig"),
      city: z.string().describe("Poststed eller by til avsender, SKAL være en tom streng hvis ikke tilgjengelig"),
      phoneNumber: z.string().describe("Telefonnummer til avsender, SKAL være en tom streng hvis ikke tilgjengelig"),
      email: z.string().describe("E-postadresse til avsender, SKAL være en tom streng hvis ikke tilgjengelig"),
      website: z.string().describe("Nettsted URL til avsender, SKAL være en tom streng hvis ikke tilgjengelig")
    })
    .nullable()
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
