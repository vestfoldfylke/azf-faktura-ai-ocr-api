import { Mistral } from "@mistralai/mistralai";
import { type ZodObject } from "zod";

import { OCRResponse, ResponseFormat } from "@mistralai/mistralai/models/components";
import { OcrRequestOptions } from "../types/ocr";

import { getMistralApiKey } from "../config.js";

const apiKey: string = getMistralApiKey();

const mistralClient = new Mistral({ apiKey });

const generateResponseFormat = (zodObject: ZodObject<any, any>, name: string): ResponseFormat => {
  return {
    type: "json_schema",
    jsonSchema: {
      name,
      schemaDefinition: zodObject.toJSONSchema()
    }
  }
}

export const base64Ocr = async (data: string, options?: OcrRequestOptions): Promise<OCRResponse> => {
  return await mistralClient.ocr.process({
    model: "mistral-ocr-latest",
    document: {
      documentUrl: `data:application/pdf;base64,${data}`,
      type: "document_url"
    },
    pages: options?.pages, // NOTE: When using document annotation, mistral currently only supports up to 8 pages.
    bboxAnnotationFormat: options?.bboxAnnotationFormat ? generateResponseFormat(options.bboxAnnotationFormat, "bbox_annotations") : undefined,
    documentAnnotationFormat: options?.documentAnnotationFormat ? generateResponseFormat(options.documentAnnotationFormat, "document_annotations") : undefined,
    includeImageBase64: options?.includeImageBase64,
    imageLimit: options?.imageLimit,
    imageMinSize: options?.imageMinSize,
  });
};
