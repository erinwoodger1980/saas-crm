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

# Try to import PyPDF2 as a lightweight fallback when PyMuPDF is unavailable
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

def _is_gibberish(text: str) -> bool:
    """
    Detect if extracted text is gibberish (wrong encoding/custom fonts).
    Returns True if text quality is too low.
    """
    if not text or len(text) < 20:
        return True
    
    # Remove whitespace for analysis
    clean = text.replace(' ', '').replace('\n', '').replace('\r', '').replace('\t', '')
    if not clean:
        return True
    
    # Count alphanumeric characters
    alpha_count = sum(1 for c in clean if c.isalnum())
    alpha_ratio = alpha_count / len(clean) if len(clean) > 0 else 0
    
    # If less than 50% alphanumeric, it's likely gibberish
    if alpha_ratio < 0.5:
        return True
    
    # Check for excessive extended ASCII (common in encoding issues)
    extended_ascii = sum(1 for c in text[:200] if 127 < ord(c) < 160)
    if extended_ascii > 10:
        return True
    
    # Check if we have recognizable words
    words = text.split()[:30]
    alpha_words = [w for w in words if len(w) > 2 and any(c.isalpha() for c in w)]
    if len(alpha_words) < len(words) * 0.3:  # Less than 30% recognizable words
        return True
    
    return False


