# ml/pdf_parser.py
from __future__ import annotations
import re
from typing import List, Dict, Any

# Try to import PyMuPDF for native text extraction (optional at runtime)
try:
    import fitz  # type: ignore
except Exception:
    fitz = None  # type: ignore

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
    2) Fallback to OCR (if libs present)
    """
    text = _extract_text_pymupdf(pdf_bytes)
    if text.strip():
        return text
    # Only try OCR if PyMuPDF failed to get anything useful.
    ocr = _ocr_pages(pdf_bytes, max_pages=5)
    return ocr or ""

def parse_totals_from_text(text: str) -> Dict[str, Any]:
    """
    Very lightweight heuristic parser to find a grand total-like number.
    Returns a dict with:
      - currency (str|None)
      - lines (list[str]) sample lines used for estimation (currently empty placeholder)
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

__all__ = ["extract_text_from_pdf_bytes", "parse_totals_from_text"]