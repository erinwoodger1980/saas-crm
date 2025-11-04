# ml/pdf_parser.py
from __future__ import annotations
import io
import re
from typing import List, Dict, Any

# Try to import PyMuPDF for native text extraction (optional at runtime)
try:
    import fitz  # type: ignore
except Exception:
    fitz = None  # type: ignore

try:
    from PyPDF2 import PdfReader  # type: ignore
except Exception:
    PdfReader = None  # type: ignore

def _extract_text_pymupdf(pdf_bytes: bytes) -> str:
    """Best-effort text extraction using PyMuPDF. Returns '' if unavailable."""
    if not fitz:
        return ""
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        parts: List[str] = []
        for page in doc:
            t = page.get_text("text") or ""
            if not t.strip():
                t = page.get_text("blocks") or ""
            parts.append(t)
        return "\n".join(parts).strip()
    except Exception:
        return ""

def _extract_text_pypdf(pdf_bytes: bytes) -> str:
    """Fallback text extraction using PyPDF2 when PyMuPDF is unavailable."""
    if not PdfReader:
        return ""
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))  # type: ignore
        parts: List[str] = []
        for page in reader.pages:
            try:
                text = page.extract_text() or ""
                if text.strip():
                    parts.append(text)
            except Exception:
                continue
        return "\n".join(parts).strip()
    except Exception:
        return ""

def _ocr_pages(pdf_bytes: bytes, max_pages: int = 5) -> str:
    """
    Optional OCR fallback on first few pages.
    If pdf2image/Pillow/pytesseract are missing (e.g., on Render without system deps),
    this returns '' and we just rely on PyMuPDF text.
    """
    try:
        from pdf2image import convert_from_bytes  # type: ignore
        import pytesseract  # type: ignore
        from PIL import Image  # type: ignore
    except Exception:
        return ""

    try:
        images = convert_from_bytes(pdf_bytes, fmt="png", first_page=1, last_page=max_pages, dpi=200)
        out: List[str] = []
        for img in images:
            try:
                txt = pytesseract.image_to_string(img) or ""
                if txt.strip():
                    out.append(txt)
            except Exception:
                pass
        return "\n".join(out).strip()
    except Exception:
        return ""

def extract_text_from_pdf_bytes(pdf_bytes: bytes) -> str:
    """
    Public API used by main.py.
    1) Try PyMuPDF
    2) Fallback to PyPDF2 if available
    3) Fallback to OCR (if libs present)
    """
    text = _extract_text_pymupdf(pdf_bytes)
    if text.strip():
        return text
    text = _extract_text_pypdf(pdf_bytes)
    if text.strip():
        return text
    # Only try OCR if other methods failed to get anything useful.
    ocr = _ocr_pages(pdf_bytes, max_pages=5)
    return ocr or ""

