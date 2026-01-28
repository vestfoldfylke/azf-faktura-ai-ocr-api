import { logger } from "@vestfoldfylke/loglady";
import { PDFDocument } from "pdf-lib";

/**
 * Chunks a PDF file into smaller PDFs based on the specified maximum number of pages.
 *
 * @return Array of file paths for the chunked PDF files. Or an array with the moved/copied file path if no chunking was needed.
 */
export const chunkPdf = async (base64Data: string, maxPages: number = 4): Promise<string[]> => {
  const pdfDoc: PDFDocument = await PDFDocument.load(base64Data);
  const pageCount: number = pdfDoc.getPageCount();

  if (pageCount <= maxPages) {
    logger.info("PDF has {PageCount} pages which is less than or equal to maxPages ({MaxPages}). Chunking not needed.", pageCount, maxPages);

    return [base64Data];
  }

  logger.info("PDF has {PageCount} pages which is more than maxPages ({MaxPages}). Chunking...", pageCount, maxPages);

  const pdfChunks: string[] = [];
  let chunkIndex: number = 1;
  for (let i: number = 0; i < pageCount; i += maxPages) {
    const newPdf: PDFDocument = await PDFDocument.create();
    const end: number = Math.min(i + maxPages, pageCount);
    const start: number = i + 1;

    for (let j: number = i; j < end; j++) {
      const [copiedPage] = await newPdf.copyPages(pdfDoc, [j]);
      newPdf.addPage(copiedPage);
    }

    const newPdfBase64: string = await newPdf.saveAsBase64();
    pdfChunks.push(newPdfBase64);
    logger.info("Created chunk {ChunkIndex} with pages {PageStart}-{PageEnd}", chunkIndex, start, end);
    chunkIndex++;
  }

  return pdfChunks;
};
