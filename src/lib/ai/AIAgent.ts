import { logger } from "@vestfoldfylke/loglady";

import { getAIAgentConfig } from "../../config.js";

import type { AIVendorConfig, IAIAgent } from "../../types/ai/ai-agent.js";
import type { OcrRequestOptions, ZodObjectAnyShape } from "../../types/ai/ocr.js";
import type { OcrProcessedResponse } from "../../types/faktura-ai.js";

import { MistralAgent } from "./mistral/MistralAgent.js";
import { OpenAIAgent } from "./openai/OpenAIAgent.js";

export class AIAgent implements IAIAgent {
  readonly agentName: string = "AIAgent";

  private aiAgent: IAIAgent;

  public constructor() {
    const aiAgentConfig: AIVendorConfig = getAIAgentConfig();

    if (aiAgentConfig.type === "mistral") {
      this.aiAgent = new MistralAgent(aiAgentConfig);
    } else if (aiAgentConfig.type === "openai") {
      this.aiAgent = new OpenAIAgent(aiAgentConfig);
    } else {
      throw new Error("No valid AI agent configuration found. Please check environment variables.");
    }

    logger.info("Initialized agent '{AgentName}' with model '{Model}'", this.aiAgent.agentName, aiAgentConfig.model);
  }

  public ocrToStructuredJson(
    base64Data: string,
    options: OcrRequestOptions<ZodObjectAnyShape, ZodObjectAnyShape>
  ): Promise<OcrProcessedResponse | null> {
    return this.aiAgent.ocrToStructuredJson(base64Data, options);
  }
}
