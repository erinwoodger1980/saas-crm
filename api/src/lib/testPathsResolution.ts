import { _is_gibberish } from 'ml/pdf_parser';

const testText = "This is a test string.";
const isGibberish = _is_gibberish(testText);
console.log(`Is gibberish: ${isGibberish}`);