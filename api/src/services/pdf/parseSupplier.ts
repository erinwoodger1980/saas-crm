// api/src/services/pdf/parseSupplier.ts
export type ParseResult = { lines: string[]; stages?: string[] };

export async function parseSupplierPdf(
  filePath: string,
  opts: { ocrEnabled?: boolean; llmEnabled?: boolean } = {}
): Promise<ParseResult> {
  // TODO: wire your real implementation.
  // For now, return a deterministic stub so CI/Render can pass.
  return {
    lines: ["STUB: parser reachable", `file=${filePath}`, `ocr=${!!opts.ocrEnabled}`],
    stages: ["stub"],
  };
}
