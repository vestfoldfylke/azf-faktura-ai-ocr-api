import { Mistral } from "@mistralai/mistralai";

import { OCRResponse, ResponseFormat } from "@mistralai/mistralai/models/components";

import { getMistralApiKey } from "../config.js";

const apiKey: string = getMistralApiKey();

const mistralClient = new Mistral({ apiKey });

type OcrRequestOptions = {
  /** class used for Image annotation */
  bboxAnnotationFormat?: ResponseFormat;
  /** class used for Document annotation */
  documentAnnotationFormat?: ResponseFormat;
  imageLimit?: number;
  imageMinSize?: number;
  includeImageBase64?: boolean;
  /** When using document annotation, mistral currently only supports up to 8 pages */
  pages?: number[];
}

export const base64Ocr = async (data: string, options?: OcrRequestOptions): Promise<OCRResponse> => {
  return await mistralClient.ocr.process({
    model: "mistral-ocr-latest",
    document: {
      documentUrl: `data:application/pdf;base64,${data}`,
      type: "document_url"
    },
    pages: options?.pages || [0, 1, 2, 3, 4, 5, 6, 7], // NOTE: When using document annotation, mistral currently only supports up to 8 pages.
    bboxAnnotationFormat: options?.bboxAnnotationFormat,
    documentAnnotationFormat: options?.documentAnnotationFormat,
    includeImageBase64: options?.includeImageBase64,
    imageLimit: options?.imageLimit,
    imageMinSize: options?.imageMinSize,
  });
};
