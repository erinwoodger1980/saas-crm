# ml/pdf_parser.py
from __future__ import annotations

import io
import re
from typing import Any, Dict, List, Optional, Tuple

# --- HTTP fetch (requests if available, else urllib) ---
try:
    import requests  # type: ignore
    def _http_get(url: str, timeout: int = 30) -> bytes:
        r = requests.get(url, timeout=timeout)
        r.raise_for_status()
        return r.content
except Exception:  # pragma: no cover
    import urllib.request
    def _http_get(url: str, timeout: int = 30) -> bytes:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return resp.read()

# --- PDF text extraction: prefer PyPDF2; fallback to plain bytes marker ---
def pdf_bytes_to_text(data: bytes) -> str:
    """
    Try to extract text from a PDF. If PyPDF2 isn't available or fails,
    we return an empty string so caller can still record metadata.
    """
    try:
        import PyPDF2  # type: ignore
        reader = PyPDF2.PdfReader(io.BytesIO(data))
        chunks: List[str] = []
        for page in reader.pages:
            try:
                chunks.append(page.extract_text() or "")
            except Exception:
                pass
        return "\n".join(chunks).strip()
    except Exception:
        # Graceful fallback
        return ""

CURRENCY_RE = re.compile(r"(£|\$|€)\s?([0-9]{1,3}(?:[,\s][0-9]{3})*(?:\.[0-9]{2})?)")
TOTAL_HINT_RE = re.compile(r"\b(total|grand total|amount due|subtotal)\b", re.I)

# A very light heuristic to pull row-like lines: Description, Qty, Unit, Line total
ROW_RE = re.compile(
    r"""
    ^\s*
    (?P<desc>[A-Za-z][^\d\n]{3,}?)\s{2,}         # description blob (no leading numbers)
    (?P<qty>\d+(?:\.\d+)?)\s{1,}                 # qty
    (?P<unit>(?:£|\$|€)?\s?\d[\d,\s]*\.?\d{0,2})\s{1,}  # unit price
    (?P<line>(?:£|\$|€)?\s?\d[\d,\s]*\.?\d{0,2})\s*     # line price
    $
    """,
    re.X | re.I | re.M,
)

def _to_number(s: str) -> Optional[float]:
    s = s.strip()
    s = s.replace(",", "").replace(" ", "")
    s = s.lstrip("£$€")
    try:
        return float(s)
    except Exception:
        return None

def parse_quote_text(text: str) -> Dict[str, Any]:
    """
    Heuristic parser for quotes:
      - finds likely currency
      - tries to pull table-like rows (desc, qty, unit, line)
      - estimates subtotal/total if explicit marker found
    """
    out: Dict[str, Any] = {
        "currency": None,
        "lines": [],             # [{description, qty, unit_price, line_total}]
        "detected_totals": [],   # raw totals spotted in text
        "estimated_total": None,
        "confidence": 0.0,
    }
    if not text:
        return out

    # Currency detection (first currency symbol seen)
    m = CURRENCY_RE.search(text)
    if m:
        out["currency"] = m.group(1)

    # Row extraction
    lines: List[Dict[str, Any]] = []
    for m in ROW_RE.finditer(text):
        desc = m.group("desc").strip()
        qty = _to_number(m.group("qty")) or 0.0
        unit_price = _to_number(m.group("unit") or "") or 0.0
        line_total = _to_number(m.group("line") or "") or (qty * unit_price if qty and unit_price else None)

        if desc and (qty or unit_price or line_total):
            lines.append({
                "description": re.sub(r"\s{2,}", " ", desc),
                "qty": qty,
                "unit_price": unit_price,
                "line_total": line_total,
            })

    out["lines"] = lines

    # Totals spotted near keywords
    totals_found: List[float] = []
    for block in re.split(r"\n{2,}", text):
        if TOTAL_HINT_RE.search(block):
            for m in CURRENCY_RE.finditer(block):
                val = _to_number(m.group(0))
                if val is not None:
                    totals_found.append(val)
    out["detected_totals"] = totals_found

    # Estimate a total if table rows look coherent
    sum_lines = sum([l.get("line_total") or (l["qty"] * l["unit_price"]) or 0.0 for l in lines])
    estimated_total = sum_lines if sum_lines > 0 else (max(totals_found) if totals_found else None)
    out["estimated_total"] = round(estimated_total, 2) if estimated_total else None

    # Confidence: naive score based on signals
    score = 0
    if lines:
        score += 0.5
    if totals_found:
        score += 0.35
    if out["estimated_total"]:
        score += 0.15
    out["confidence"] = round(min(1.0, score), 2)

    return out

def parse_pdf_from_url(url: str, timeout: int = 30) -> Dict[str, Any]:
    """
    Download a PDF from a (signed) URL and parse it into a lightweight structure.
    """
    try:
        raw = _http_get(url, timeout=timeout)
    except Exception as e:
        return {"ok": False, "error": f"download_failed: {e}", "url": url}

    if not raw or (len(raw) > 4 and raw[:4] != b"%PDF"):
        # Still attempt text extraction; some servers strip header in streams
        text = pdf_bytes_to_text(raw)
        if not text:
            return {"ok": False, "error": "not_pdf_or_unreadable", "url": url}
    else:
        text = pdf_bytes_to_text(raw)

    parsed = parse_quote_text(text)
    return {
        "ok": True,
        "url": url,
        "text_chars": len(text),
        "parsed": parsed,
    }