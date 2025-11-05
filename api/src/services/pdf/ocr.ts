import fs from "fs";

function ensureCacheDir(dir: string) {
  if (!dir) return;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export async function ocrImageBuffers(buffers: Buffer[], lang = "eng"): Promise<string> {
  if (!buffers.length) return "";
  ensureCacheDir(process.env.TESSERACT_CACHE_DIR || "");
  const tesseract = await import("tesseract.js");
  const worker = await tesseract.createWorker({
    cachePath: process.env.TESSERACT_CACHE_DIR || undefined,
  });

  try {
    await worker.load();
    await worker.loadLanguage(lang);
    await worker.initialize(lang);
    const texts: string[] = [];
    for (const buffer of buffers) {
      const { data } = await worker.recognize(buffer);
      texts.push(data?.text ?? "");
    }
    return texts.join("\n");
  } finally {
    try {
      await worker.terminate();
    } catch {
      // ignore termination errors
    }
  }
}
