import { Mistral } from "@mistralai/mistralai";
import type { OCRResponse, ResponseFormat } from "@mistralai/mistralai/models/components";
import { logger } from "@vestfoldfylke/loglady";
import { count } from "@vestfoldfylke/vestfold-metrics";
import type { ZodSafeParseResult } from "zod";

import {
  MetricsAgentLabelName,
  MetricsPrefix,
  MetricsResultFailedLabelValue,
  MetricsResultLabelName,
  MetricsResultSuccessLabelValue
} from "../../../constants.js";
import type { IAIAgent, MistralConfig } from "../../../types/ai/ai-agent.js";
import type { OcrRequestOptions, ZodObjectAnyShape } from "../../../types/ai/ocr.js";
import { type Invoice, InvoiceSchema } from "../../../types/ai/zod-ocr.js";
import type { OcrProcessedResponse } from "../../../types/faktura-ai.js";

export class MistralAgent implements IAIAgent {
  private readonly _mistralClient: Mistral;
  private readonly _mistralConfig: MistralConfig;
  readonly agentName: string = "Mistral";

  public constructor(config: MistralConfig) {
    this._mistralClient = new Mistral({ apiKey: config.apiKey });
    this._mistralConfig = config;
  }

  public async ocrToStructuredJson(
    base64Data: string,
    options: OcrRequestOptions<ZodObjectAnyShape, ZodObjectAnyShape>
  ): Promise<OcrProcessedResponse | null> {
    try {
      logger.info("[{VendorName} - {Model}] - Starting OCR processing", this.agentName, this._mistralConfig.model);

      const result: OCRResponse = await this._mistralClient.ocr.process({
        model: this._mistralConfig.model,
        document: {
          documentUrl: `data:application/pdf;base64,${base64Data}`,
          type: "document_url"
        },
        pages: options?.pages, // NOTE: When using document annotation, mistral currently only supports up to 8 pages.
        bboxAnnotationFormat: options?.bboxAnnotationFormat
          ? this.generateResponseFormat(options.bboxAnnotationFormat, "bbox_annotations")
          : undefined,
        documentAnnotationFormat: options?.documentAnnotationFormat
          ? this.generateResponseFormat(options.documentAnnotationFormat, "document_annotations")
          : undefined,
        includeImageBase64: options?.includeImageBase64,
        imageLimit: options?.imageLimit,
        imageMinSize: options?.imageMinSize
      });

      if (!result) {
        logger.warn("[{VendorName} - {Model}] - OCR processing failed for base64", this.agentName, this._mistralConfig.model);
        count(
          `${MetricsPrefix}_OcrChunk`,
          "Number of OCR chunks processed by provider",
          [MetricsResultLabelName, MetricsResultFailedLabelValue],
          [MetricsAgentLabelName, this.agentName]
        );
        return null;
      }

      count(
        `${MetricsPrefix}_OcrChunk`,
        "Number of OCR chunks processed by provider",
        [MetricsResultLabelName, MetricsResultSuccessLabelValue],
        [MetricsAgentLabelName, this.agentName]
      );
      logger.info("[{VendorName} - {Model}] - OCR completed", this.agentName, this._mistralConfig.model);

      if (!result.documentAnnotation) {
        return null;
      }

      const parsedInvoice: ZodSafeParseResult<Invoice> = InvoiceSchema.safeParse(JSON.parse(result.documentAnnotation));
      if (!parsedInvoice.success) {
        count(
          `${MetricsPrefix}_OcrDAChunk`,
          "Number of OCR document annotation chunks processed by provider",
          [MetricsResultLabelName, MetricsResultFailedLabelValue],
          [MetricsAgentLabelName, this.agentName]
        );
        logger.errorException(
          parsedInvoice.error,
          "[{VendorName} - {Model}] - Failed to parse documentAnnotation into a type of Invoice. Skipping'",
          this.agentName,
          this._mistralConfig.model
        );
        return null;
      }

      count(
        `${MetricsPrefix}_OcrDAChunk`,
        "Number of OCR document annotation chunks processed by provider",
        [MetricsResultLabelName, MetricsResultSuccessLabelValue],
        [MetricsAgentLabelName, this.agentName]
      );
      logger.info(
        "[{VendorName} - {Model}] - Successfully parsed documentAnnotation into a type of Invoice",
        this.agentName,
        this._mistralConfig.model
      );

      return {
        invoice: parsedInvoice.data,
        vendorModel: this._mistralConfig.model,
        vendorName: "mistral"
      };
    } catch (error) {
      logger.errorException(error, "[{VendorName} - {Model}] - Error during OCR processing", this.agentName, this._mistralConfig.model);
      return null;
    }
  }

  private generateResponseFormat(zodObject: ZodObjectAnyShape, name: string): ResponseFormat {
    return {
      type: "json_schema",
      jsonSchema: {
        name,
        schemaDefinition: zodObject.toJSONSchema()
      }
    };
  }
}
