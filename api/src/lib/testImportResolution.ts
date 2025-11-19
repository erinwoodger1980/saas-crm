import { _is_gibberish, extract_text_from_pdf_bytes } from 'ml/pdf_parser';

const testText = "This is a test string.";
const isGibberish = _is_gibberish(testText);
console.log(`Is gibberish: ${isGibberish}`);

const pdfBytes = new Uint8Array();
const extractedText = extract_text_from_pdf_bytes(pdfBytes);
console.log(`Extracted text: ${extractedText}`);