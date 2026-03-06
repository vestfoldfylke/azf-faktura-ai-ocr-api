import type { ZodObject, ZodRawShape } from "zod";

export type ZodObjectAnyShape = ZodObject<ZodRawShape>;

export type OcrRequestOptions<B extends ZodObjectAnyShape, D extends ZodObjectAnyShape> = {
  /** ZodObject used for Image annotation */
  bboxAnnotationFormat?: B;
  /** ZodObject used for Document annotation */
  documentAnnotationFormat?: D;
  imageLimit?: number;
  imageMinSize?: number;
  includeImageBase64?: boolean;
  /** When using document annotation, mistral currently only supports up to 8 pages */
  pages?: number[];
};
