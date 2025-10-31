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
        r"remit\s+to|payment\s+terms|pay\s+within",
        r"account\s+number|sort\s+code",
        r"order\s+number|purchase\s+order",
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
        
    if client_score > supplier_score:
        return "client"
    elif supplier_score > client_score:
        return "supplier"
    else:
        return "unknown"

__all__ = ["extract_text_from_pdf_bytes", "parse_totals_from_text", "parse_quote_lines_from_text", "parse_client_quote_from_text", "determine_quote_type"]