def parse_quote_lines_from_text(text: str) -> Dict[str, Any]:
    """
    Enhanced parser to extract both individual line items and totals from supplier quotes.
    Returns a dict with:
      - currency (str|None)
      - lines (list[dict]) individual line items with description, qty, unit_price
      - detected_totals (list[float]) raw total candidates
      - estimated_total (float|None) chosen total candidate
      - confidence (float) 0..1 rough confidence score
      - supplier (str|None) detected supplier name
    """
    if not text:
        return {
            "currency": None,
            "lines": [],
            "detected_totals": [],
            "estimated_total": None,
            "confidence": 0.0,
            "supplier": None,
        }

    # Extract currency symbol
    currency = None
    mcur = re.search(r"(?P<cur>£|\$|€)", text)
    if mcur:
        currency = mcur.group("cur")

    # Extract supplier name (look for common patterns)
    supplier = None
    supplier_patterns = [
        r"(?:from|supplier|vendor)[\s:]+([A-Z][A-Za-z\s&]+?)(?:\n|$)",
        r"^([A-Z][A-Za-z\s&]+?)\s*(?:ltd|limited|inc|corp|company)\.?\s*$",
        r"invoice\s+from\s+([A-Z][A-Za-z\s&]+?)(?:\n|$)",
    ]
    for pat in supplier_patterns:
        match = re.search(pat, text, re.IGNORECASE | re.MULTILINE)
        if match:
            supplier = match.group(1).strip()
            break

    # Extract line items from table-like structures
    lines = []
    
    # Pattern 1: Table with description, qty, unit price
    # Look for lines that have: description + quantity + price pattern
    table_patterns = [
        # Pattern: Description [spaces/tabs] Qty [spaces/tabs] £Price
        r"^(.+?)\s+(\d+(?:\.\d+)?)\s*(?:x\s*)?(?:[£$€]?\s*)?(\d+(?:,\d{3})*(?:\.\d{2})?)\s*$",
        # Pattern: Description £Price (assuming qty=1)
        r"^(.+?)\s+[£$€]\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*$",
        # Pattern: Qty x Description @ £Price
        r"^(\d+(?:\.\d+)?)\s*x?\s*(.+?)\s*@\s*[£$€]?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*$",
    ]
    
    text_lines = text.split('\n')
    for line in text_lines:
        line = line.strip()
        if not line or len(line) < 10:  # Skip very short lines
            continue
            
        # Skip header lines
        if re.search(r"(description|item|quantity|qty|price|total|sub.*total)", line, re.IGNORECASE):
            continue
            
        # Try each pattern
        for i, pattern in enumerate(table_patterns):
            match = re.match(pattern, line, re.IGNORECASE)
            if match:
                if i == 0:  # Description Qty Price
                    description = match.group(1).strip()
                    qty = float(match.group(2))
                    unit_price = float(match.group(3).replace(',', ''))
                elif i == 1:  # Description Price (qty=1)
                    description = match.group(1).strip()
                    qty = 1.0
                    unit_price = float(match.group(2).replace(',', ''))
                elif i == 2:  # Qty x Description @ Price
                    qty = float(match.group(1))
                    description = match.group(2).strip()
                    unit_price = float(match.group(3).replace(',', ''))
                
                # Filter out likely non-item lines
                skip_keywords = ['total', 'subtotal', 'vat', 'tax', 'delivery', 'shipping', 'discount', 'payment']
                if not any(keyword in description.lower() for keyword in skip_keywords):
                    lines.append({
                        "description": description,
                        "qty": qty,
                        "unit_price": unit_price,
                        "total": qty * unit_price
                    })
                break

    # If no structured lines found, try to extract from more freeform text
    if not lines:
        # Look for patterns like "Door £500" or "Window installation £300"
        item_patterns = [
            r"([A-Za-z\s]+(?:door|window|frame|installation|hardware|handle|lock|glass).*?)\s+[£$€]\s*(\d+(?:,\d{3})*(?:\.\d{2})?)",
            r"(\d+\s*(?:x\s*)?[A-Za-z\s]+)\s+[£$€]\s*(\d+(?:,\d{3})*(?:\.\d{2})?)",
        ]
        
        for pattern in item_patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                description = match.group(1).strip()
                price = float(match.group(2).replace(',', ''))
                
                # Extract quantity if present in description
                qty_match = re.search(r"(\d+)\s*(?:x\s*)?", description)
                if qty_match:
                    qty = float(qty_match.group(1))
                    description = re.sub(r"^\d+\s*x?\s*", "", description).strip()
                    unit_price = price / qty if qty > 0 else price
                else:
                    qty = 1.0
                    unit_price = price
                
                lines.append({
                    "description": description,
                    "qty": qty,
                    "unit_price": unit_price,
                    "total": price
                })

    # Extract totals using existing logic
    total_patterns = [
        r"grand\s+total\s*[:\-]?\s*[£$€]?\s*(\d[\d,]*\.?\d*)",
        r"total\s*(?:due|amount)?\s*[:\-]?\s*[£$€]?\s*(\d[\d,]*\.?\d*)",
        r"balance\s*due\s*[:\-]?\s*[£$€]?\s*(\d[\d,]*\.?\d*)",
        r"sub.*total\s*[:\-]?\s*[£$€]?\s*(\d[\d,]*\.?\d*)",
    ]

    candidates: List[float] = []
    for pat in total_patterns:
        for m in re.finditer(pat, text, flags=re.IGNORECASE):
            num = m.group(1)
            num = re.sub(r"[^\d\.]", "", num)
            try:
                val = float(num)
                if val > 0:
                    candidates.append(val)
            except Exception:
                pass

    # Calculate estimated total
    estimated = None
    confidence = 0.0
    
    if lines:
        # If we have line items, calculate total from them
        calculated_total = sum(line.get("total", 0) for line in lines)
        if calculated_total > 0:
            estimated = calculated_total
            confidence = 0.8
        # Also include any detected totals for comparison
        if candidates:
            candidates.append(calculated_total)
    elif candidates:
        # No line items, use detected totals
        estimated = float(max(candidates))
        confidence = 0.35 if len(candidates) == 1 else 0.55

    return {
        "currency": currency,
        "lines": lines,
        "detected_totals": candidates,
        "estimated_total": estimated,
        "confidence": confidence,
        "supplier": supplier,
    }