def extract_text_from_pdf_bytes(pdf_bytes: bytes) -> str:
    """
    Public API used by main.py.
    1) Try PyMuPDF
    2) Check if result is gibberish, if so try OCR
    3) Fallback to PyPDF2 if available
    4) Final fallback to OCR (if libs present)
    """
    text = _extract_text_pymupdf(pdf_bytes)
    if text.strip() and not _is_gibberish(text):
        return text
    
    # If PyMuPDF gave us gibberish, try OCR immediately
    if text.strip() and _is_gibberish(text):
        ocr = _ocr_pages(pdf_bytes, max_pages=5)
        if ocr.strip() and not _is_gibberish(ocr):
            return ocr

    # Lightweight fallback that works without native dependencies.
    text = _extract_text_pypdf(pdf_bytes)
    if text.strip() and not _is_gibberish(text):
        return text

    # Only try OCR if other methods failed to get anything useful.
    ocr = _ocr_pages(pdf_bytes, max_pages=5)
    return ocr or text or ""  # Return even gibberish text if OCR fails

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

    # Extract currency symbol or code (support GBP/EUR/USD when symbol is missing)
    currency = None
    mcur = re.search(r"(?P<cur>£|\$|€)", text)
    if mcur:
        currency = mcur.group("cur")
    else:
        # Look for common currency codes used in table headers like "Price, GBP"
        if re.search(r"\bGBP\b", text, re.IGNORECASE):
            currency = "GBP"
        elif re.search(r"\bEUR\b", text, re.IGNORECASE):
            currency = "EUR"
        elif re.search(r"\bUSD\b", text, re.IGNORECASE):
            currency = "USD"

    # Extract supplier name (look for common patterns)
    supplier = None
    # Prefer explicit known suppliers to avoid false positives like "from the outside"
    if re.search(r"\bLANGVALDA\b", text, re.IGNORECASE) or re.search(r"@langvalda\.lt", text, re.IGNORECASE):
        supplier = "Langvalda"
    elif re.search(r"\bWealden\s+Joinery\b", text, re.IGNORECASE):
        supplier = "Wealden Joinery"
    elif re.search(r"\bWoodleys\b", text, re.IGNORECASE):
        supplier = "Woodleys"
    else:
        # Restrict generic patterns to the top section of the document
        head = "\n".join(text.split("\n")[:80])
        supplier_patterns = [
            r"(?:invoice|quotation|quote)\s+from\s+([A-Z][A-Za-z\s&]+?)(?:\n|$)",
            r"(?:supplier|vendor)\s*[:\-]?\s*([A-Z][A-Za-z\s&]+?)(?:\n|$)",
            r"^([A-Z][A-Za-z\s&]+?)\s*(?:ltd|limited|inc|corp|company)\.?\s*$",
        ]
        for pat in supplier_patterns:
            match = re.search(pat, head, re.IGNORECASE | re.MULTILINE)
            if match:
                cand = match.group(1).strip()
                # Avoid capturing phrases like "the outside"
                if not re.search(r"\b(outside|inside|left|right)\b", cand, re.IGNORECASE):
                    supplier = cand
                    break

    # Extract line items from table-like structures
    lines = []
    
    # Enhanced patterns for supplier quote tables
    table_patterns = [
        # Pattern: Number. Description [spaces] Qty [spaces] Unit Price [spaces] Total
        r"^\s*\d+\.\s*(.+?)\s+(\d+(?:\.\d+)?)\s+[£$€]\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s+[£$€]\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*$",
        # Pattern: Description [spaces] Qty [spaces] £Unit Price [spaces] £Total  
        r"^(.+?)\s+(\d+(?:\.\d+)?)\s+[£$€]\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s+[£$€]\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*$",
        # Pattern: Unit Price [spaces] Qty [spaces] Total (for lines with price before qty)
        r"^(\d+(?:,\d{3})*(?:\.\d{2})?)\s+(\d+)\s+(\d+(?:,\d{3})*(?:\.\d{2})?)\s*$",
    # Pattern: Description [spaces] Qty [spaces] Unit Price (no currency symbols, must have decimals)
    r"^(.+?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:,\d{3})*\.\d{2})\s*$",
        # Pattern: Description £Price (assuming qty=1)
        r"^(.+?)\s+[£$€]\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*$",
        # Pattern: Qty x Description @ £Price
        r"^(\d+(?:\.\d+)?)\s*x?\s*(.+?)\s*@\s*[£$€]?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*$",
    ]
    
    text_lines = text.split('\n')
    
    # First pass: look for structured table data where each number is on its own line
    # This handles formats like:
    # Dimensions line (2475x2058mm)
    # Area line (5.09m²)
    # Price line (4321.86)
    # [blank line]
    # Qty line (1)
    # Total line (4321.86)
    i = 0
    pending_description = None
    pending_specs = []
    in_quotation_section = False
    seen_langvalda_header = False  # Tracks header triplet: Price, GBP / pcs / Total, GBP
    
    while i < len(text_lines):
        line = text_lines[i].strip()
        
        if not line:
            i += 1
            continue
        
        # Skip dates (e.g., "22 07 2025")
        if re.match(r'^\d{1,2}\s+\d{1,2}\s+\d{4}$', line):
            i += 1
            continue
            
        # Toggle section on brochure-style PDFs
        if re.search(r'^(Detailed Quotation|Ref|Description)$', line, re.IGNORECASE):
            in_quotation_section = True
        if re.search(r'^(Subtotal|VAT|Total Investment|Wealden Joinery Triple Guarantee|Terms & Conditions|Contact Information)$', line, re.IGNORECASE):
            in_quotation_section = False

        # Skip obvious header/footer lines  
        if re.search(r'^(Price,?\s*GBP|pcs|Total,?\s*GBP|Quantity|Pcs:|m2:|Total weight:|TOTAL INVOICE|All prices|Item|Description|Unit|Cost|Validity|Unit / Line|Line Total)', line, re.IGNORECASE):
            # LANGVALDA table header tokens mark a local table context
            if re.search(r'^(Price,?\s*GBP|pcs|Total,?\s*GBP)$', line, re.IGNORECASE):
                seen_langvalda_header = True
            # Reset pending when we hit table headers
            if re.search(r'^(Item|Description|Qty|Unit|Cost)', line, re.IGNORECASE):
                pending_description = None
                pending_specs = []
            i += 1
            continue
        
        # Check if this is a dimension line (e.g., "2475x2058mm" or just "880mm")
        if re.match(r'^\d+x\d+mm', line) or re.match(r'^\d+mm$', line):
            pending_specs.append(line)
            i += 1
            continue

        # Reset local table context when obvious section changes occur
        if re.search(r'^(LANGVALDA /|TOTAL INVOICE|The quote is valid)', line, re.IGNORECASE):
            seen_langvalda_header = False
        
        # Check if this is an area line (e.g., "5.09m²")
        if re.match(r'^\d+(?:\.\d+)?m[²2]$', line, re.IGNORECASE):
            pending_specs.append(line)
            i += 1
            continue

        # Handle TYPE lines of the form "TYPE" then next line "C"
        if in_quotation_section and re.match(r'^TYPE\s*$', line, re.IGNORECASE):
            if i + 1 < len(text_lines):
                code = text_lines[i + 1].strip()
                if re.match(r'^[A-Z0-9]{1,3}$', code):
                    pending_description = f"TYPE {code}"
                    i += 2
                    continue
        
        # Check if this looks like a unit price with currency symbol (e.g., "£1,274.24")
        price_with_currency = re.match(r'^[£$€]\s*(\d+(?:,\d{3})*\.\d{2})$', line)
        if price_with_currency and (pending_description or pending_specs):
            unit_price = float(price_with_currency.group(1).replace(',', ''))
            
            # Look ahead for total on next line (also with currency)
            # But first we might need to find qty
            qty = None
            total = None
            
            # Look backwards for qty - should be a line with just a number a few lines back
            for back_idx in range(max(0, i-5), i):
                back_line = text_lines[back_idx].strip()
                # Look for a standalone number (quantity)
                if re.match(r'^\d+$', back_line):
                    qty = float(back_line)
                    break
            
            # Look ahead for total (next non-blank line with currency)
            j = i + 1
            while j < len(text_lines) and not text_lines[j].strip():
                j += 1
            
            if j < len(text_lines):
                total_line = text_lines[j].strip()
                total_match = re.match(r'^[£$€]\s*(\d+(?:,\d{3})*\.\d{2})$', total_line)
                if total_match:
                    total = float(total_match.group(1).replace(',', ''))
                    
                    if qty and (in_quotation_section or seen_langvalda_header or pending_description):
                        # We have everything!
                        description_parts = []
                        if pending_description:
                            description_parts.append(pending_description)
                        description_parts.extend(pending_specs)
                        
                        description = ' '.join(description_parts)
                        
                        lines.append({
                            "description": description,
                            "qty": qty,
                            "unit_price": unit_price,
                            "total": total
                        })
                        
                        # Reset and jump ahead
                        pending_description = None
                        pending_specs = []
                        i = j + 1
                        continue
            # Special case: delivery fixed charge with only one currency amount (no qty/total lines)
            if (pending_description and re.search(r'delivery', pending_description, re.IGNORECASE)) and (in_quotation_section or pending_description):
                description_parts = []
                if pending_description:
                    description_parts.append(pending_description)
                description_parts.extend(pending_specs)
                description = ' '.join(description_parts)
                lines.append({
                    "description": description,
                    "qty": 1.0,
                    "unit_price": unit_price,
                    "total": unit_price
                })
                pending_description = None
                pending_specs = []
                i += 1
                continue
        
        # Check if this looks like a unit price (decimal number, possibly with commas)
        # But make sure we have some context (description or specs) first
        price_match = re.match(r'^(\d+(?:,\d{3})*\.\d{2})$', line)
        if price_match and (pending_description or pending_specs) and (in_quotation_section or seen_langvalda_header):
            unit_price = float(price_match.group(1).replace(',', ''))
            
            # Look ahead for qty and total on next lines
            qty = None
            total = None
            
            # Skip blank lines
            j = i + 1
            while j < len(text_lines) and not text_lines[j].strip():
                j += 1
            
            # Next should be quantity (could be "1" or "1 pc.")
            if j < len(text_lines):
                qty_line = text_lines[j].strip()
                qty_match = re.match(r'^(\d+(?:\.\d+)?)\s*(?:pc\.?|pcs\.?)?$', qty_line, re.IGNORECASE)
                if qty_match:
                    qty = float(qty_match.group(1))
                    j += 1
                    
                    # Skip blank lines again
                    while j < len(text_lines) and not text_lines[j].strip():
                        j += 1
                    
                    # Next should be total
                    if j < len(text_lines):
                        total_line = text_lines[j].strip()
                        total_match = re.match(r'^(\d+(?:,\d{3})*\.\d{2})$', total_line)
                        if total_match:
                            total = float(total_match.group(1).replace(',', ''))
                            
                            # We found a complete line item!
                            description_parts = []
                            if pending_description:
                                description_parts.append(pending_description)
                            description_parts.extend(pending_specs)
                            
                            description = ' '.join(description_parts)
                            
                            lines.append({
                                "description": description,
                                "qty": qty,
                                "unit_price": unit_price,
                                "total": total
                            })
                            
                            # Reset and jump ahead
                            pending_description = None
                            pending_specs = []
                            i = j + 1
                            continue
        
        # Check if this looks like a description line
        # Must contain letters and not be a header or specification detail
        if re.search(r'[a-zA-Z]{3,}', line):
            # Skip company/supplier names at the top
            if re.search(r'(FENSTERCRAFT|Popieriaus|langvalda|GROUP|^JMS\s+\d|Wealden Joinery)', line, re.IGNORECASE):
                i += 1
                continue
            
            # Skip reference lines
            if re.search(r'Offer #|Reference|Brought Forward|Carried Forward|Quotation Number|Date of Quotation|QUOTATION', line, re.IGNORECASE):
                # Reset pending description if we hit these
                pending_description = None
                pending_specs = []
                i += 1
                continue
            
            # Special handling for "Type:" lines - extract the actual product description
            type_match = re.match(r'^\d+\.\s*Type:\s*(.+)$', line, re.IGNORECASE)
            if type_match and not pending_description:
                pending_description = type_match.group(1).strip()
                i += 1
                continue
            
            # Special handling for product lines like "Screen - (TYPE C)" or "Door"
            product_match = re.match(r'^(Screen|Door|Window|Frame)\s*[-\s]*(\(TYPE\s+[A-Z0-9]+\))?', line, re.IGNORECASE)
            if product_match and not pending_description:
                pending_description = line.strip()
                i += 1
                continue
            
            # Special handling for "Delivery" lines - grab next line too if it continues
            if re.search(r'^Delivery|^Shipping', line, re.IGNORECASE):
                desc_parts = [line]
                # Check if next line continues the description (has letters, no numbers at start)
                if i + 1 < len(text_lines):
                    next_line = text_lines[i + 1].strip()
                    if next_line and re.search(r'^[\(\[]', next_line):  # Starts with ( or [
                        desc_parts.append(next_line)
                        i += 1
                pending_description = ' '.join(desc_parts)
            elif not pending_description:  # Only set if we don't have one yet
                # Product codes like "FD1" can be good descriptions
                if re.match(r'^[A-Z]{2,}\d+$', line):
                    pending_description = line
                # Skip numbered specification lines (1. Type:, 2. Wood:, etc.)
                elif not re.match(r'^\d+\.\s*(Type:|Wood:|Finish:|Glass:|Fittings:|Water|sealing:)', line, re.IGNORECASE):
                    # Skip other spec patterns
                    if not re.match(r'^(View from|edge |double cylinder)', line):
                        # Also skip lines that look like they're part of terms/conditions
                        if not re.search(r'(valid for|excl\. VAT|unloading|tempered panes|Thank you for|represent your|your booking|Price is for|Price does not|Project Overview|Client Details|Specification|Highlights|Project Scope|Unit / Line|Line Total|Ref)', line, re.IGNORECASE):
                            # Skip contact info and website
                            if not re.search(r'(\+\d{3}|www\.|@|Tel\.|Email|Telephone:|Phone:|Address:)', line):
                                pending_description = line
        
        i += 1
    
    # Second pass: traditional single-line parsing
    for line in text_lines:
        line = line.strip()
        if not line or len(line) < 10:  # Skip very short lines
            continue
            
        # Skip header lines and footer lines
        skip_patterns = [
            r"(description|item|quantity|qty|price|total|sub.*total)",
            r"(vat|tax|delivery|payment|terms|contact|phone|email|address|business\s+hours)",
            r"^(subtotal|grand.*total|balance|amount.*due)",
            r"^\s*[£$€]\s*[\d,]+\.?\d*\s*$",  # Lines with only money amounts
            r"^(Wealden Joinery|Project Overview|Client Details|Specification|Highlights|Project Scope)$",
        ]
        
        should_skip = False
        for skip_pattern in skip_patterns:
            if re.search(skip_pattern, line, re.IGNORECASE):
                should_skip = True
                break
        
        if should_skip:
            continue
            
        # Try each pattern
        for i, pattern in enumerate(table_patterns):
            match = re.match(pattern, line, re.IGNORECASE)
            if match:
                if i == 0:  # Number. Description Qty Unit Price Total
                    description = match.group(1).strip()
                    qty = float(match.group(2))
                    unit_price = float(match.group(3).replace(',', ''))
                    total = float(match.group(4).replace(',', ''))
                elif i == 1:  # Description Qty £Unit Price £Total
                    description = match.group(1).strip()
                    qty = float(match.group(2))
                    unit_price = float(match.group(3).replace(',', ''))
                    total = float(match.group(4).replace(',', ''))
                elif i == 2:  # Unit Price Qty Total (numbers only)
                    # This is just numbers, skip it as we handled it above
                    continue
                elif i == 3:  # Description Qty Unit Price
                    description = match.group(1).strip()
                    qty = float(match.group(2))
                    unit_price = float(match.group(3).replace(',', ''))
                    total = qty * unit_price
                elif i == 4:  # Description Price (qty=1)
                    description = match.group(1).strip()
                    qty = 1.0
                    unit_price = float(match.group(2).replace(',', ''))
                    total = unit_price
                elif i == 5:  # Qty x Description @ Price
                    qty = float(match.group(1))
                    description = match.group(2).strip()
                    unit_price = float(match.group(3).replace(',', ''))
                    total = qty * unit_price
                
                # Filter out likely non-item lines
                skip_keywords = ['total', 'subtotal', 'vat', 'tax', 'delivery', 'shipping', 'discount', 'payment', 'terms', 'reference', 'invoice']
                if not any(keyword in description.lower() for keyword in skip_keywords) and len(description) > 3:
                    lines.append({
                        "description": description,
                        "qty": qty,
                        "unit_price": unit_price,
                        "total": total
                    })
                break

    # If no structured lines found, try to extract from more freeform text
    if not lines:
        # Look for "Delivery" followed by price and quantity on next line
        # Pattern: Delivery to London area TBC* \n 990.01  1 pc.  990.01
        for i, line in enumerate(text_lines):
            if re.search(r'delivery|shipping', line, re.IGNORECASE):
                # Check next few lines for pricing
                for j in range(i+1, min(i+4, len(text_lines))):
                    next_line = text_lines[j].strip()
                    delivery_match = re.match(r'(\d+(?:,\d{3})*(?:\.\d{2})?)\s+(\d+)\s*(?:pc|pcs)?\.?\s+(\d+(?:,\d{3})*(?:\.\d{2})?)', next_line)
                    if delivery_match:
                        unit_price = float(delivery_match.group(1).replace(',', ''))
                        qty = float(delivery_match.group(2))
                        total = float(delivery_match.group(3).replace(',', ''))
                        
                        lines.append({
                            "description": line.strip(),
                            "qty": qty,
                            "unit_price": unit_price,
                            "total": total
                        })
                        break
        
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
        r"total\s+invoice\s*[:\-]?\s*[£$€]?\s*(\d[\d,]*\.?\d*)",
        r"total\s+investment\s*[:\-]?\s*[£$€]?\s*(\d[\d,]*\.?\d*)",
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
    # Delegate to the enhanced parser for full line item extraction
    return parse_quote_lines_from_text(text)


