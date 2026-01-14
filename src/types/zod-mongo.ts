import { z } from "zod";

export const WorkItemMongoSchema = z.object({
  activity: z.string().nullable(),
  department: z.string().nullable(),
  employee: z.string(),
  extras: z.string().nullable(),
  fromDate: z.string(),
  fromPeriod: z.string(),
  id: z.number().optional(),
  insertedDate: z.date(),
  invoiceNumber: z.string(),
  pdfChunk: z.number(),
  pdfChunkPageNumber: z.number(),
  pdfOriginalPageNumber: z.number(),
  project: z.string().nullable(),
  toDate: z.string(),
  toPeriod: z.string(),
  totalHour: z.number()
});

export type WorkItemMongo = z.infer<typeof WorkItemMongoSchema>;
