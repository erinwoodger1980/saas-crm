#!/usr/bin/env python3
"""
Full extraction test to see all text from your PDF.
Usage:
  python3 test-full-extraction.py /absolute/path/to/file.pdf
If no path is provided, a sensible default is used.
"""
import os
import sys
sys.path.insert(0, 'ml')

from ml.pdf_parser import extract_text_from_pdf_bytes, parse_quote_lines_from_text

default_path = "/Users/Erin/Desktop/15.10.25 Woodger - Woodleys.pdf"
pdf_path = sys.argv[1] if len(sys.argv) > 1 else default_path

print(f"=== Full Extraction Test ===\n")
print(f"PDF: {pdf_path}\n")

with open(pdf_path, 'rb') as f:
    pdf_bytes = f.read()

# Extract text
text = extract_text_from_pdf_bytes(pdf_bytes)

print(f"Total extracted text ({len(text)} chars):")
print("=" * 80)
print(text)
print("=" * 80)

# Now parse it
print("\n\n=== Parsing Results ===\n")
parsed = parse_quote_lines_from_text(text)

print(f"Currency: {parsed.get('currency')}")
print(f"Supplier: {parsed.get('supplier')}")
print(f"Estimated Total: {parsed.get('estimated_total')}")
print(f"Confidence: {parsed.get('confidence'):.2%}")
print(f"\nDetected Totals: {parsed.get('detected_totals')}")
print(f"\nNumber of line items: {len(parsed.get('lines', []))}")

if parsed.get('lines'):
    print("\nParsed Line Items:")
    print("-" * 80)
    for i, line in enumerate(parsed['lines'], 1):
        desc = line.get('description', 'N/A')
        qty = line.get('qty', 'N/A')
        unit_price = line.get('unit_price', 'N/A')
        total = line.get('total', 'N/A')
        print(f"{i}. {desc}")
        print(f"   Qty: {qty} | Unit: {unit_price} | Total: {total}")
else:
    print("\n⚠️  No line items detected")
