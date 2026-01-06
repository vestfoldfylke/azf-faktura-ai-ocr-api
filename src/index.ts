import { type Dirent, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import type { OCRResponse } from "@mistralai/mistralai/models/components";
import { logger } from "@vestfoldfylke/loglady";

import { base64Ocr } from "./lib/mistral-ocr.js";
import { createDirectoryIfNotExists, fileExists } from "./lib/output-fns.js";
import { chunkPdf } from "./lib/pdf-fns.js";

import { ImageSchema, InvoiceSchema } from "./types/zod-ocr.js";

const invoicePath: string = "./input";
const outputPath: string = "./output";
const chunkedInvoiceDir: string = `${outputPath}/chunks`;
const ocrOutputDir: string = `${outputPath}/ocr`;

createDirectoryIfNotExists(invoicePath);
createDirectoryIfNotExists(chunkedInvoiceDir);
createDirectoryIfNotExists(ocrOutputDir);

const PROCESS_ALREADY_PROCESSED_FILES: boolean = process.env.OCR_PROCESS_ALREADY_PROCESSED_FILES?.toLowerCase() === "true";

const pdfs: Dirent[] = readdirSync(invoicePath, { recursive: false, withFileTypes: true }).filter(
  (f: Dirent) => f.isFile() && f.name.toLowerCase().endsWith(".pdf")
);

for (const pdf of pdfs) {
  const pdfPath = `${pdf.parentPath}/${pdf.name}`;

  logger.logConfig({
    prefix: pdfPath
  });

  // PDF handling
  logger.info("Processing file");
  const chunkedFilePaths: string[] = await chunkPdf(pdfPath, chunkedInvoiceDir, 4, false);
  logger.info("Is file chunked? {IsChunked}. Chunks: {@Chunks}", chunkedFilePaths.length > 1, chunkedFilePaths);

  // OCR handling
  let fileIndex = 1;
  for (const filePath of chunkedFilePaths) {
    const outputResponseFilePath = `${ocrOutputDir}/${basename(filePath, ".pdf")}.json`;
    if (fileExists(outputResponseFilePath)) {
      if (!PROCESS_ALREADY_PROCESSED_FILES) {
        logger.info(
          "[{FileIndex} / {FileLength}] :: OCR output file '{OutputResponseFilePath}' already exists. Skipping OCR processing for this file.",
          fileIndex,
          chunkedFilePaths.length,
          outputResponseFilePath
        );
        fileIndex++;
        continue;
      }

      logger.info(
        "[{FileIndex} / {FileLength}] :: OCR output file '{OutputResponseFilePath}' already exists. File will be processed again",
        fileIndex,
        chunkedFilePaths.length,
        outputResponseFilePath
      );
    }

    const startTime = Date.now();
    logger.info("[{FileIndex} / {FileLength}] :: OCR processing file", fileIndex++, chunkedFilePaths.length);

    const base64Data: string = readFileSync(filePath, { encoding: "base64" });
    const response: OCRResponse | null = await base64Ocr(base64Data, {
      bboxAnnotationFormat: ImageSchema,
      documentAnnotationFormat: InvoiceSchema,
      includeImageBase64: false
    });

    if (!response) {
      logger.warn("OCR processing failed for file '{FilePath}'. Skipping", filePath);
      continue;
    }

    writeFileSync(outputResponseFilePath, JSON.stringify(response, null, 2));

    const outputDocumentAnnotationFilePath: string | null = response.documentAnnotation
      ? `${ocrOutputDir}/${basename(filePath, ".pdf")}_da.json`
      : null;
    if (outputDocumentAnnotationFilePath) {
      writeFileSync(outputDocumentAnnotationFilePath, JSON.stringify(JSON.parse(response.documentAnnotation), null, 2));
    }

    const endTime = Date.now();
    logger.info(
      "OCR completed in {Duration} ms. Output response written to '{OutputResponseFilePath}'. Output document annotation written to '{OutputDocumentAnnotationFilePath}'",
      endTime - startTime,
      outputResponseFilePath,
      outputDocumentAnnotationFilePath
    );
    fileIndex++;
  }
}
