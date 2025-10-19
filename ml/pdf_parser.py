# ml/pdf_parser.py
from __future__ import annotations
from typing import Dict, Any, List, Tuple
import io, re

# We’ll try pypdf first (pure Python). If needed, you can later add pdfplumber or OCR.
try:
    from pypdf import PdfReader  # pip install pypdf
except Exception:
    PdfReader = None  # type: ignore


def extract_text_from_pdf_bytes(data: bytes) -> str:
    """
    Extracts text from a PDF (bytes) using pypdf.
    Returns a single string (may be empty if the PDF is fully graphical).
    """
    if not data:
        return ""

    if PdfReader is None:
        # pypdf not available
        return ""

    try:
        text_parts: List[str] = []
        reader = PdfReader(io.BytesIO(data))
        for page in reader.pages:
            try:
                t = page.extract_text() or ""
            except Exception:
                t = ""
            if t:
                text_parts.append(t)
        return "\n".join(text_parts).strip()
    except Exception:
        return ""


_money_pat = re.compile(
    r"""
    (?<![\w])            # not part of a longer word
    (?:£|\$|€)?          # optional currency symbol
    \s*
    (?:\d{1,3}(?:,\d{3})*|\d+)   # 1,234 or 1234
    (?:\.\d{2})?         # optional .00
    (?![\w])             # not part of a longer word
    """,
    re.X,
)


def _to_number(s: str) -> float | None:
    try:
        v = s.replace(",", "").replace(" ", "")
        # strip currency symbols
        v = v.lstrip("£$€")
        return float(v)
    except Exception:
        return None


def parse_totals_from_text(text: str) -> Dict[str, Any]:
    """
    Very simple heuristics:
      - scan lines for keywords like Total, Grand Total, Subtotal, VAT
      - collect money values on those lines
      - choose a final 'estimated_total' if we can spot a grand total / total
    """
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    detected: List[Tuple[str, float]] = []  # (label, value)

    KEYWORDS = [
        ("grand_total", r"grand\s*total|amount\s*due|balance\s*due"),
        ("total", r"total\b(?!\s*ex)"),
        ("subtotal", r"\bsub\s*total|\bsubtotal"),
        ("vat", r"\bvat\b|tax|tva|gst"),
    ]
    compiled = [(name, re.compile(pat, re.I)) for name, pat in KEYWORDS]

    for ln in lines:
        money_on_line = _money_pat.findall(ln)
        if not money_on_line:
            continue
        lower = ln.lower()

        for name, creg in compiled:
            if creg.search(lower):
                # Take the last money-looking token on the line (often the rightmost number)
                val = _to_number(money_on_line[-1])
                if val is not None:
                    detected.append((name, val))
                break

    # choose an estimated_total
    est = None
    # prefer grand_total > total > subtotal (+vat if present)
    gts = [v for (name, v) in detected if name == "grand_total"]
    ts = [v for (name, v) in detected if name == "total"]
    subs = [v for (name, v) in detected if name == "subtotal"]
    vats = [v for (name, v) in detected if name == "vat"]

    if gts:
        est = max(gts)
    elif ts:
        est = max(ts)
    elif subs:
        # crude: subtotal + largest VAT we saw
        if vats:
            est = max(subs) + max(vats)
        else:
            est = max(subs)

    out = {
        "detected_totals": [{"label": name, "value": v} for (name, v) in detected],
        "estimated_total": est,
        "currency": _guess_currency(text),
        "confidence": _confidence_from_detected(detected, est),
        "lines": [],  # (line items can be added later)
    }
    return out


def _guess_currency(text: str) -> str | None:
    t = text[:10000]  # just sample
    if "£" in t:
        return "GBP"
    if "€" in t:
        return "EUR"
    if "$" in t:
        return "USD"
    return None


def _confidence_from_detected(detected: List[Tuple[str, float]], est: float | None) -> float:
    # Tiny heuristic scoring
    if est is None:
        return 0.0
    score = 0.4
    if any(name == "grand_total" for name, _ in detected):
        score += 0.4
    if any(name == "vat" for name, _ in detected):
        score += 0.1
    return min(1.0, score)