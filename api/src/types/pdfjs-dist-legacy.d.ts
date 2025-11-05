declare module "pdfjs-dist/legacy/build/pdf.js" {
  import * as pdfjsLib from "pdfjs-dist";
  export = pdfjsLib;
}

declare module "pdfjs-dist/legacy/build/pdf.worker.js" {
  const workerPath: string;
  export = workerPath;
}
