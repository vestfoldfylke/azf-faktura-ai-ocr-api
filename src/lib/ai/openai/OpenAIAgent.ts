import { logger } from "@vestfoldfylke/loglady";
import { count } from "@vestfoldfylke/vestfold-metrics";
import { OpenAI } from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { ChatCompletion } from "openai/resources";
import type { ZodSafeParseResult } from "zod";

import { MetricsPrefix, MetricsResultFailedLabelValue, MetricsResultLabelName, MetricsResultSuccessLabelValue } from "../../../constants.js";
import type { AIVendorConfigMap, IAIAgent } from "../../../types/ai/ai-agent.js";
import type { OcrRequestOptions, ZodObjectAnyShape } from "../../../types/ai/ocr.js";
import { type Invoice, InvoiceSchema } from "../../../types/ai/zod-ocr.js";
import type { OcrProcessedResponse } from "../../../types/faktura-ai.js";

export class OpenAIAgent implements IAIAgent {
  private readonly _openAiClient: OpenAI;
  private readonly _openAiConfig: AIVendorConfigMap["openai"];
  readonly _agentName: string = "OpenAI";

  public constructor(config: AIVendorConfigMap["openai"]) {
    this._openAiClient = new OpenAI({ apiKey: config.apiKey });
    this._openAiConfig = config;
  }

  public async ocrToStructuredJson(
    base64Data: string,
    options: OcrRequestOptions<ZodObjectAnyShape, ZodObjectAnyShape>
  ): Promise<OcrProcessedResponse | null> {
    try {
      logger.info("[{VendorName} - {Model}] - Starting OCR processing on model {Model}", this._agentName, this._openAiConfig.model);

      if (!options?.documentAnnotationFormat) {
        logger.warn(
          "[{VendorName} - {Model}] - No document annotation format provided, skipping OCR processing",
          this._agentName,
          this._openAiConfig.model
        );
        return null;
      }

      const fileDataUrl: string = `data:application/pdf;base64,${base64Data}`;
      const result: ChatCompletion = await this._openAiClient.chat.completions.create({
        model: this._openAiConfig.model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Extract structured data from this PDF document." },
              { type: "file", file: { file_data: fileDataUrl, filename: "whatever.pdf" } }
            ]
          }
        ],
        response_format: zodResponseFormat(options.documentAnnotationFormat, "document_annotations")
      });

      if (result.choices.length === 0) {
        logger.warn("[{VendorName} - {Model}] - OCR processing returned 0 messages", this._agentName, this._openAiConfig.model);
        count(`${MetricsPrefix}_${this._agentName}_OcrChunk`, `Number of OCR chunks processed with ${this._agentName}`, [
          MetricsResultLabelName,
          MetricsResultFailedLabelValue
        ]);
        return null;
      }

      if (!result.choices[0].message.content) {
        logger.warn(
          "[{VendorName} - {Model}] - OCR processing returned a message but its content was empty",
          this._agentName,
          this._openAiConfig.model
        );
        count(`${MetricsPrefix}_${this._agentName}_OcrChunk`, `Number of OCR chunks processed with ${this._agentName}`, [
          MetricsResultLabelName,
          MetricsResultFailedLabelValue
        ]);
        return null;
      }

      logger.info(
        "[{VendorName} - {Model}] - OCR completed. Got {ChoiceCount} message",
        this._agentName,
        this._openAiConfig.model,
        result.choices.length
      );
      count(`${MetricsPrefix}_${this._agentName}_OcrChunk`, `Number of OCR chunks processed with ${this._agentName}`, [
        MetricsResultLabelName,
        MetricsResultSuccessLabelValue
      ]);

      const parsedInvoice: ZodSafeParseResult<Invoice> = InvoiceSchema.safeParse(JSON.parse(result.choices[0].message.content));
      if (!parsedInvoice.success) {
        count(`${MetricsPrefix}_${this._agentName}_OcrDAChunk`, `Number of OCR document annotation chunks processed with ${this._agentName}`, [
          MetricsResultLabelName,
          MetricsResultFailedLabelValue
        ]);
        logger.errorException(
          parsedInvoice.error,
          "[{VendorName} - {Model}] - Failed to parse documentAnnotation into a type of Invoice. Skipping'",
          this._agentName,
          this._openAiConfig.model
        );
        return null;
      }

      count(`${MetricsPrefix}_${this._agentName}_OcrDAChunk`, `Number of OCR document annotation chunks processed with ${this._agentName}`, [
        MetricsResultLabelName,
        MetricsResultSuccessLabelValue
      ]);
      logger.info(
        "[{VendorName} - {Model}] - Successfully parsed documentAnnotation into a type of Invoice",
        this._agentName,
        this._openAiConfig.model
      );

      return {
        invoice: parsedInvoice.data,
        vendorModel: this._openAiConfig.model,
        vendorName: "openai"
      };
    } catch (error) {
      logger.errorException(error, "[{VendorName} - {Model}] - Error during OCR processing", this._agentName, this._openAiConfig.model);
      return null;
    }
  }
}
