import { z } from "zod";

// Document Annotation response formats
const ProductSchema = z.object({
  productNumber: z.string().nullable().describe("Produktnummer eller produktkode, kan være null hvis ikke tilgjengelig"),
  description: z.string().describe("Beskrivelse av produktet eller tjenesten"),
  quantity: z.number().nullable().describe("Antall enheter av produktet eller tjenesten som desimaltall, kan være null hvis ikke tilgjengelig"),
  unit: z.string().nullable().describe("Enhet for mengde, f.eks. 'stk', 'kg', kan være null hvis ikke tilgjengelig"),
  unitPrice: z.number().nullable().describe("Pris per enhet av produktet eller tjenesten som desimaltall. Kan være skrevet som et helt tall eller med mellomrom mellom hver tusen. Kan være null hvis ikke tilgjengelig"),
  totalPrice: z.number().nullable().describe("Totalpris for linjeelementet (quantity * unitPrice) som desimaltall. Kan være skrevet som et helt tall eller med mellomrom mellom hver tusen. Kan være null hvis ikke tilgjengelig")
});

const WorkListSchema = z.object({
  date: z.string().describe("Dato for arbeidsoppføringen i format DD.MM.YYYY"),
  department: z.string().describe("Avdeling, enhet eller team som utførte arbeidet"),
  employee: z.string().describe("Navn på ansatt eller kontraktør som utførte arbeidet"),
  project: z.string().describe("Prosjektnavn, prosjektnummer eller prosjektbeskrivelse knyttet til arbeidet"),
  activity: z.string().describe("Type aktivitet eller arbeidsbeskrivelse"),
  period: z.string().describe("Tidsperiode for arbeidet, 'HH:mm - HH:mm'"),
  fromDate: z.string().describe("Startdato for arbeidsperioden i format DD.MM.YYYY, basert på dato-feltet når arbeidet startet"),
  toDate: z.string().describe("Sluttdato for arbeidsperioden i format DD.MM.YYYY. Samme som fromDate hvis arbeidet ble utført innenfor samme dag. Hvis sluttiden går over midnatt, settes denne til neste dag."),
  payType: z.string().describe("Lønnsart eller lønnskode knyttet til arbeidet"),
  extras: z.string().nullable().describe("Tilleggskoder og beskrivelse av tillegg, kan være null hvis ikke tilgjengelig"),
  total: z.string().nullable().describe("Tid brukt totalt på arbeidsoppføringen, som desimaltall, kan være null hvis ikke tilgjengelig"),
  machineHours: z.number().nullable().describe("Maskintimer med utstyrskoder brukt, som desimaltall, kan være null hvis ikke tilgjengelig"),
  comments: z.string().nullable().describe("Eventuelle kommentarer eller notater knyttet til arbeidsoppføringen, kan være null hvis ikke tilgjengelig"),
  page_number: z.number().describe("Sidenummer i PDF-dokumentet hvor arbeidsoppføringen ble funnet")
});

export const InvoiceSchema = z.object({
  // Related time lists (if applicable)
  workLists: z.array(WorkListSchema).describe("Liste over timelister knyttet til fakturaen"),

  // Line items/products
  lineItems: z.array(ProductSchema).nullable().describe("Liste over alle produkter eller tjenester på fakturaen, kan være null hvis ikke tilgjengelig"),

  // Invoice header details
  invoice: z.object({
    number: z.string().describe("Fakturanummer"),
    date: z.string().describe("Fakturadato i format DD.MM.YYYY"),
    dueDate: z.string().describe("Forfallsdato i format DD.MM.YYYY"),
    kid: z.string().nullable().describe("KID-nummer, vanligvis 10 siffer. Kan være null hvis ikke tilgjengelig")
  }),

  // Customer / Recipient details
  recipient: z.object({
    name: z.string().describe("Mottakers organisasjonsnavn eller personnavn"),
    streetAddress: z.string().describe("Gateadresse eller postboksadresse til mottakeren"),
    postalCode: z.string().describe("Postnummer til mottakeren"),
    city: z.string().describe("Poststed eller by til mottakeren")
  }),
  
  // Reference details
  reference: z.object({
    ourReference: z.string().nullable().describe("Vår referanse, kontaktperson hos avsender, kan være null hvis ikke tilgjengelig"),
    theirReference: z.string().nullable().describe("Deres referanse eller kontraktsnummer, kan være null hvis ikke tilgjengelig")
  }),
  
  // Totals and amounts
  totals: z.object({
    excludingMva: z.number().nullable().describe("Totalbeløp ekskl. MVA som desimaltall, kan være null hvis ikke tilgjengelig"),
    mvaAmount: z.number().nullable().describe("Total MVA-beløp som desimaltall, kan være null hvis ikke tilgjengelig"),
    includingMva: z.number().nullable().describe("Totalbeløp inkl. MVA som desimaltall, kan være null hvis ikke tilgjengelig")
  }),
  
  // Sender / Company details
  sender: z.object({
    name: z.string().nullable().describe("Avsenders organisasjonsnavn eller personnavn, kan være null hvis ikke tilgjengelig"),
    streetAddress: z.string().nullable().describe("Gateadresse eller postboksadresse til avsender, kan være null hvis ikke tilgjengelig"),
    orgNumber: z.string().nullable().describe("Organisasjonsnummer til avsender, kan være null hvis ikke tilgjengelig"),
    businessRegistration: z.string().nullable().describe("Foretaksregister informasjon, kan være null hvis ikke tilgjengelig"),
    euRegistration: z.string().nullable().describe("EU registreringsnummer for MVA, kan være null hvis ikke tilgjengelig"),
    mvaRegistration: z.string().nullable().describe("MVA registreringsnummer, kan være null hvis ikke tilgjengelig"),
    postalCode: z.string().nullable().describe("Postnummer til avsender, kan være null hvis ikke tilgjengelig"),
    city: z.string().nullable().describe("Poststed eller by til avsender, kan være null hvis ikke tilgjengelig"),
    phoneNumber: z.string().nullable().describe("Telefonnummer til avsender, kan være null hvis ikke tilgjengelig"),
    email: z.string().nullable().describe("E-postadresse til avsender, kan være null hvis ikke tilgjengelig"),
    website: z.string().nullable().describe("Nettsted URL til avsender, kan være null hvis ikke tilgjengelig")
  })
});

// BBox Annotation response formats
export const ImageSchema = z.object({
  index: z.number().describe("Index of the image, i guess."),
  base64: z.string().describe("Base64 encoded image data."),
  shortDescription: z.string().describe("A description in Norwegian describing the image."),
  summary: z.string().describe("Summarize the image.")
});