def parse_client_quote_from_text(text: str) -> Dict[str, Any]:
    """
    Parse client quotes (from emails) to extract training data for ML models.
    
    Returns a dict with:
      - questionnaire_answers (dict) - extracted project requirements and specifications
      - project_details (dict) - area, location, materials, etc.
      - quoted_price (float|None) - total price quoted to client
      - line_items (list[dict]) - individual quoted items
      - outcome (str|None) - won/lost status if available
      - confidence (float) - 0..1 confidence score
    """
    if not text:
        return {
            "questionnaire_answers": {},
            "project_details": {},
            "quoted_price": None,
            "line_items": [],
            "outcome": None,
            "confidence": 0.0,
        }
    
    # Initialize return structure
    questionnaire_answers = {}
    project_details = {}
    line_items = []
    quoted_price = None
    confidence = 0.0
    
    # Extract company/client information
    client_name = None
    client_match = re.search(r"^([A-Z][A-Za-z\s]+)$", text, re.MULTILINE)
    if client_match:
        client_name = client_match.group(1).strip()
        project_details["client_name"] = client_name
    
    # Extract reference and project information
    ref_match = re.search(r"Reference\s*([A-Za-z0-9]+)", text, re.IGNORECASE)
    if ref_match:
        project_details["reference"] = ref_match.group(1)
    
    # Extract estimate details
    estimate_match = re.search(r"Estimate Number\s*([A-Za-z0-9]+)", text, re.IGNORECASE)
    if estimate_match:
        project_details["estimate_number"] = estimate_match.group(1)
    
    # Extract date
    date_match = re.search(r"Date of Estimate\s*(\d{1,2}\s+\w+\s+\d{4})", text, re.IGNORECASE)
    if date_match:
        project_details["estimate_date"] = date_match.group(1)
    
    # Extract validity period
    validity_match = re.search(r"Validity\s*(\d+\s+days)", text, re.IGNORECASE)
    if validity_match:
        project_details["validity"] = validity_match.group(1)
    
    # Extract project location/name
    location_patterns = [
        r"([A-Z][A-Za-z\s]+(?:Church|School|Hospital|Centre|Hall|Building))",
        r"^([A-Z][A-Za-z\s]+)$",  # Generic location line
    ]
    for pattern in location_patterns:
        location_match = re.search(pattern, text, re.MULTILINE)
        if location_match and "Wealden" not in location_match.group(1):
            project_details["project_location"] = location_match.group(1).strip()
            break
    
    # Extract project type from context
    if re.search(r"window|sash|frame", text, re.IGNORECASE):
        questionnaire_answers["project_type"] = "windows"
    elif re.search(r"door|entrance", text, re.IGNORECASE):
        questionnaire_answers["project_type"] = "doors"
    elif re.search(r"joinery|timber|wood", text, re.IGNORECASE):
        questionnaire_answers["project_type"] = "joinery"
    
    # Extract materials information
    wood_types = []
    if re.search(r"ACCOYA", text, re.IGNORECASE):
        wood_types.append("Accoya")
    if re.search(r"Lead Weights", text, re.IGNORECASE):
        questionnaire_answers["lead_weights"] = True
    if re.search(r"Weatherstrip", text, re.IGNORECASE):
        questionnaire_answers["weatherstrip"] = True
    
    if wood_types:
        questionnaire_answers["wood_type"] = wood_types[0]
        questionnaire_answers["materials_grade"] = "premium" if "Accoya" in wood_types else "standard"
    
    # Extract line items from the main table
    lines = text.split('\n')
    in_items_section = False
    total_area = 0.0
    
    for i, line in enumerate(lines):
        line = line.strip()
        
        # Look for item table headers
        if re.search(r"Item\s+Description\s+Number\s+Width\s+Height", line, re.IGNORECASE):
            in_items_section = True
            continue
        
        # Stop at totals section
        if re.search(r"VAT|Total|£\d", line) and "Description" not in line:
            in_items_section = False
        
        if in_items_section and line:
            # Parse sliding sash items
            if re.search(r"Sliding Sash", line, re.IGNORECASE):
                # Look for next lines with details
                description = line
                specs = {}
                
                # Extract dimensions and quantity from current and next lines
                for j in range(i, min(i+5, len(lines))):
                    detail_line = lines[j].strip()
                    
                    # Extract quantity
                    qty_match = re.search(r"(\d+)\s+(\d+mm)\s+(\d+mm)", detail_line)
                    if qty_match:
                        qty = int(qty_match.group(1))
                        width = qty_match.group(2)
                        height = qty_match.group(3)
                        
                        # Calculate area
                        width_mm = int(width.replace('mm', ''))
                        height_mm = int(height.replace('mm', ''))
                        area_m2 = (width_mm * height_mm * qty) / 1000000
                        total_area += area_m2
                        
                        line_items.append({
                            "description": description,
                            "quantity": qty,
                            "width": width,
                            "height": height,
                            "area_m2": round(area_m2, 2),
                            "specifications": specs
                        })
                        break
                    
                    # Extract specifications
                    if re.search(r"BOX FRAME|Lead Weights|Weatherstrip|ACCOYA", detail_line, re.IGNORECASE):
                        specs["details"] = detail_line
    
    # Calculate total project area
    if total_area > 0:
        questionnaire_answers["area_m2"] = round(total_area, 2)
        project_details["total_area_m2"] = round(total_area, 2)
    
    # Extract pricing information
    # Look for subtotal, VAT, and total
    subtotal_match = re.search(r"£([\d,]+\.?\d*)\s*VAT", text)
    if subtotal_match:
        subtotal = float(subtotal_match.group(1).replace(',', ''))
        project_details["subtotal"] = subtotal
    
    vat_match = re.search(r"VAT.*?£([\d,]+\.?\d*)", text)
    if vat_match:
        vat = float(vat_match.group(1).replace(',', ''))
        project_details["vat"] = vat
    
    total_match = re.search(r"Total\s*£([\d,]+\.?\d*)", text)
    if total_match:
        quoted_price = float(total_match.group(1).replace(',', ''))
        project_details["total"] = quoted_price
    
    # Calculate confidence based on extracted data
    confidence_factors = 0
    if quoted_price: confidence_factors += 3
    if line_items: confidence_factors += 2
    if questionnaire_answers.get("project_type"): confidence_factors += 2
    if project_details.get("project_location"): confidence_factors += 1
    if questionnaire_answers.get("area_m2"): confidence_factors += 2
    
    confidence = min(confidence_factors / 10.0, 1.0)
    
    return {
        "questionnaire_answers": questionnaire_answers,
        "project_details": project_details,
        "quoted_price": quoted_price,
        "line_items": line_items,
        "outcome": None,  # Would need to be determined from follow-up data
        "confidence": confidence,
    }

