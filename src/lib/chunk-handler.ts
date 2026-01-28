import type { OCRResponse } from "@mistralai/mistralai/models/components";
import { logger } from "@vestfoldfylke/loglady";
import type { ZodSafeParseResult } from "zod";

import { type WorkItemMongo, WorkItemMongoSchema } from "../types/zod-mongo.js";
import { ImageSchema, type Invoice, InvoiceSchema, type WorkItem, type WorkItemList } from "../types/zod-ocr.js";

import { base64Ocr } from "./mistral-ocr.js";
import { insertWorkItems } from "./mongodb-fns.js";

const getPdfPageNumber = (pdfChunk: number, maxPagesPerChunk: number, pageIndexInChunk: number): number => {
  return (pdfChunk - 1) * maxPagesPerChunk + pageIndexInChunk;
};

const getTotalHours = (workItem: WorkItem): number => {
  const totalHours: number = parseFloat((workItem.total || workItem.machineHours || "0").replace(",", "."));
  if (totalHours > 0 && totalHours < 100) {
    logger.debug("{WorkItemId} - Total hours parsed directly: {TotalHours}", workItem.id, totalHours);
    return totalHours;
  }

  const fromDateParts: string[] = workItem.fromDate.split("."); // DD.MM.YYYY
  const fromTimeParts: string[] = workItem.fromPeriod.split(":"); // HH:mm
  const toDateParts: string[] = workItem.toDate.split("."); // DD.MM.YYYY
  const toTimeParts: string[] = workItem.toPeriod.split(":"); // HH:mm

  const fromDate: Date = new Date(
    parseInt(fromDateParts[2], 10),
    parseInt(fromDateParts[1], 10) - 1,
    parseInt(fromDateParts[0], 10),
    parseInt(fromTimeParts[0], 10),
    parseInt(fromTimeParts[1], 10)
  );

  const toDate: Date = new Date(
    parseInt(toDateParts[2], 10),
    parseInt(toDateParts[1], 10) - 1,
    parseInt(toDateParts[0], 10),
    parseInt(toTimeParts[0], 10),
    parseInt(toTimeParts[1], 10)
  );

  const diffMs: number = toDate.getTime() - fromDate.getTime();
  const diffHours: number = diffMs / (1000 * 60 * 60);
  const totalHoursParsed: number = parseFloat(diffHours.toFixed(2));

  logger.debug(
    "{WorkItemId} - Total hours parsed from DateTime since total hours from OCR is most likely wrong: TotalHoursOcr: {TotalHoursOcr}, TotalHoursParsed: {TotalHoursParsed}, {FromDate} <--> {ToDate}",
    workItem.id,
    totalHours,
    totalHoursParsed,
    fromDate.toISOString(),
    toDate.toISOString()
  );
  return totalHoursParsed;
};

export const handleOcrChunk = async (base64Data: string): Promise<Invoice | null> => {
  const startTime: number = Date.now();
  logger.info("OCR processing pdf");

  const response: OCRResponse | null = await base64Ocr(base64Data, {
    bboxAnnotationFormat: ImageSchema,
    documentAnnotationFormat: InvoiceSchema,
    includeImageBase64: false
  });

  if (!response) {
    logger.warn("OCR processing failed for pdf. Skipping");
    return null;
  }

  const endTime: number = Date.now();
  logger.info("OCR completed in {Duration} s.", (endTime - startTime) / 1000);

  if (!response.documentAnnotation) {
    return null;
  }

  const parsedInvoice: ZodSafeParseResult<Invoice> = InvoiceSchema.safeParse(JSON.parse(response.documentAnnotation));
  if (!parsedInvoice.success) {
    logger.errorException(parsedInvoice.error, "Failed to parse documentAnnotation into a type of Invoice. Skipping'");
    return null;
  }

  return parsedInvoice.data;
};

