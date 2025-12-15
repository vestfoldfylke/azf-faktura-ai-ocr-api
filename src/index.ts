import { type Dirent, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { logger } from "@vestfoldfylke/loglady";

import { OCRResponse } from "@mistralai/mistralai/models/components";

import { createDirectoryIfNotExists } from "./lib/output-fns.js";
import { base64Ocr } from "./lib/mistral-ocr.js";
import { chunkPdf } from "./lib/pdf-fns.js";

const outputPath: string = "./output";
const invoicePath: string = `${outputPath}/invoices`;
const chunkedInvoiceDir: string = `${outputPath}/chunks`;
const ocrOutputDir: string = `${outputPath}/ocr`;

createDirectoryIfNotExists(invoicePath);
createDirectoryIfNotExists(chunkedInvoiceDir);
createDirectoryIfNotExists(ocrOutputDir);

const pdfs: Dirent[] = readdirSync(invoicePath, { recursive: false, withFileTypes: true })
  .filter((f: Dirent) => f.isFile() && f.name.toLowerCase().endsWith(".pdf"));

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
    const startTime = Date.now();
    logger.info("[{FileIndex} / {FileLength}] :: OCR processing file", fileIndex++, chunkedFilePaths.length);

    const base64Data: string = readFileSync(filePath, { encoding: "base64" });
    const response: OCRResponse = await base64Ocr(base64Data);

    const outputFilePath = `${ocrOutputDir}/${basename(filePath, ".pdf")}.json`;
    writeFileSync(outputFilePath, JSON.stringify(response, null, 2));

    const endTime = Date.now();
    logger.info("OCR completed in {Duration} ms. Output written to '{OutputFilePath}'", (endTime - startTime), outputFilePath);
  }
}
