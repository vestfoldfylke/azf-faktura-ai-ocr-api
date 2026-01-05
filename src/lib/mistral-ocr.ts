import { Mistral } from "@mistralai/mistralai";
import type { OCRResponse, ResponseFormat } from "@mistralai/mistralai/models/components";
import type { ZodObject } from "zod";

import { getMistralApiKey } from "../config.js";

import type { OcrRequestOptions } from "../types/ocr";

const apiKey: string = getMistralApiKey();

const mistralClient = new Mistral({ apiKey });

// biome-ignore lint/suspicious/noExplicitAny: any needed for ZodObject typing...
const generateResponseFormat = (zodObject: ZodObject<any, any>, name: string): ResponseFormat => {
  return {
    type: "json_schema",
    jsonSchema: {
      name,
      schemaDefinition: zodObject.toJSONSchema()
    }
  };
};

export const base64Ocr = async (data: string, options?: OcrRequestOptions): Promise<OCRResponse> => {
  return await mistralClient.ocr.process({
    model: "mistral-ocr-latest",
    document: {
      documentUrl: `data:application/pdf;base64,${data}`,
      type: "document_url"
    },
    pages: options?.pages, // NOTE: When using document annotation, mistral currently only supports up to 8 pages.
    bboxAnnotationFormat: options?.bboxAnnotationFormat ? generateResponseFormat(options.bboxAnnotationFormat, "bbox_annotations") : undefined,
    documentAnnotationFormat: options?.documentAnnotationFormat
      ? generateResponseFormat(options.documentAnnotationFormat, "document_annotations")
      : undefined,
    includeImageBase64: options?.includeImageBase64,
    imageLimit: options?.imageLimit,
    imageMinSize: options?.imageMinSize
  });
};