def determine_quote_type(text: str) -> str:
    """
    Determine if this is a supplier quote or client quote based on content.
    
    Returns:
      - "supplier" - quote from a supplier/vendor (for line item extraction)
      - "client" - quote to a client (for ML training)
      - "unknown" - cannot determine type
    """
    if not text:
        return "unknown"
    
    # Look for indicators of supplier quotes
    supplier_indicators = [
        r"supplier|vendor|invoice\s+from|quote\s+from",
        r"remit\s+to|payment\s+terms|pay\s+within|net\s+\d+\s+days",
        r"account\s+number|sort\s+code|bank\s+details",
        r"order\s+number|purchase\s+order",
        r"quote\s+reference.*[A-Z]{2,}\d+",  # Quote references like JS2024-001
        r"supplies?\s+ltd|materials?\s+ltd|joinery\s+supplies",
        r"terms:.*net|payment.*due",
    ]
    
    # Look for indicators of client quotes (estimates/proposals to customers)
    client_indicators = [
        r"ESTIMATE|QUOTATION|PROPOSAL",
        r"Reference\s*[A-Za-z0-9]+.*Estimate\s+Number",
        r"Date\s+of\s+Estimate|Validity\s*\d+\s+days",
        r"dear\s+(?:mr|mrs|ms|miss)",
        r"thank\s+you\s+for\s+your\s+enquiry",
        r"we\s+are\s+pleased\s+to\s+quote",
        r"project\s+requirements|questionnaire",
        r"terms\s+and\s+conditions\s+apply",
        r"VAT\s+@\s+\d+%.*Total",  # Client quotes show VAT breakdown
        r"Item\s+Description\s+Number\s+Width\s+Height",  # Detailed specification table
        r"specialists\s+in.*joinery",
    ]
    
    supplier_score = 0
    client_score = 0
    
    for pattern in supplier_indicators:
        if re.search(pattern, text, re.IGNORECASE):
            supplier_score += 1
            
    for pattern in client_indicators:
        if re.search(pattern, text, re.IGNORECASE):
            client_score += 1
    
    # Strong indicators for client quotes
    if re.search(r"ESTIMATE.*Reference.*Windows", text, re.IGNORECASE | re.DOTALL):
        client_score += 3
    if re.search(r"Specialists\s+in.*Joinery", text, re.IGNORECASE):
        client_score += 2
        
    # Strong indicators for supplier quotes
    if re.search(r"Item\s+Description\s+Qty\s+Unit\s+Price", text, re.IGNORECASE):
        supplier_score += 2
    if re.search(r"Subtotal.*VAT.*Total", text, re.IGNORECASE | re.DOTALL):
        supplier_score += 1
        
    if client_score > supplier_score:
        return "client"
    elif supplier_score > client_score:
        return "supplier"
    else:
        return "unknown"

__all__ = ["extract_text_from_pdf_bytes", "parse_totals_from_text", "parse_quote_lines_from_text", "parse_client_quote_from_text", "determine_quote_type"]
