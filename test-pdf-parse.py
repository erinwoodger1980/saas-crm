#!/usr/bin/env python3
"""
Test PDF parsing to diagnose gibberish text extraction
"""
import sys
sys.path.insert(0, 'ml')

from ml.pdf_parser import extract_text_from_pdf_bytes, _is_gibberish

def test_pdf(pdf_path):
    print(f"\n=== Testing PDF: {pdf_path} ===\n")
    
    with open(pdf_path, 'rb') as f:
        pdf_bytes = f.read()
    
    print(f"PDF size: {len(pdf_bytes)} bytes")
    
    # Extract text
    text = extract_text_from_pdf_bytes(pdf_bytes)
    
    print(f"\nExtracted text length: {len(text)} characters")
    
    # Check for gibberish
    is_gibberish = _is_gibberish(text)
    if is_gibberish:
        print("⚠️  DETECTED AS GIBBERISH - OCR fallback should have been triggered")
    else:
        print("✅ Text quality looks good")
    
    print(f"\nFirst 500 characters:")
    print("-" * 50)
    print(text[:500])
    print("-" * 50)
    
    # Check for gibberish indicators
    if text:
        alpha_count = sum(1 for c in text if c.isalpha())
        total_count = len(text.replace(' ', '').replace('\n', ''))
        if total_count > 0:
            alpha_ratio = alpha_count / total_count
            print(f"\nAlpha ratio: {alpha_ratio:.2%}")
            if alpha_ratio < 0.5:
                print("⚠️  WARNING: Low alpha ratio - possible gibberish!")
        
        # Check for common gibberish patterns
        if any(ord(c) > 127 and ord(c) < 160 for c in text[:200]):
            print("⚠️  WARNING: Found extended ASCII characters - encoding issue!")
        
        # Check if words are recognizable
        words = text.split()[:20]
        recognizable = sum(1 for w in words if len(w) > 2 and w.isalpha())
        print(f"Recognizable words in first 20: {recognizable}/20")
        if recognizable < 10:
            print("⚠️  WARNING: Many unrecognizable words!")
    else:
        print("❌ NO TEXT EXTRACTED!")

if __name__ == "__main__":
    # Test with the sample PDF
    test_pdf("api/fixtures/supplier-sample.pdf")
    
    # Test with your problematic PDF
    test_pdf("/Users/Erin/Desktop/Joinery ai example supplier quote.pdf")
