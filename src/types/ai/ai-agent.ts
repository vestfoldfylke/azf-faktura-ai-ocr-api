import type { OcrProcessedResponse } from "../faktura-ai.js";
import type { OcrRequestOptions, ZodObjectAnyShape } from "./ocr.js";

export type AIVendor = "mistral" | "openai";

export type AIVendorConfigMap = {
  mistral: MistralConfig;
  openai: OpenAIConfig;
};

export interface IAIAgent {
  agentName: string;

  ocrToStructuredJson: (base64Data: string, options: OcrRequestOptions<ZodObjectAnyShape, ZodObjectAnyShape>) => Promise<OcrProcessedResponse | null>;
}

export type MistralConfig = {
  apiKey: string;
  model: string;
};

export type OpenAIConfig = {
  apiKey: string;
  model: string;
};
