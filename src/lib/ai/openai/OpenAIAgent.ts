import { logger } from "@vestfoldfylke/loglady";
import type { ZodSafeParseResult } from "zod";

import type { AIVendorConfigMap, IAIAgent } from "../../../types/ai/ai-agent.js";
import type { OcrRequestOptions, ZodObjectAnyShape } from "../../../types/ai/ocr.js";
import type { Invoice } from "../../../types/ai/zod-ocr.js";

export class OpenAIAgent implements IAIAgent {
  readonly _agentName: string = "OpenAI";

  private readonly _apiKey: string;

  public constructor(config: AIVendorConfigMap["openai"]) {
    this._apiKey = config.apiKey;
  }

  public async ocrToStructuredJson(
    base64Data: string,
    options: OcrRequestOptions<ZodObjectAnyShape, ZodObjectAnyShape>
  ): Promise<ZodSafeParseResult<Invoice> | null> {
    logger.info("{Whatever} : {WhatEver2} : {WhatEver3}", typeof base64Data, typeof options, typeof this._apiKey);
    return Promise.resolve(undefined);
  }
}
