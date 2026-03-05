import type { ZodSafeParseResult } from "zod";

import type { OcrRequestOptions, ZodObjectAnyShape } from "./ocr.js";
import type { Invoice } from "./zod-ocr.js";

export type AIVendor = "mistral" | "openai";

export type AIVendorConfigMap = {
  mistral: MistralConfig;
  openai: OpenAIConfig;
};

export interface IAIAgent {
  _agentName: string;

  ocrToStructuredJson: (
    base64Data: string,
    options: OcrRequestOptions<ZodObjectAnyShape, ZodObjectAnyShape>
  ) => Promise<ZodSafeParseResult<Invoice> | null>;
}

export type MistralConfig = {
  apiKey: string;
};

export type OpenAIConfig = {
  apiKey: string;
};
