import type { ZodObject } from "zod";

export type OcrRequestOptions = {
  /** ZodObject used for Image annotation */
  // biome-ignore lint/suspicious/noExplicitAny: any needed for ZodObject typing...
  bboxAnnotationFormat?: ZodObject<any, any>;
  /** ZodObject used for Document annotation */
  // biome-ignore lint/suspicious/noExplicitAny: any needed for ZodObject typing...
  documentAnnotationFormat?: ZodObject<any, any>;
  imageLimit?: number;
  imageMinSize?: number;
  includeImageBase64?: boolean;
  /** When using document annotation, mistral currently only supports up to 8 pages */
  pages?: number[];
};
