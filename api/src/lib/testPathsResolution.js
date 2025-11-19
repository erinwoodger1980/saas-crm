"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pdf_parser_1 = require("ml/pdf_parser");
const testText = "This is a test string.";
const isGibberish = (0, pdf_parser_1._is_gibberish)(testText);
console.log(`Is gibberish: ${isGibberish}`);