def parse_totals_from_text(text: str) -> Dict[str, Any]:
    """
    Legacy function that previously did basic total extraction.
    Now delegates to the enhanced parser for full line item extraction.
    
    Returns a dict with:
      - currency (str|None)
      - lines (list[dict]) array of line items with description, quantity, price, amount
      - detected_totals (list[float]) raw candidates
      - estimated_total (float|None) chosen candidate
      - confidence (float) 0..1 rough confidence score
    """
    if not text:
        return {
            "currency": None,
            "lines": [],
            "detected_totals": [],
            "estimated_total": None,
            "confidence": 0.0,
        }

    # currency symbol capture
    currency = None
    mcur = re.search(r"(?P<cur>£|\$|€)", text)
    if mcur:
        currency = mcur.group("cur")

    # Common “total” phrases
    total_patterns = [
        r"grand\s+total\s*[:\-]?\s*([£$€]?\s?\d[\d,]*\.?\d*)",
        r"total\s*(?:due|amount)?\s*[:\-]?\s*([£$€]?\s?\d[\d,]*\.?\d*)",
        r"balance\s*due\s*[:\-]?\s*([£$€]?\s?\d[\d,]*\.?\d*)",
    ]

    candidates: List[float] = []
    for pat in total_patterns:
        for m in re.finditer(pat, text, flags=re.IGNORECASE):
            num = m.group(1)
            num = re.sub(r"[^\d\.]", "", num)
            try:
                val = float(num)
                if val > 0:
                    candidates.append(val)
            except Exception:
                pass

    # Fallback: any money-like number on its own line
    if not candidates:
        for m in re.finditer(r"(^|\n)\s*[£$€]?\s?(\d[\d,]*\.?\d*)\s*($|\n)", text):
            num = m.group(2)
            num = re.sub(r"[^\d\.]", "", num)
            try:
                val = float(num)
                if val > 0:
                    candidates.append(val)
            except Exception:
                pass

    estimated = None
    confidence = 0.0
    if candidates:
        # Naive heuristic: choose the max (often grand total is largest).
        estimated = float(max(candidates))
        confidence = 0.35 if len(candidates) == 1 else 0.55

    return {
        "currency": currency,
        "lines": [],  # reserved for future line-by-line parsing
        "detected_totals": candidates,
        "estimated_total": estimated,
        "confidence": confidence,
    }

__all__ = ["extract_text_from_pdf_bytes", "parse_totals_from_text", "parse_quote_lines_from_text"]