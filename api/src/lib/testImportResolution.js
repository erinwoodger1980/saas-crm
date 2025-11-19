"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pdf_parser_1 = require("ml/pdf_parser");
const testText = "This is a test string.";
const isGibberish = (0, pdf_parser_1._is_gibberish)(testText);
console.log(`Is gibberish: ${isGibberish}`);
const pdfBytes = new Uint8Array();
const extractedText = (0, pdf_parser_1.extract_text_from_pdf_bytes)(pdfBytes);
console.log(`Extracted text: ${extractedText}`);
