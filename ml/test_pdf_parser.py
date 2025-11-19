import sys
import os

# Add the project root to the Python path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, project_root)

from ml.pdf_parser import extract_text_from_pdf_bytes, _is_gibberish

# Test data
pdf_bytes = b"%PDF-1.4 example PDF content"
text = "This is a test string."

# Test extract_text_from_pdf_bytes
try:
    extracted_text = extract_text_from_pdf_bytes(pdf_bytes)
    print("Extracted Text:", extracted_text)
except Exception as e:
    print("Error in extract_text_from_pdf_bytes:", e)

# Test _is_gibberish
try:
    is_gibberish = _is_gibberish(text)
    print("Is Gibberish:", is_gibberish)
except Exception as e:
    print("Error in _is_gibberish:", e)