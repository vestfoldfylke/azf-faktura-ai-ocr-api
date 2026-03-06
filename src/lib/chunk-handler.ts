import { logger } from "@vestfoldfylke/loglady";
import type { ZodSafeParseResult } from "zod";
import type { IAIAgent } from "../types/ai/ai-agent.js";
import { ImageSchema, InvoiceSchema, type WorkItem } from "../types/ai/zod-ocr.js";
import type { ItemsToInsert, OcrProcessedResponse } from "../types/faktura-ai.js";
import { WorkItemMongoSchema, type WorkMongoItem } from "../types/zod-mongo.js";

import { AIAgent } from "./ai/AIAgent.js";
import { insertWorkItemsToDb } from "./mongodb-fns.js";

const aiAgent: IAIAgent = new AIAgent();

type ValidWorkItem = {
  reason?: string;
  valid: boolean;
};

const getDateTime = (dateStr: string, timeStr: string): Date => {
  const dateParts: string[] = dateStr.split("."); // DD.MM.YYYY
  const timeParts: string[] = timeStr.split(":"); // HH:mm

  try {
    return new Date(
      parseInt(dateParts[2], 10),
      parseInt(dateParts[1], 10) - 1,
      parseInt(dateParts[0], 10),
      parseInt(timeParts[0], 10),
      parseInt(timeParts[1], 10),
      0
    );
  } catch (error) {
    logger.errorException(error, "Failed to parse date and time: {DateStr} {TimeStr}", dateStr, timeStr);
    throw error;
  }
};

const getPdfPageNumber = (pdfChunk: number, maxPagesPerChunk: number, pageIndexInChunk: number): number => {
  return (pdfChunk - 1) * maxPagesPerChunk + pageIndexInChunk;
};

const getTotalHours = (workItem: WorkItem): number => {
  const totalHours: number = parseFloat((workItem.total || workItem.machineHours || "0").replace(",", "."));
  if (totalHours > 0 && totalHours < 100) {
    logger.debug("{WorkItemId} - Total hours parsed directly: {TotalHours}", workItem.id, totalHours);
    return totalHours;
  }

  try {
    const fromDateParts: string[] = workItem.fromDate.split("."); // DD.MM.YYYY
    const fromTimeParts: string[] = workItem.fromTime.split(":"); // HH:mm
    const toDateParts: string[] = workItem.toDate.split("."); // DD.MM.YYYY
    const toTimeParts: string[] = workItem.toTime.split(":"); // HH:mm

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
  } catch (error) {
    logger.errorException(error, "Failed to calculate total hours for WorkItem {@WorkItem}", workItem);
    throw error;
  }
};

const isValidDate = new RegExp(/^(0[1-9]|[12]\d|3[01])\.(0[1-9]|1[0-2])\.\d{4}$/);
const isValidTime = new RegExp(/^[0-2][0-9]:[0-5][0-9]$/);

const getValidWorkItem = (workItem: WorkItem): ValidWorkItem => {
  if (
    !workItem.employee ||
    !Number.isNaN(Number.parseInt(workItem.employee)) || // 🤦‍♂️ to remove items where AI has clearly misunderstood and extracted a number as employee name
    !isValidTime.test(workItem.fromTime) ||
    !isValidTime.test(workItem.toTime) ||
    !isValidDate.test(workItem.fromDate) ||
    !isValidDate.test(workItem.toDate)
  ) {
    return {
      valid: false,
      reason: "Missing employee or invalid date/time format"
    };
  }

  return {
    valid: true
  };
};

export const handleOcrChunk = async (base64Data: string): Promise<OcrProcessedResponse | null> => {
  const startTime: number = Date.now();
  logger.info("OCR processing pdf chunk");

  const response: OcrProcessedResponse | null = await aiAgent.ocrToStructuredJson(base64Data, {
    bboxAnnotationFormat: ImageSchema,
    documentAnnotationFormat: InvoiceSchema,
    includeImageBase64: false
  });

  const endTime: number = Date.now();
  const durationSeconds: number = (endTime - startTime) / 1000;

  if (!response) {
    logger.warn("OCR processing failed for PDF chunk in {Duration} s. Skipping", durationSeconds);
    return null;
  }

  return response;
};

