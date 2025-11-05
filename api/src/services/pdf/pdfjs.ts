import path from "path";
import pdfjs from "pdfjs-dist/legacy/build/pdf.js";

(pdfjs as any).GlobalWorkerOptions.workerSrc = require.resolve(
  "pdfjs-dist/legacy/build/pdf.worker.js",
);

const pdfjsPkg = require.resolve("pdfjs-dist/package.json");
const pdfjsRoot = path.dirname(pdfjsPkg);

(pdfjs as any).GlobalWorkerOptions.cMapUrl = path.join(pdfjsRoot, "cmaps/");
(pdfjs as any).GlobalWorkerOptions.cMapPacked = true;
(pdfjs as any).GlobalWorkerOptions.standardFontDataUrl = path.join(
  pdfjsRoot,
  "standard_fonts/",
);

export { pdfjs };
