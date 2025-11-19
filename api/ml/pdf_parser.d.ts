declare module 'ml/pdf_parser' {
  export function _is_gibberish(text: string): boolean;
  export function extract_text_from_pdf_bytes(bytes: Uint8Array): string;
}