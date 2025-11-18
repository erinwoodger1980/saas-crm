declare module 'pdf-parse' {
  interface PdfParseResult {
    text: string;
    // other fields are ignored for our use case
    info?: any;
    metadata?: any;
    version?: string;
  }
  function pdfParse(data: Buffer | Uint8Array | ArrayBuffer): Promise<PdfParseResult>;
  export default pdfParse;
}
