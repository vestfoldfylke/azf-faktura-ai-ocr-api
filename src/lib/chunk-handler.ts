import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import type { OCRResponse } from "@mistralai/mistralai/models/components";
import { logger } from "@vestfoldfylke/loglady";
import type { ZodSafeParseResult } from "zod";

import { WorkItemMongo, WorkItemMongoSchema } from "../types/zod-mongo.js";
import { ImageSchema, type Invoice, InvoiceSchema, type WorkItem, type WorkItemList } from "../types/zod-ocr.js";

import { base64Ocr } from "./mistral-ocr.js";
import { insertWorkItems } from "./mongodb-fns.js";

export const handleOcrChunk = async (filePath: string, outputResponseFilePath: string, ocrOutputDir: string): Promise<Invoice | null> => {
  const startTime: number = Date.now();
  logger.info("OCR processing file");

  const base64Data: string = readFileSync(filePath, { encoding: "base64" });
  const response: OCRResponse | null = await base64Ocr(base64Data, {
    bboxAnnotationFormat: ImageSchema,
    documentAnnotationFormat: InvoiceSchema,
    includeImageBase64: false
  });

  if (!response) {
    logger.warn("OCR processing failed for file '{FilePath}'. Skipping", filePath);
    return null;
  }

  writeFileSync(outputResponseFilePath, JSON.stringify(response, null, 2));

  const outputDocumentAnnotationFilePath: string | null = response.documentAnnotation
    ? `${ocrOutputDir}/${basename(filePath, ".pdf")}_da.json`
    : null;
  if (outputDocumentAnnotationFilePath) {
    writeFileSync(outputDocumentAnnotationFilePath, JSON.stringify(JSON.parse(response.documentAnnotation), null, 2));
  }

  const endTime: number = Date.now();
  logger.info(
    "OCR completed in {Duration} s. Output response written to '{OutputResponseFilePath}'. Output document annotation written to '{OutputDocumentAnnotationFilePath}'",
    (endTime - startTime) / 1000,
    outputResponseFilePath,
    outputDocumentAnnotationFilePath
  );

  if (!response.documentAnnotation) {
    return null;
  }

  const parsedInvoice: ZodSafeParseResult<Invoice> = InvoiceSchema.safeParse(JSON.parse(response.documentAnnotation));
  if (!parsedInvoice.success) {
    logger.errorException(parsedInvoice.error, "Failed to parse documentAnnotation into a type of Invoice file '{FilePath}. Skipping'", filePath);
    return null;
  }

  return parsedInvoice.data;
};

const getPdfPageNumber = (pdfChunk: number, maxPagesPerChunk: number, pageIndexInChunk: number): number => {
  return (pdfChunk - 1) * maxPagesPerChunk + pageIndexInChunk;
}

export const insertWorkItemsToDb = async (invoice: WorkItemList, invoiceNumber: string, pdfChunk: number, maxPagesPerChunk: number): Promise<void> => {
  if (invoice.length === 0) {
    logger.info("No work items found in document annotation.");
    return;
  }

  logger.info("Preparing {WorkItemsLength} work items for database insertion from documentAnnotation.", invoice.length);
  const workItemMongoList: WorkItemMongo[] = [];
  const workItemIdFailedList: number[] = [];
  invoice.forEach((workItem: WorkItem) => {
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
      totalHour: parseFloat((workItem.total || workItem.machineHours || "0").replace(",", "."))
    });

    if (!dbWorkItem.success) {
      logger.errorException(dbWorkItem.error, "Failed to parse WorkItem with id {WorkItemId} into WorkItemMongo. Skipping preparation for work item: {@WorkItem}", workItem.id, workItem);
      workItemIdFailedList.push(workItem.id);
      return;
    }

    workItemMongoList.push(dbWorkItem.data);
  });

  logger.info("Prepared {WorkItemsLength} work items for database insertion.", workItemMongoList.length);
  const insertedIds: string[] | void = await insertWorkItems(workItemMongoList);
  
  for (let i: number = 0; i < invoice.length; i++) {
    const workItem: WorkItem = invoice[i];

    if (workItemIdFailedList.includes(workItem.id)) {
      logger.error(
        "From: {FromDate} {FromPeriod} <-> {ToDate} {ToPeriod} ({Hours}) ({Employee})",
        workItem.fromDate,
        workItem.fromPeriod,
        workItem.toDate,
        workItem.toPeriod,
        workItem.total,
        workItem.employee
      );
      continue;
    }

    const insertedId: string = insertedIds && insertedIds[i] ? insertedIds[i] : "N/A";
    const workItemMongo: WorkItemMongo | undefined = workItemMongoList.find((wim: WorkItemMongo) => wim.id === workItem.id);
    if (!workItemMongo) {
      logger.error(
        "WorkItem from workItemMongoList not found... From: {FromDate} {FromPeriod} <-> {ToDate} {ToPeriod} ({Hours}) ({Employee})",
        workItem.fromDate,
        workItem.fromPeriod,
        workItem.toDate,
        workItem.toPeriod,
        workItem.total,
        workItem.employee
      );
      continue;
    }

    logger.debug(
      "From: {FromDate} {FromPeriod} <-> {ToDate} {ToPeriod} ({Hours}) ({Employee}) :: {InsertedId} :: Chunk: {PdfChunk} PageInChunk: {PdfChunkPageNumber} OriginalPageNumber: {PdfOriginalPageNumber}",
      workItem.fromDate,
      workItem.fromPeriod,
      workItem.toDate,
      workItem.toPeriod,
      workItem.total,
      workItem.employee,
      insertedId,
      workItemMongo.pdfChunk,
      workItemMongo.pdfChunkPageNumber,
      workItemMongo.pdfOriginalPageNumber
    );
  }
};
