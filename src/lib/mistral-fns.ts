import { Mistral } from "@mistralai/mistralai";
import type {ChatCompletionResponse, ContentChunk, OCRResponse, ResponseFormat} from "@mistralai/mistralai/models/components";
import { logger } from "@vestfoldfylke/loglady";

import { getMistralApiKey } from "../config.js";

import type { OcrRequestOptions, ZodObjectAnyShape } from "../types/ocr";

const apiKey: string = getMistralApiKey();

const mistralClient = new Mistral({ apiKey });

const generateResponseFormat = (zodObject: ZodObjectAnyShape, name: string): ResponseFormat => {
  return {
    type: "json_schema",
    jsonSchema: {
      name,
      schemaDefinition: zodObject.toJSONSchema()
    }
  };
};

export const base64Ocr = async (data: string, options?: OcrRequestOptions<ZodObjectAnyShape, ZodObjectAnyShape>): Promise<OCRResponse | null> => {
  try {
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
  } catch (error) {
    logger.errorException(error, "Error during OCR processing");
    return null;
  }
};

export const textChat = async (systemPrompt: string, userPrompt: string): Promise<string> => {
  const response: ChatCompletionResponse = await mistralClient.chat.complete({
    model: "mistral-large-latest",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]
  });

  if (response.choices.length === 0) {
    throw new Error("No response from Mistral chat completion");
  }
  
  let answer: string = "";
  
  for (const choice of response.choices) {
    if (!choice.message.content) {
      logger.warn("Received empty content for index {Index} in chat completion choice", choice.index);
      continue;
    }
    
    if (typeof choice.message.content === "string") {
      answer += choice.message.content;
      continue;
    }
    
    const contentChunk: ContentChunk = choice.message.content[0];
    logger.warn("Received unexpected content chunk for index {Index} in chat completion choice: {ContentChunk}", choice.index, contentChunk);
  }
  
  return answer;
}
