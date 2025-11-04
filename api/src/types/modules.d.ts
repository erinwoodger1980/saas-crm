declare module "pdf-parse" {
  export interface PDFInfo {
    numpages: number;
    numrender: number;
    info?: Record<string, any>;
    metadata?: any;
    version?: string;
  }
  export interface PDFParseResult {
    text: string;
    info: PDFInfo;
    metadata?: any;
    version?: string;
  }
  const pdfParse: (buffer: Buffer) => Promise<PDFParseResult>;
  export default pdfParse;
}

declare module "tesseract.js" {
  export interface RecognizeResult {
    data: { text: string };
  }
  export interface WorkerOptions {
    cacheMethod?: "readOnly" | "readWrite";
    workerPath?: string;
    langPath?: string;
    corePath?: string;
    logger?: (m: any) => void;
  }
  export interface Worker {
    load(): Promise<void>;
    loadLanguage(lang: string): Promise<void>;
    initialize(lang: string): Promise<void>;
    recognize(image: Buffer | Blob | string): Promise<RecognizeResult>;
    terminate(): Promise<void>;
  }
  export function createWorker(options?: WorkerOptions): Worker;
}
