# ml/pdf_parser.py
from __future__ import annotations
import io, re, json, urllib.request
from typing import Dict, Any, List, Tuple
from PIL import Image

# Optional OCR deps (we'll import lazily so the module still loads without them)
try:
    import fitz  # PyMuPDF
except Exception:
    fitz = None

def _download(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "JoineryAI-ML/1.0"})
    with urllib.request.urlopen(req, timeout=60) as rsp:
        return rsp.read()

def _extract_text_pymupdf(pdf_bytes: bytes) -> str:
    if not fitz:
        return ""
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        parts: List[str] = []
        for page in doc:
            # textpage (raw) generally best for drawings with selectable text
            t = page.get_text("text") or ""
            if not t.strip():
                t = page.get_text("blocks") or ""
            parts.append(t)
        return "\n".join(parts).strip()
    except Exception:
        return ""

def _ocr_pages(pdf_bytes: bytes, max_pages: int = 5) -> str:
    """
    OCR fallback: rasterize first few pages & run Tesseract (if available).
    We keep it defensive so it won't crash if deps are missing.
    """
    try:
        from pdf2image import convert_from_bytes
        import pytesseract
    except Exception:
        return ""

    try:
        images: List[Image.Image] = convert_from_bytes(
            pdf_bytes, fmt="png", first_page=1, last_page=max_pages, dpi=200
        )
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

_CURRENCY_SIGNS = r"(?:£|\$|€)"
_NUM = r"(?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d{2})?"
TOTAL_PATTS = [
    # common label + amount on same line
    re.compile(rf"(?:grand\s*total|total\s*(?:due|amount)?|balance\s*due)\s*[:\-]?\s*{_CURRENCY_SIGNS}\s*({_NUM})", re.I),
    re.compile(rf"{_CURRENCY_SIGNS}\s*({_NUM})\s*(?:grand\s*total|total\s*(?:due|amount)?|balance\s*due)", re.I),
    # plain currency lines near the end (last resort)
    re.compile(rf"{_CURRENCY_SIGNS}\s*({_NUM})"),
]

def _detect_totals(text: str) -> Tuple[List[Dict[str, Any]], float | None]:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    detected: List[Dict[str, Any]] = []

    # try label-aware patterns first
    for i, ln in enumerate(lines):
        s = ln
        for rx in TOTAL_PATTS[:2]:
            m = rx.search(s)
            if m:
                amt = m.group(1)
                try:
                    val = float(amt.replace(",", ""))
                    detected.append({"line": s, "value": val})
                except Exception:
                    pass

    # If still nothing, scan the last ~15 lines for any lone currency amounts
    if not detected:
        tail = lines[-15:]
        for ln in tail:
            for m in TOTAL_PATTS[2].finditer(ln):
                amt = m.group(1)
                try:
                    val = float(amt.replace(",", ""))
                    detected.append({"line": ln, "value": val})
                except Exception:
                    pass

    avg = None
    if detected:
        vals = [d["value"] for d in detected]
        # choose the max as a heuristic for "grand total"
        avg = max(vals) if vals else None

    return detected, avg

def parse_quote_pdf(url: str) -> Dict[str, Any]:
    """
    Download + parse a PDF quote.
    Returns:
      {
        "currency": "£" | "$" | "€" | None,
        "lines": [...maybe later...],
        "detected_totals": [{"line": str, "value": float}, ...],
        "estimated_total": float | None,
        "confidence": 0..1,
        "raw_text_len": int
      }
    """
    pdf_bytes = _download(url)

    # 1) try text extraction (PyMuPDF)
    text = _extract_text_pymupdf(pdf_bytes)

    # 2) if empty, OCR first few pages
    if not text or len(text.strip()) < 10:
        ocr_text = _ocr_pages(pdf_bytes, max_pages=5)
        if len(ocr_text) > len(text):
            text = ocr_text

    # currency sign heuristic
    currency = None
    if "£" in text:
        currency = "£"
    elif "$" in text:
        currency = "$"
    elif "€" in text:
        currency = "€"

    detected_totals, estimated_total = _detect_totals(text)
    confidence = 0.0
    if estimated_total is not None:
        # cheap heuristic: long enough text + totals found = higher confidence
        if len(text) > 400:
            confidence = 0.8
        elif len(text) > 120:
            confidence = 0.6
        else:
            confidence = 0.4

    return {
        "currency": currency,
        "lines": [],  # (optionally populate later with structured line items)
        "detected_totals": detected_totals,
        "estimated_total": estimated_total,
        "confidence": confidence,
        "raw_text_len": len(text or ""),
    }