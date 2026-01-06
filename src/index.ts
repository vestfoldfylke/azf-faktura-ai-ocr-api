import { type Dirent, readdirSync } from "node:fs";
import { basename } from "node:path";
import { logger } from "@vestfoldfylke/loglady";

import { getMaxPagesPerChunk, processAlreadyProcessedFiles } from "./config.js";
import { handleOcrChunk } from "./lib/chunk-handler.js";
import { createDirectoryIfNotExists, fileExists } from "./lib/output-fns.js";
import { chunkPdf } from "./lib/pdf-fns.js";

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
  logger.info("Processing PDF file");
  const chunkedFilePaths: string[] = await chunkPdf(pdfPath, chunkedInvoiceDir, MAX_PAGES_PER_CHUNK, false);
  logger.info("Is file chunked? {IsChunked}. Chunks: {ChunkLength}", chunkedFilePaths.length > 1, chunkedFilePaths.length);

  // chunk handling
  const chunkStartTime: number = Date.now();
  for (let i: number = 0; i < chunkedFilePaths.length; i++) {
    const filePath: string = chunkedFilePaths[i];
    const fileIndex: number = i + 1;
    const outputResponseFilePath: string = `${ocrOutputDir}/${basename(filePath, ".pdf")}.json`;

    logger.logConfig({
      prefix: `${pdfPath} - ${basename(filePath)} - [${fileIndex} / ${chunkedFilePaths.length}]`
    });

    if (fileExists(outputResponseFilePath)) {
      if (!PROCESS_ALREADY_PROCESSED_FILES) {
        logger.info("OCR output file '{OutputResponseFilePath}' already exists. Skipping OCR processing for this file.", outputResponseFilePath);
        continue;
      }

      logger.info("OCR output file '{OutputResponseFilePath}' already exists. File will be processed again", outputResponseFilePath);
    }

    await handleOcrChunk(filePath, outputResponseFilePath, ocrOutputDir);
  }

  logger.logConfig({
    prefix: pdfPath
  });

  const chunkEndTime: number = Date.now();
  logger.info(
    "Chunk processing for {ChunkLength} file(s) completed in {Duration} minutes",
    chunkedFilePaths.length,
    (chunkEndTime - chunkStartTime) / 1000 / 60
  );
}
