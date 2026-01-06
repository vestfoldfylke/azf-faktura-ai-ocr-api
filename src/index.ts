import { type Dirent, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import type { OCRResponse } from "@mistralai/mistralai/models/components";
import { logger } from "@vestfoldfylke/loglady";

import { getMaxPagesPerChunk, processAlreadyProcessedFiles } from "./config.js";
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

const MAX_PAGES_PER_CHUNK: number = getMaxPagesPerChunk();
const PROCESS_ALREADY_PROCESSED_FILES: boolean = processAlreadyProcessedFiles();

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
  const chunkedFilePaths: string[] = await chunkPdf(pdfPath, chunkedInvoiceDir, MAX_PAGES_PER_CHUNK, false);
  logger.info("Is file chunked? {IsChunked}. Chunks: {ChunkLength}", chunkedFilePaths.length > 1, chunkedFilePaths.length);

  // OCR handling
  const ocrStartTime: number = Date.now();
  for (let i: number = 0; i < chunkedFilePaths.length; i++) {
    const filePath: string = chunkedFilePaths[i];
    const fileIndex: number = i + 1;
    const outputResponseFilePath: string = `${ocrOutputDir}/${basename(filePath, ".pdf")}.json`;

    if (fileExists(outputResponseFilePath)) {
      if (!PROCESS_ALREADY_PROCESSED_FILES) {
        logger.info(
          "[{FileIndex} / {FileLength}] :: OCR output file '{OutputResponseFilePath}' already exists. Skipping OCR processing for this file.",
          fileIndex,
          chunkedFilePaths.length,
          outputResponseFilePath
        );
        continue;
      }

      logger.info(
        "[{FileIndex} / {FileLength}] :: OCR output file '{OutputResponseFilePath}' already exists. File will be processed again",
        fileIndex,
        chunkedFilePaths.length,
        outputResponseFilePath
      );
    }

    const startTime: number = Date.now();
    logger.info("[{FileIndex} / {FileLength}] :: OCR processing file", fileIndex, chunkedFilePaths.length);

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

    const endTime: number = Date.now();
    logger.info(
      "OCR completed in {Duration} s. Output response written to '{OutputResponseFilePath}'. Output document annotation written to '{OutputDocumentAnnotationFilePath}'",
      (endTime - startTime) / 1000,
      outputResponseFilePath,
      outputDocumentAnnotationFilePath
    );
  }

  const ocrEndTime: number = Date.now();
  logger.info("OCR processing for {ChunkLength} file(s) completed in {Duration} s", chunkedFilePaths.length, (ocrEndTime - ocrStartTime) / 1000);
}