export const insertWorkItemsToDb = async (
  invoice: WorkItemList,
  invoiceNumber: string,
  pdfChunk: number,
  maxPagesPerChunk: number
): Promise<boolean> => {
  if (invoice.length === 0) {
    logger.info("No work items found in document annotation.");
    return true;
  }

  logger.info("Preparing {WorkItemsLength} work items for database insertion from documentAnnotation.", invoice.length);
  const workItemMongoList: WorkItemMongo[] = [];
  const workItemIdFailedList: number[] = [];
  for (const workItem of invoice) {
    const dbWorkItem: ZodSafeParseResult<WorkItemMongo> = WorkItemMongoSchema.safeParse({
      activity: workItem.activity,
      department: workItem.department,
      employee: workItem.employee,
      extras: workItem.extras,
      fromDate: workItem.fromDate,
      fromPeriod: workItem.fromPeriod,
      id: workItem.id,
      insertedDate: new Date(),
      invoiceNumber,
      pdfChunk,
      pdfChunkPageNumber: workItem.pageNumber,
      pdfOriginalPageNumber: getPdfPageNumber(pdfChunk, maxPagesPerChunk, workItem.pageNumber),
      project: workItem.project,
      toDate: workItem.toDate,
      toPeriod: workItem.toPeriod,
      totalHour: getTotalHours(workItem)
    });

    if (!dbWorkItem.success) {
      logger.errorException(
        dbWorkItem.error,
        "Failed to parse WorkItem with id {WorkItemId} into WorkItemMongo. Skipping preparation for work item: {@WorkItem}",
        workItem.id,
        workItem
      );
      workItemIdFailedList.push(workItem.id);
      continue;
    }

    workItemMongoList.push(dbWorkItem.data);
  }

  logger.info("Prepared {WorkItemsLength} work items for database insertion.", workItemMongoList.length);
  const insertedIds: string[] = await insertWorkItems(workItemMongoList);

  for (let i: number = 0; i < invoice.length; i++) {
    const workItem: WorkItem = invoice[i];

    if (workItemIdFailedList.includes(workItem.id)) {
      logger.error(
        "{WorkItemId} - From: {FromDate} {FromPeriod} <-> {ToDate} {ToPeriod} ({Hours}) ({Employee})",
        workItem.id,
        workItem.fromDate,
        workItem.fromPeriod,
        workItem.toDate,
        workItem.toPeriod,
        workItem.total || workItem.machineHours || "0",
        workItem.employee
      );
      continue;
    }

    const insertedId: string = insertedIds?.[i] ? insertedIds[i] : "N/A";
    const workItemMongo: WorkItemMongo | undefined = workItemMongoList.find((wim: WorkItemMongo) => wim.id === workItem.id);
    if (!workItemMongo) {
      logger.error(
        "WorkItem with WorkItemId {WorkItemId} from workItemMongoList not found... From: {FromDate} {FromPeriod} <-> {ToDate} {ToPeriod} ({Hours}) ({Employee})",
        workItem.id,
        workItem.fromDate,
        workItem.fromPeriod,
        workItem.toDate,
        workItem.toPeriod,
        workItem.total || workItem.machineHours || "0",
        workItem.employee
      );
      continue;
    }

    logger.info(
      "{WorkItemId} - From: {FromDate} {FromPeriod} <-> {ToDate} {ToPeriod} (OcrHours: {Hours}, ParsedHours: {ParsedHours}) ({Employee}) :: {InsertedId} :: Chunk: {PdfChunk} PageInChunk: {PdfChunkPageNumber} OriginalPageNumber: {PdfOriginalPageNumber}",
      workItem.id,
      workItem.fromDate,
      workItem.fromPeriod,
      workItem.toDate,
      workItem.toPeriod,
      workItem.total || workItem.machineHours || "0",
      workItemMongo.totalHour,
      workItem.employee,
      insertedId,
      workItemMongo.pdfChunk,
      workItemMongo.pdfChunkPageNumber,
      workItemMongo.pdfOriginalPageNumber
    );
  }

  return insertedIds.length > 0;
};
