import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import type { OCRResponse } from "@mistralai/mistralai/models/components";
import { logger } from "@vestfoldfylke/loglady";

import { ImageSchema, InvoiceSchema } from "../types/zod-ocr.js";

import { base64Ocr } from "./mistral-ocr.js";

export const handleOcrChunk = async (filePath: string, outputResponseFilePath: string, ocrOutputDir: string): Promise<OCRResponse | null> => {
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

  return response;
};
