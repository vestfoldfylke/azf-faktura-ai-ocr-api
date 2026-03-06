import { z } from "zod";

export const WorkItemMongoSchema = z.object({
  activity: z.string().nullish(),
  aiVendorModel: z.string(),
  aiVendorName: z.string(),
  department: z.string().nullish(),
  employee: z.string(),
  extras: z.string().nullish(),
  fromDate: z.string(),
  fromTime: z.string(),
  fromDateTime: z.date(),
  id: z.number(),
  insertedDate: z.date(),
  invoiceNumber: z.string(),
  pdfChunk: z.number(),
  pdfChunkPageNumber: z.number(),
  pdfOriginalPageNumber: z.number(),
  project: z.string().nullish(),
  toDate: z.string(),
  toTime: z.string(),
  toDateTime: z.date(),
  totalHour: z.number()
});

export type WorkMongoItem = z.infer<typeof WorkItemMongoSchema>;
