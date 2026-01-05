import { copyFileSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { logger } from "@vestfoldfylke/loglady";
import { PDFDocument } from "pdf-lib";

/**
 * Chunks a PDF file into smaller PDFs based on the specified maximum number of pages.
 *
 * @param path - The path to the input PDF file.
 * @param outputDir - The directory where the chunked PDF files will be saved.
 * @param maxPages - The maximum number of pages allowed in each chunked PDF. Default is 4.
 * @param moveOnNoChunk - If true and the PDF does not need chunking, the original file will be moved to the output directory.<br />If false and the PDF does not need chunking, the original file will be copied to the output directory.<br />Default is true.
 *
 * @return Array of file paths for the chunked PDF files. Or an array with the moved/copied file path if no chunking was needed.
 */
export const chunkPdf = async (path: string, outputDir: string, maxPages: number = 4, moveOnNoChunk: boolean = true): Promise<string[]> => {
  const fileBuffer = readFileSync(path);
  const pdfDoc: PDFDocument = await PDFDocument.load(fileBuffer);
  const pageCount: number = pdfDoc.getPageCount();

  if (pageCount <= maxPages) {
    const movedPath: string = `./${join(outputDir, basename(path.toLowerCase()))}`;
    logger.info("PDF has {PageCount} pages which is less than or equal to maxPages ({MaxPages}). Chunking not needed.", pageCount, maxPages);

    if (moveOnNoChunk) {
      renameSync(path, movedPath);
      return [movedPath];
    }

    copyFileSync(path, movedPath);
    return [movedPath];
  }

  logger.info("PDF has {PageCount} pages which is more than maxPages ({MaxPages}). Chunking...", pageCount, maxPages);

  let chunkIndex: number = 1;
  const filePaths: string[] = [];
  for (let i = 0; i < pageCount; i += maxPages) {
    const newPdf = await PDFDocument.create();
    const end: number = Math.min(i + maxPages, pageCount);

    for (let j = i; j < end; j++) {
      const [copiedPage] = await newPdf.copyPages(pdfDoc, [j]);
      newPdf.addPage(copiedPage);
    }

    const newPdfBytes: Uint8Array = await newPdf.save();
    const outputFilePath: string = `./${join(outputDir, `${basename(path.toLowerCase(), ".pdf")}_chunk_${chunkIndex}.pdf`)}`;
    filePaths.push(outputFilePath);

    try {
      writeFileSync(outputFilePath, newPdfBytes);
      logger.info("Created chunk '{OutputFilePath}' with pages {PageStart}-{PageEnd}", outputFilePath, i + 1, end);
    } catch (error) {
      logger.errorException(error, "Failed to write chunk file '{OutputFilePath}'", outputFilePath);
    } finally {
      chunkIndex++;
    }
  }

  return filePaths;
};
