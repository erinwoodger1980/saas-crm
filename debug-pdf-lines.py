#!/usr/bin/env python3
"""
Debug: Show line-by-line analysis of the PDF text
"""
import sys
import re
sys.path.insert(0, 'ml')

from ml.pdf_parser import extract_text_from_pdf_bytes

pdf_path = "/Users/Erin/Desktop/Joinery ai example supplier quote.pdf"

with open(pdf_path, 'rb') as f:
    pdf_bytes = f.read()

text = extract_text_from_pdf_bytes(pdf_bytes)
lines = text.split('\n')

print("=== Line-by-Line Analysis ===\n")

for i, line in enumerate(lines):
    stripped = line.strip()
    if not stripped:
        continue
    
    # Check patterns
    is_number_line = bool(re.match(r'^(\d+(?:,\d{3})*(?:\.\d{2})?)\s+(\d+(?:\.\d+)?)\s*(?:pc\.?|pcs\.?)?\s+(\d+(?:,\d{3})*(?:\.\d{2})?)\s*$', stripped))
    is_dimension = bool(re.match(r'^\d+x\d+mm', stripped))
    is_area = bool(re.match(r'^\d+(?:\.\d+)?m[²2]', stripped, re.IGNORECASE))
    is_weight = bool(re.match(r'^\d+\s*kg', stripped, re.IGNORECASE))
    
    markers = []
    if is_number_line:
        markers.append("NUMBER_LINE")
    if is_dimension:
        markers.append("DIMENSION")
    if is_area:
        markers.append("AREA")
    if is_weight:
        markers.append("WEIGHT")
    
    if markers or (i >= 20 and i <= 45):  # Show context around the table
        marker_str = f" [{', '.join(markers)}]" if markers else ""
        print(f"{i:3d}: {stripped}{marker_str}")