export const getItemsToInsert = (
  invoiceResponse: OcrProcessedResponse,
  invoiceNumber: string,
  pdfChunk: number,
  maxPagesPerChunk: number
): ItemsToInsert => {
  if (invoiceResponse.invoice.workLists.length === 0) {
    logger.info("No work items found in document annotation.");
    return {
      workItemList: invoiceResponse.invoice.workLists,
      workMongoItemList: [],
      failedWorkItemIds: [],
      skippedWorkItemIds: [],
      chunkIndex: pdfChunk
    };
  }

  logger.info("Preparing {WorkItemsLength} work items for database insertion from documentAnnotation.", invoiceResponse.invoice.workLists.length);
  const workMongoItemList: WorkMongoItem[] = [];
  const workItemIdFailedList: number[] = [];
  const workItemIdSkippedList: number[] = [];

  for (const workItem of invoiceResponse.invoice.workLists) {
    const validWorkItem: ValidWorkItem = getValidWorkItem(workItem);
    if (!validWorkItem.valid) {
      if (pdfChunk >= 3) {
        logger.warn(
          "WorkItem with id {WorkItemId} is {InvalidReason}. Skipping WorkItem. Since this is happening on ChunkIndex >= 3 ({ChunkIndex}), we assume this isn't a worklist 🤞: {@WorkItem}",
          workItem.id,
          validWorkItem.reason,
          pdfChunk,
          workItem
        );
        workItemIdSkippedList.push(workItem.id);
        continue;
      }

      logger.error(
        "WorkItem with id {WorkItemId} is {InvalidReason}. Skipping WorkItem. Since this is happening on ChunkIndex < 3 ({ChunkIndex}), we assume this is a worklist 🖕: {@WorkItem}",
        workItem.id,
        validWorkItem.reason,
        pdfChunk,
        workItem
      );
      workItemIdFailedList.push(workItem.id);
      continue;
    }

    const workMongoItem: WorkMongoItem = {
      activity: workItem.activity,
      aiVendorModel: invoiceResponse.vendorModel,
      aiVendorName: invoiceResponse.vendorName,
      department: workItem.department,
      employee: workItem.employee,
      extras: workItem.extras,
      fromDate: workItem.fromDate,
      fromTime: workItem.fromTime,
      fromDateTime: getDateTime(workItem.fromDate, workItem.fromTime),
      id: workItem.id,
      insertedDate: new Date(),
      invoiceNumber,
      pdfChunk,
      pdfChunkPageNumber: workItem.pageNumber,
      pdfOriginalPageNumber: getPdfPageNumber(pdfChunk, maxPagesPerChunk, workItem.pageNumber),
      project: workItem.project,
      toDate: workItem.toDate,
      toTime: workItem.toTime,
      toDateTime: getDateTime(workItem.toDate, workItem.toTime),
      totalHour: getTotalHours(workItem)
    };

    const dbWorkItem: ZodSafeParseResult<WorkMongoItem> = WorkItemMongoSchema.safeParse(workMongoItem);

    if (!dbWorkItem.success) {
      logger.errorException(
        dbWorkItem.error,
        "Failed to parse WorkItem with id {WorkItemId} into WorkMongoItem. Skipping preparation for work item: {@WorkItem}",
        workItem.id,
        workItem
      );
      workItemIdFailedList.push(workItem.id);
      continue;
    }

    workMongoItemList.push(dbWorkItem.data);
  }

  logger.info("Prepared {WorkItemsLength} work items for database insertion.", workMongoItemList.length);
  return {
    workItemList: invoiceResponse.invoice.workLists,
    workMongoItemList,
    failedWorkItemIds: workItemIdFailedList,
    skippedWorkItemIds: workItemIdSkippedList,
    chunkIndex: pdfChunk
  };
};

export const insertWorkItems = async (itemsToInsert: ItemsToInsert): Promise<string[]> => {
  logger.info("Inserting {WorkItemsLength} work items to database.", itemsToInsert.workMongoItemList.length);
  const insertedIds: string[] = await insertWorkItemsToDb(itemsToInsert.workMongoItemList);

  for (let i: number = 0; i < itemsToInsert.workItemList.length; i++) {
    const workItem: WorkItem = itemsToInsert.workItemList[i];

    if (itemsToInsert.failedWorkItemIds.includes(workItem.id)) {
      logger.error(
        "Chunk: {ChunkIndex} :: {WorkItemId} - From: {FromDate} {FromTime} <-> {ToDate} {ToTime} ({Hours}) ({Employee})",
        itemsToInsert.chunkIndex,
        workItem.id,
        workItem.fromDate,
        workItem.fromTime,
        workItem.toDate,
        workItem.toTime,
        workItem.total || workItem.machineHours || "0",
        workItem.employee
      );
      continue;
    }

    if (itemsToInsert.skippedWorkItemIds.includes(workItem.id)) {
      logger.warn(
        "Chunk: {ChunkIndex} :: {WorkItemId} - From: {FromDate} {FromTime} <-> {ToDate} {ToTime} ({Hours}) ({Employee})",
        itemsToInsert.chunkIndex,
        workItem.id,
        workItem.fromDate,
        workItem.fromTime,
        workItem.toDate,
        workItem.toTime,
        workItem.total || workItem.machineHours || "0",
        workItem.employee
      );
      continue;
    }

    const insertedId: string = insertedIds?.[i] ? insertedIds[i] : "N/A";
    const workItemMongo: WorkMongoItem | undefined = itemsToInsert.workMongoItemList.find((wim: WorkMongoItem) => wim.id === workItem.id);
    if (!workItemMongo) {
      logger.error(
        "Chunk: {ChunkIndex} :: WorkItem with WorkItemId {WorkItemId} from workItemMongoList not found... From: {FromDate} {FromTime} <-> {ToDate} {ToTime} ({Hours}) ({Employee})",
        itemsToInsert.chunkIndex,
        workItem.id,
        workItem.fromDate,
        workItem.fromTime,
        workItem.toDate,
        workItem.toTime,
        workItem.total || workItem.machineHours || "0",
        workItem.employee
      );
      continue;
    }

    logger.info(
      "Chunk: {ChunkIndex} :: {WorkItemId} - From: {FromDate} {FromTime} <-> {ToDate} {ToTime} (OcrHours: {Hours}, ParsedHours: {ParsedHours}) ({Employee}) :: {InsertedId} :: Chunk: {PdfChunk} PageInChunk: {PdfChunkPageNumber} OriginalPageNumber: {PdfOriginalPageNumber}",
      itemsToInsert.chunkIndex,
      workItem.id,
      workItem.fromDate,
      workItem.fromTime,
      workItem.toDate,
      workItem.toTime,
      workItem.total || workItem.machineHours || "0",
      workItemMongo.totalHour,
      workItem.employee,
      insertedId,
      workItemMongo.pdfChunk,
      workItemMongo.pdfChunkPageNumber,
      workItemMongo.pdfOriginalPageNumber
    );
  }

  return insertedIds;
};
