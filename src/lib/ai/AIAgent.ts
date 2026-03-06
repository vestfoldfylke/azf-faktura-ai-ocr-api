import { getAIAgentConfig } from "../../config.js";

import type { AIVendor, AIVendorConfigMap, IAIAgent } from "../../types/ai/ai-agent.js";
import type { OcrRequestOptions, ZodObjectAnyShape } from "../../types/ai/ocr.js";
import type { OcrProcessedResponse } from "../../types/faktura-ai.js";

import { MistralAgent } from "./mistral/MistralAgent.js";
import { OpenAIAgent } from "./openai/OpenAIAgent.js";

export class AIAgent implements IAIAgent {
  readonly _agentName: string = "AIAgent";

  private aiAgent: IAIAgent;

  public constructor() {
    const aiAgentConfig: Partial<Record<AIVendor, AIVendorConfigMap[AIVendor]>> = getAIAgentConfig();

    if (aiAgentConfig.mistral) {
      this.aiAgent = new MistralAgent(aiAgentConfig.mistral);
    } else if (aiAgentConfig.openai) {
      this.aiAgent = new OpenAIAgent(aiAgentConfig.openai);
    } else {
      throw new Error("No valid AI agent configuration found. Please check environment variables.");
    }
  }

  public ocrToStructuredJson(
    base64Data: string,
    options: OcrRequestOptions<ZodObjectAnyShape, ZodObjectAnyShape>
  ): Promise<OcrProcessedResponse | null> {
    return this.aiAgent.ocrToStructuredJson(base64Data, options);
  }
}
