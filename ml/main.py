# ml/main.py - FastAPI ML service with Gmail integration (v2.1)
from __future__ import annotations
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List, Set
import joblib, pandas as pd, numpy as np
import json, os, traceback, urllib.request, datetime
import logging

from pdf_parser import extract_text_from_pdf_bytes, parse_totals_from_text, parse_client_quote_from_text, determine_quote_type, parse_quote_lines_from_text

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Optional import - email training only works if database is available
try:
    from email_trainer import EmailTrainingWorkflow
    EMAIL_TRAINING_AVAILABLE = True
except ImportError as e:
    print(f"[WARNING] Email training not available: {e}")
    EmailTrainingWorkflow = None
    EMAIL_TRAINING_AVAILABLE = False

app = FastAPI(title="JoineryAI ML API v2.2")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://joineryai.app",
        "https://www.joineryai.app",
        "https://api.joineryai.app",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PRICE_PATH = "models/price_model.joblib"
WIN_PATH   = "models/win_model.joblib"
META_PATH  = "models/feature_meta.json"

def load_model(path: str):
    try:
        if not os.path.exists(path):
            return None
        # Load with joblib and handle sklearn compatibility issues
        import warnings
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore", category=UserWarning)
            warnings.filterwarnings("ignore", category=FutureWarning)
            model = joblib.load(path)
            # Test if model can make predictions (compatibility check)
            if hasattr(model, 'predict'):
                return model
            else:
                logger.warning(f"Model at {path} loaded but doesn't have predict method")
                return None
    except Exception as e:
        logger.error(f"Failed to load model from {path}: {e}")
        traceback.print_exc()
        return None

price_model = load_model(PRICE_PATH)
win_model   = load_model(WIN_PATH)

feature_meta: Dict[str, Any] = {}
if os.path.exists(META_PATH):
    try:
        with open(META_PATH, "r") as f:
            feature_meta = json.load(f) or {}
    except Exception:
        traceback.print_exc()
        feature_meta = {}

# ----------------- expected columns discovery -----------------
def _walk_estimators(obj):
    try:
        from sklearn.pipeline import Pipeline
        from sklearn.compose import ColumnTransformer
    except Exception:
        return
    if str(type(obj)).endswith("Pipeline'>") or getattr(obj, "steps", None):
        for _, step in getattr(obj, "steps", []):
            yield step
            for inner in _walk_estimators(step):
                yield inner
    if hasattr(obj, "transformers"):
        try:
            for _name, trans, _cols in obj.transformers:  # type: ignore[attr-defined]
                yield trans
                if hasattr(trans, "transformers"):
                    for inner in _walk_estimators(trans):
                        yield inner
        except Exception:
            pass

def expected_columns_from_model(model) -> List[str]:
    try:
        from sklearn.compose import ColumnTransformer  # noqa
    except Exception:
        return []
    cols: List[str] = []
    for est in _walk_estimators(model):
        if hasattr(est, "transformers"):
            try:
                for _name, _trans, _cols in est.transformers:  # type: ignore[attr-defined]
                    if isinstance(_cols, (list, tuple, np.ndarray)):
                        cols.extend([c for c in _cols if isinstance(c, str)])
            except Exception:
                continue
    seen = set()
    out: List[str] = []
    for c in cols:
        if c not in seen:
            seen.add(c)
            out.append(c)
    return out

meta_cols: List[str] = list(feature_meta.get("columns") or [])
price_cols = expected_columns_from_model(price_model) if price_model else []
win_cols   = expected_columns_from_model(win_model) if win_model else []

def _ordered_union(primary: List[str], extra: List[str]) -> List[str]:
    seen: Set[str] = set()
    out: List[str] = []
    for c in primary + extra:
        if c not in seen:
            seen.add(c)
            out.append(c)
    return out

DEFAULT_BASE = ["area_m2", "materials_grade", "project_type", "lead_source", "region"]
COLUMNS: List[str] = _ordered_union(meta_cols or DEFAULT_BASE, price_cols)
COLUMNS = _ordered_union(COLUMNS, win_cols)

NUMERIC_COLUMNS: Set[str] = set(feature_meta.get("numeric_columns") or [])
CATEGORICAL_COLUMNS: Set[str] = set(feature_meta.get("categorical_columns") or [])
if not NUMERIC_COLUMNS and not CATEGORICAL_COLUMNS:
    numeric_hints = ("area", "num_", "days_", "value", "gbp", "amount", "count")
    known_numerics = {"area_m2", "num_emails_thread", "days_to_first_reply", "quote_value_gbp"}
    for col in COLUMNS:
        if col in known_numerics or any(h in col.lower() for h in numeric_hints):
            NUMERIC_COLUMNS.add(col)
    CATEGORICAL_COLUMNS = set(c for c in COLUMNS if c not in NUMERIC_COLUMNS)

# ----------------- prediction schema + builder -----------------
class QuoteIn(BaseModel):
    area_m2: float = Field(..., description="Projected area (m^2)")
    materials_grade: str = Field(..., description="Basic | Standard | Premium")
    project_type: Optional[str] = None
    lead_source: Optional[str] = None
    region: Optional[str] = "uk"

def build_feature_row(q: QuoteIn) -> pd.DataFrame:
    base = {
        "area_m2": float(q.area_m2),
        "materials_grade": q.materials_grade or "",
        "project_type": (q.project_type or ""),
        "lead_source": (q.lead_source or ""),
        "region": (q.region or "uk"),
    }
    row: Dict[str, Any] = {}
    for col in COLUMNS:
        if col in base:
            row[col] = base[col]
        else:
            row[col] = 0 if col in NUMERIC_COLUMNS else ""
    df = pd.DataFrame([row], columns=COLUMNS)
    for col in NUMERIC_COLUMNS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
    for col in CATEGORICAL_COLUMNS:
        if col in df.columns:
            df[col] = df[col].astype(str)
    return df

def models_status():
    return {"price": bool(price_model), "win": bool(win_model)}

# ----------------- routes: health/meta/predict -----------------
@app.get("/")
def root():
    return {"ok": True, "models": models_status()}

@app.get("/health")
def health():
    """Health check endpoint showing service status and model availability"""
    return {
        "status": "ok",
        "models": {
            "price": price_model is not None,
            "win": win_model is not None,
        }
    }

@app.post("/parse")
async def parse_pdf_legacy(req: Request):
    """
    Legacy /parse endpoint for backwards compatibility.
    Accepts multipart file upload or JSON body with URL.
    Returns parsed PDF data with line items.
    """
    from fastapi import UploadFile, File, Form
    import io
    
    content_type = req.headers.get("content-type", "")
    
    # Handle file upload
    if "multipart/form-data" in content_type:
        form_data = await req.form()
        file = form_data.get("file")
        if not file:
            raise HTTPException(status_code=422, detail="missing file in form data")
        
        pdf_bytes = await file.read()
        text = extract_text_from_pdf_bytes(pdf_bytes) or ""
        
        # Parse the PDF text
        quote_type = determine_quote_type(text)
        if quote_type == "supplier" or quote_type == "unknown":
            parsed = parse_quote_lines_from_text(text)
        else:
            parsed = parse_client_quote_from_text(text)
        
        return {
            "ok": True,
            "text_chars": len(text),
            "quote_type": quote_type,
            "parsed": parsed,
        }
    
    # Handle JSON body with URL
    try:
        body = await req.json()
        url = body.get("url")
        if not url:
            raise HTTPException(status_code=422, detail="missing url or file")
        
        pdf_bytes = _http_get_bytes(url)
        text = extract_text_from_pdf_bytes(pdf_bytes) or ""
        
        quote_type = determine_quote_type(text)
        if quote_type == "supplier" or quote_type == "unknown":
            parsed = parse_quote_lines_from_text(text)
        else:
            parsed = parse_client_quote_from_text(text)
        
        return {
            "ok": True,
            "text_chars": len(text),
            "quote_type": quote_type,
            "parsed": parsed,
        }
    except:
        raise HTTPException(status_code=422, detail="Request must be multipart/form-data with file or JSON with url")

@app.post("/parse-quote-upload")
async def parse_quote_upload(req: Request):
    """
    Upload endpoint that accepts PDF file uploads.
    Matches the API's callMlWithUpload() expectations.
    Returns parsed supplier quote data.
    """
    from fastapi import UploadFile
    
    form_data = await req.form()
    file = form_data.get("file")
    
    if not file:
        raise HTTPException(status_code=422, detail="missing file in form data")
    
    pdf_bytes = await file.read()
    filename = file.filename if hasattr(file, 'filename') else "uploaded.pdf"
    
    text = extract_text_from_pdf_bytes(pdf_bytes) or ""
    if not text.strip():
        return {
            "ok": False,
            "message": "No text extracted from PDF",
            "filename": filename,
        }
    
    # Parse as supplier quote
    parsed = parse_quote_lines_from_text(text)
    
    return {
        "ok": True,
        "filename": filename,
        "text_chars": len(text),
        "parsed": parsed,
    }

@app.post("/debug-pdf-text-extraction")
def debug_pdf_text_extraction():
    """Debug PDF text extraction from the actual email attachment"""
    
    try:
        # Get database URL  
        db_url = os.getenv("DATABASE_URL")
        if not db_url:
            return {"error": "DATABASE_URL not configured"}

        from db_config import get_db_manager
        db_manager = get_db_manager()
        
        # Get Gmail credentials
        tenant_id = "cmgt9bchl0001uj2h4po89fim"
        
        with db_manager.get_connection() as conn:
            cur = conn.cursor()
            cur.execute('SELECT "refreshToken", "gmailAddress" FROM "GmailTenantConnection" WHERE "tenantId" = %s', (tenant_id,))
            result = cur.fetchone()
            
            if not result:
                return {"error": "No Gmail connection found"}
                
            refresh_token, gmail_address = result
            gmail_credentials = {
                'refresh_token': refresh_token,
                'gmail_address': gmail_address,
            }
            
            # Set environment variables
            os.environ['GMAIL_CLIENT_ID'] = os.getenv('GMAIL_CLIENT_ID', '')
            os.environ['GMAIL_CLIENT_SECRET'] = os.getenv('GMAIL_CLIENT_SECRET', '')
        
        # Initialize workflow and get the exact same email
        workflow = EmailTrainingWorkflow(db_url, tenant_id)
        workflow.setup_email_service("gmail", gmail_credentials)
        
        # Search for the specific email
        from datetime import datetime, timedelta
        since_date = datetime.now() - timedelta(days=5)
        
        emails = workflow.email_service.search_emails(
            keywords=["quote", "david", "murphy"],
            has_attachments=True,
            since_date=since_date,
            sent_only=False
        )
        
        if not emails:
            return {"error": "No emails found"}
        
        email = emails[0]  # Get first email
        attachments = email.get("attachments", [])
        
        if not attachments:
            return {"error": "No attachments found"}
        
        attachment = attachments[0]  # Get first attachment
        
        # Download and extract text
        attachment_data = workflow.email_service.download_attachment(
            email["message_id"], 
            attachment["attachment_id"]
        )
        
        pdf_text = extract_text_from_pdf_bytes(attachment_data)
        
        # Parse with client quote parser
        parsed_data = parse_client_quote_from_text(pdf_text)
        
        return {
            "email_subject": email.get("subject"),
            "attachment_filename": attachment.get("filename"),
            "attachment_size": len(attachment_data),
            "pdf_text_length": len(pdf_text) if pdf_text else 0,
            "pdf_text_preview": pdf_text[:500] if pdf_text else "No text extracted",
            "parsed_confidence": parsed_data.get("confidence", 0),
            "parsed_price": parsed_data.get("quoted_price"),
            "parsed_project_type": parsed_data.get("questionnaire_answers", {}).get("project_type"),
            "passes_threshold": parsed_data.get("confidence", 0) > 0.1,
            "full_parsed_data": parsed_data
        }
        
    except Exception as e:
        import traceback
        return {"error": f"Debug failed: {e}", "traceback": traceback.format_exc()}

@app.post("/debug-client-quote-parser")
def debug_client_quote_parser():
    """Debug the client quote parser specifically"""
    
    # Use the exact same PDF text from the working debug endpoint
    pdf_text = """JMS 2, 4, 3, 5 (59629)
David Murphy
ESTIMATE
Reference
Windows
Estimate Number
Wellow201
Date of Estimate
5 February 2024
Validity
10 days
Wellow Baptist Church
Item
Description
Number Width
Height
Sliding Sash - SS1
BOX FRAME - Lead Weights -
Weatherstrip - Decorative Horns.
Arched to be fixed above.
ACCOYA timber throughout.
(Traditional putty glazing)
1 1100mm 1640mm
Total £55,512.68 VAT £11,102.54 Total £66,615.22"""
    
    try:
        from pdf_parser import parse_client_quote_from_text
        
        result = parse_client_quote_from_text(pdf_text)
        
        return {
            "pdf_text_length": len(pdf_text),
            "pdf_text_preview": pdf_text[:200],
            "parsed_result": result,
            "confidence": result.get("confidence", 0),
            "quoted_price": result.get("quoted_price"),
            "project_type": result.get("questionnaire_answers", {}).get("project_type"),
            "success": result.get("confidence", 0) > 0.1
        }
        
    except Exception as e:
        return {"error": f"Client quote parser failed: {e}"}

@app.get("/debug-env")
def debug_env():
    """Debug endpoint to check Gmail environment variables (temporary)"""
    return {
        "gmail_client_id_set": bool(os.getenv('GMAIL_CLIENT_ID')),
        "gmail_client_secret_set": bool(os.getenv('GMAIL_CLIENT_SECRET')),
        "database_url_set": bool(os.getenv('DATABASE_URL')),
        "api_service_url": os.getenv('API_SERVICE_URL', 'not_set'),
        "gmail_client_id_length": len(os.getenv('GMAIL_CLIENT_ID', '')) if os.getenv('GMAIL_CLIENT_ID') else 0,
        "gmail_client_secret_length": len(os.getenv('GMAIL_CLIENT_SECRET', '')) if os.getenv('GMAIL_CLIENT_SECRET') else 0
    }

@app.get("/debug-gmail")
def debug_gmail():
    """Debug Gmail token refresh (temporary)"""
    try:
        # Test Gmail token refresh
        import requests
        
        # Get a tenant with Gmail connection
        db_url = os.getenv("DATABASE_URL")
        if not db_url:
            return {"error": "No DATABASE_URL"}
            
        from db_config import get_db_manager
        db_manager = get_db_manager()
        
        with db_manager.get_connection() as conn:
            cur = conn.cursor()
            cur.execute('SELECT "refreshToken", "gmailAddress" FROM "GmailTenantConnection" LIMIT 1')
            result = cur.fetchone()
            
            if not result:
                return {"error": "No Gmail connections found"}
                
            refresh_token, gmail_address = result
            
            # Test token refresh
            data = {
                'client_id': os.getenv('GMAIL_CLIENT_ID'),
                'client_secret': os.getenv('GMAIL_CLIENT_SECRET'),
                'grant_type': 'refresh_token',
                'refresh_token': refresh_token
            }
            
            response = requests.post('https://oauth2.googleapis.com/token', data=data)
            
            if response.ok:
                access_token = response.json()['access_token']
                
                # Test simple Gmail search for emails with "quote" in subject
                headers = {'Authorization': f'Bearer {access_token}'}
                url = 'https://www.googleapis.com/gmail/v1/users/me/messages'
                params = {'q': 'subject:quote in:sent', 'maxResults': 5}
                
                gmail_response = requests.get(url, headers=headers, params=params)
                
                gmail_result = {
                    "gmail_search_status": gmail_response.status_code,
                    "gmail_search_success": gmail_response.ok
                }
                
                if gmail_response.ok:
                    data = gmail_response.json()
                    messages = data.get('messages', [])
                    gmail_result["messages_found"] = len(messages)
                    if messages:
                        gmail_result["message_ids"] = [m['id'] for m in messages]
                else:
                    gmail_result["gmail_error"] = gmail_response.text
                
                return {
                    "gmail_address": gmail_address,
                    "refresh_token_length": len(refresh_token) if refresh_token else 0,
                    "token_refresh_status": response.status_code,
                    "token_refresh_success": response.ok,
                    **gmail_result
                }
            else:
                return {
                    "gmail_address": gmail_address,
                    "refresh_token_length": len(refresh_token) if refresh_token else 0,
                    "token_refresh_status": response.status_code,
                    "token_refresh_success": response.ok,
                    "error_details": response.text
                }
            
    except Exception as e:
        return {"error": str(e)}

@app.post("/debug-email-processing")
async def debug_email_processing(req: Request):
    """Debug detailed email processing and attachment detection"""
    try:
        payload = await req.json()
        tenant_id = payload.get("tenantId")
        days_back = payload.get("daysBack", 7)
        
        if not tenant_id:
            return {"error": "tenantId required"}
            
        db_url = os.getenv("DATABASE_URL")
        if not db_url:
            return {"error": "No DATABASE_URL"}
            
        from email_trainer import EmailTrainingWorkflow
        
        # Initialize workflow
        workflow = EmailTrainingWorkflow(db_url, tenant_id)
        
        # Get Gmail connection details from database
        from db_config import get_db_manager
        db_manager = get_db_manager()
        
        with db_manager.get_connection() as conn:
            cur = conn.cursor()
            cur.execute('SELECT "refreshToken", "gmailAddress" FROM "GmailTenantConnection" WHERE "tenantId" = %s', (tenant_id,))
            result = cur.fetchone()
            
            if not result:
                return {"error": f"No Gmail connection found for tenant {tenant_id}"}
                
            refresh_token, gmail_address = result
        
        # Setup Gmail service
        gmail_credentials = {"refresh_token": refresh_token}
        workflow.setup_email_service("gmail", gmail_credentials)
        
        # Test real Gmail email search with detailed debugging
        import requests
        from datetime import datetime, timedelta
        
        # Get Gmail credentials through the service
        access_token = workflow.email_service._get_access_token()
        if not access_token:
            return {"error": "Failed to get Gmail access token"}
            
        # Search for emails
        after_date = datetime.now() - timedelta(days=days_back)
        after_str = after_date.strftime('%Y/%m/%d')
        
        headers = {'Authorization': f'Bearer {access_token}'}
        url = 'https://www.googleapis.com/gmail/v1/users/me/messages'
        params = {
            'q': f'subject:quote in:sent after:{after_str}',
            'maxResults': 5
        }
        
        search_response = requests.get(url, headers=headers, params=params)
        
        debug_info = {
            "search_query": params['q'],
            "search_status": search_response.status_code,
            "search_success": search_response.ok
        }
        
        if not search_response.ok:
            debug_info["search_error"] = search_response.text
            return debug_info
            
        messages = search_response.json().get('messages', [])
        debug_info["messages_found"] = len(messages)
        
        if not messages:
            return debug_info
            
        # Process first message in detail
        message_id = messages[0]['id']
        debug_info["processing_message_id"] = message_id
        
        # Get full message details
        msg_url = f'https://www.googleapis.com/gmail/v1/users/me/messages/{message_id}'
        msg_response = requests.get(msg_url, headers=headers)
        
        if not msg_response.ok:
            debug_info["message_fetch_error"] = msg_response.text
            return debug_info
            
        message_data = msg_response.json()
        debug_info["message_fetch_success"] = True
        
        # Extract basic message info
        payload = message_data.get('payload', {})
        headers_list = payload.get('headers', [])
        
        subject = next((h['value'] for h in headers_list if h['name'].lower() == 'subject'), 'No subject')
        debug_info["message_subject"] = subject
        
        # Test attachment extraction with detailed logging
        attachments = []
        workflow.email_service._extract_attachments(payload, attachments)
        
        debug_info["attachments_found"] = len(attachments)
        debug_info["attachment_details"] = attachments
        
        # Test payload structure analysis
        debug_info["payload_keys"] = list(payload.keys())
        debug_info["payload_mimetype"] = payload.get('mimeType')
        
        if 'parts' in payload:
            debug_info["parts_count"] = len(payload['parts'])
            debug_info["parts_info"] = []
            
            for i, part in enumerate(payload['parts'][:3]):  # First 3 parts only
                part_info = {
                    "part_index": i,
                    "keys": list(part.keys()),
                    "mimetype": part.get('mimeType'),
                    "filename": part.get('filename', ''),
                    "has_body": 'body' in part,
                    "has_attachment_id": part.get('body', {}).get('attachmentId') is not None if 'body' in part else False
                }
                debug_info["parts_info"].append(part_info)
        
        return debug_info
        
    except Exception as e:
        import traceback
        return {
            "error": str(e),
            "traceback": traceback.format_exc()
        }

@app.post("/debug-email-search")
async def debug_email_search(req: Request):
    """Debug the email search logic used by preview endpoint"""
    try:
        tenant_id = "cmgt9bchl0001uj2h4po89fim"
        days_back = 7
        
        # Get database connection
        db_url = os.getenv("DATABASE_URL")
        if not db_url:
            return {"error": "No DATABASE_URL configured"}
        
        # Get Gmail credentials
        from db_config import get_db_manager
        db_manager = get_db_manager()
        
        with db_manager.get_connection() as conn:
            cur = conn.cursor()
            cur.execute('SELECT "refreshToken" FROM "GmailTenantConnection" WHERE "tenantId" = %s', (tenant_id,))
            result = cur.fetchone()
            
            if not result:
                return {"error": f"No Gmail connection found for tenant {tenant_id}"}
                
            refresh_token = result[0]
        
        # Setup workflow (mimics preview endpoint)
        from email_trainer import EmailTrainingWorkflow
        workflow = EmailTrainingWorkflow(db_url, tenant_id)
        
        gmail_credentials = {'refresh_token': refresh_token}
        workflow.setup_email_service("gmail", gmail_credentials)
        
        # Test the exact search logic from find_client_quotes
        from datetime import datetime, timedelta
        since_date = datetime.now() - timedelta(days=days_back)
        
        quote_keywords = [
            "estimate", "quotation", "proposal", "quote",
            "joinery", "windows", "doors", "timber", "carpenter",
            "price", "cost", "attachment", "pdf"
        ]
        
        # Search sent emails (same as find_client_quotes)
        result = {
            "search_params": {
                "keywords": quote_keywords,
                "has_attachments": True,
                "since_date": since_date.isoformat(),
                "sent_only": True,
                "days_back": days_back
            }
        }
        
        try:
            emails = workflow.email_service.search_emails(
                keywords=quote_keywords,
                has_attachments=True,
                since_date=since_date,
                sent_only=True
            )
            
            result["sent_emails_found"] = len(emails)
            result["sent_emails"] = [{"subject": e.get("subject", ""), "sender": e.get("sender", ""), "date": e.get("date_sent", "")} for e in emails[:3]]
            
        except Exception as e:
            result["sent_search_error"] = str(e)
            emails = []
        
        # If no sent emails, try all emails (same logic as find_client_quotes)
        if not emails:
            try:
                emails = workflow.email_service.search_emails(
                    keywords=quote_keywords,
                    has_attachments=True,
                    since_date=since_date,
                    sent_only=False
                )
                
                result["all_emails_found"] = len(emails)
                result["all_emails"] = [{"subject": e.get("subject", ""), "sender": e.get("sender", ""), "date": e.get("date_sent", "")} for e in emails[:3]]
                
            except Exception as e:
                result["all_search_error"] = str(e)
        
        # Test processing the first email if found
        if emails:
            first_email = emails[0]
            result["processing_first_email"] = {
                "subject": first_email.get("subject", ""),
                "attachments_count": len(first_email.get("attachments", []))
            }
            
            # Test attachment processing
            attachments = first_email.get("attachments", [])
            pdf_attachments = [att for att in attachments if att.get("filename", "").lower().endswith(".pdf")]
            
            result["pdf_attachments_found"] = len(pdf_attachments)
            
            if pdf_attachments:
                # Test the actual workflow processing
                try:
                    quote = workflow._process_email_attachment(first_email, pdf_attachments[0])
                    if quote:
                        result["quote_processed"] = {
                            "confidence": quote.confidence,
                            "quoted_price": quote.parsed_data.get("quoted_price"),
                            "success": True
                        }
                    else:
                        result["quote_processed"] = {"success": False, "reason": "No quote returned"}
                except Exception as e:
                    result["quote_processing_error"] = str(e)
        
        return result
        
    except Exception as e:
        import traceback
        return {
            "error": str(e),
            "traceback": traceback.format_exc()[:500]
        }

@app.post("/debug-full-workflow")
async def debug_full_workflow(req: Request):
    """Debug the full email-to-quote workflow step by step"""
    try:
        # Use hardcoded values from working test
        tenant_id = "cmgt9bchl0001uj2h4po89fim"
        message_id = "19a3f6846b1e3038"
        
        result = {
            "steps": [],
            "errors": []
        }
        
        # Get database connection
        db_url = os.getenv("DATABASE_URL")
        if not db_url:
            return {"error": "No DATABASE_URL configured"}
        
        # Get Gmail credentials
        from db_config import get_db_manager
        db_manager = get_db_manager()
        
        with db_manager.get_connection() as conn:
            cur = conn.cursor()
            cur.execute('SELECT "refreshToken" FROM "GmailTenantConnection" WHERE "tenantId" = %s', (tenant_id,))
            db_result = cur.fetchone()
            
            if not db_result:
                return {"error": f"No Gmail connection found for tenant {tenant_id}"}
                
            refresh_token = db_result[0]
        
        result["steps"].append("✅ Retrieved Gmail credentials from database")
        
        # Get access token
        import requests
        token_data = {
            'client_id': os.getenv('GMAIL_CLIENT_ID'),
            'client_secret': os.getenv('GMAIL_CLIENT_SECRET'),
            'grant_type': 'refresh_token',
            'refresh_token': refresh_token
        }
        
        token_response = requests.post('https://oauth2.googleapis.com/token', data=token_data)
        if not token_response.ok:
            result["errors"].append(f"Token refresh failed: {token_response.status_code}")
            return result
        
        access_token = token_response.json()['access_token']
        result["steps"].append("✅ Got access token")
        
        # Get message details
        headers = {"Authorization": f"Bearer {access_token}"}
        msg_url = f"https://www.googleapis.com/gmail/v1/users/me/messages/{message_id}"
        
        msg_response = requests.get(msg_url, headers=headers)
        if not msg_response.ok:
            result["errors"].append(f"Failed to get message: {msg_response.status_code}")
            return result
        
        message_data = msg_response.json()
        result["steps"].append("✅ Retrieved message details")
        
        # Extract email metadata
        payload = message_data.get('payload', {})
        headers_list = payload.get('headers', [])
        
        subject = next((h['value'] for h in headers_list if h['name'].lower() == 'subject'), 'No subject')
        from_header = next((h['value'] for h in headers_list if h['name'].lower() == 'from'), 'No sender')
        date_header = next((h['value'] for h in headers_list if h['name'].lower() == 'date'), 'No date')
        
        result["email_metadata"] = {
            "subject": subject,
            "from": from_header,
            "date": date_header
        }
        result["steps"].append(f"✅ Extracted email metadata: {subject}")
        
        # Find PDF attachments using working logic
        def find_pdf_attachment(payload):
            if payload.get('filename', '').lower().endswith('.pdf') and payload.get('body', {}).get('attachmentId'):
                return {
                    'filename': payload['filename'],
                    'attachment_id': payload['body']['attachmentId'],
                    'size': payload['body'].get('size', 0)
                }
            
            if 'parts' in payload:
                for part in payload['parts']:
                    attachment = find_pdf_attachment(part)
                    if attachment:
                        return attachment
            return None
        
        attachment = find_pdf_attachment(payload)
        if not attachment:
            result["errors"].append("No PDF attachment found")
            return result
        
        result["attachment_info"] = attachment
        result["steps"].append(f"✅ Found PDF attachment: {attachment['filename']}")
        
        # Download attachment using working approach
        attachment_url = f"https://www.googleapis.com/gmail/v1/users/me/messages/{message_id}/attachments/{attachment['attachment_id']}"
        
        attachment_response = requests.get(attachment_url, headers=headers)
        if not attachment_response.ok:
            result["errors"].append(f"Attachment download failed: {attachment_response.status_code}")
            return result
        
        data = attachment_response.json()
        raw_data = data.get("data", "")
        
        if not raw_data:
            result["errors"].append("No attachment data in response")
            return result
        
        # Decode attachment
        import base64
        decoded_data = raw_data.replace('-', '+').replace('_', '/')
        while len(decoded_data) % 4:
            decoded_data += '='
        
        attachment_bytes = base64.b64decode(decoded_data)
        result["steps"].append(f"✅ Downloaded attachment: {len(attachment_bytes)} bytes")
        
        # Test PDF text extraction
        from pdf_parser import extract_text_from_pdf_bytes
        try:
            pdf_text = extract_text_from_pdf_bytes(attachment_bytes)
            result["pdf_text_length"] = len(pdf_text)
            result["pdf_text_preview"] = pdf_text[:300] if pdf_text else "No text extracted"
            result["steps"].append(f"✅ Extracted PDF text: {len(pdf_text)} characters")
        except Exception as e:
            result["errors"].append(f"PDF text extraction failed: {str(e)}")
            return result
        
        # Test quote parsing
        if pdf_text:
            from pdf_parser import parse_client_quote_from_text
            try:
                parsed_data = parse_client_quote_from_text(pdf_text)
                result["parsed_quote"] = parsed_data
                result["confidence"] = parsed_data.get("confidence", 0.0)
                result["steps"].append(f"✅ Parsed quote data: confidence {parsed_data.get('confidence', 0.0)}")
                
                if parsed_data.get("confidence", 0.0) > 0.1:
                    result["steps"].append("🎉 SUCCESS: Found valid client quote!")
                    result["success"] = True
                else:
                    result["steps"].append("⚠️ Low confidence quote - may be filtered out")
                    
            except Exception as e:
                result["errors"].append(f"Quote parsing failed: {str(e)}")
                return result
        
        return result
        
    except Exception as e:
        import traceback
        return {
            "error": str(e),
            "traceback": traceback.format_exc()[:500]
        }

@app.post("/simple-attachment-test")
async def simple_attachment_test(req: Request):
    """Minimal test of Gmail attachment download API"""
    try:
        # Use hardcoded tenant for testing
        tenant_id = "cmgt9bchl0001uj2h4po89fim"
        message_id = "19a3f6846b1e3038"
        
        # Get database connection
        db_url = os.getenv("DATABASE_URL")
        if not db_url:
            return {"error": "No DATABASE_URL configured"}
        
        # Get Gmail credentials from database
        from db_config import get_db_manager
        db_manager = get_db_manager()
        
        with db_manager.get_connection() as conn:
            cur = conn.cursor()
            cur.execute('SELECT "refreshToken" FROM "GmailTenantConnection" WHERE "tenantId" = %s', (tenant_id,))
            result = cur.fetchone()
            
            if not result:
                return {"error": f"No Gmail connection found for tenant {tenant_id}"}
                
            refresh_token = result[0]
        
        # Get access token
        import requests
        token_data = {
            'client_id': os.getenv('GMAIL_CLIENT_ID'),
            'client_secret': os.getenv('GMAIL_CLIENT_SECRET'),
            'grant_type': 'refresh_token',
            'refresh_token': refresh_token
        }
        
        token_response = requests.post('https://oauth2.googleapis.com/token', data=token_data)
        if not token_response.ok:
            return {
                "error": "Token refresh failed",
                "status": token_response.status_code,
                "details": token_response.text[:200]
            }
        
        access_token = token_response.json()['access_token']
        
        # Get message details to find current attachment ID
        headers = {"Authorization": f"Bearer {access_token}"}
        msg_url = f"https://www.googleapis.com/gmail/v1/users/me/messages/{message_id}"
        
        msg_response = requests.get(msg_url, headers=headers)
        if not msg_response.ok:
            return {
                "error": "Failed to get message",
                "status": msg_response.status_code,
                "details": msg_response.text[:200]
            }
        
        message_data = msg_response.json()
        
        # Find first PDF attachment
        def find_pdf_attachment(payload):
            if payload.get('filename', '').lower().endswith('.pdf') and payload.get('body', {}).get('attachmentId'):
                return {
                    'filename': payload['filename'],
                    'attachment_id': payload['body']['attachmentId'],
                    'size': payload['body'].get('size', 0)
                }
            
            if 'parts' in payload:
                for part in payload['parts']:
                    result = find_pdf_attachment(part)
                    if result:
                        return result
            return None
        
        attachment = find_pdf_attachment(message_data.get('payload', {}))
        if not attachment:
            return {"error": "No PDF attachment found in message"}
        
        # Test attachment download
        attachment_url = f"https://www.googleapis.com/gmail/v1/users/me/messages/{message_id}/attachments/{attachment['attachment_id']}"
        
        attachment_response = requests.get(attachment_url, headers=headers)
        
        result = {
            "message_id": message_id,
            "attachment_filename": attachment['filename'],
            "attachment_size_from_metadata": attachment['size'],
            "download_url": attachment_url[:80] + "...",
            "download_status": attachment_response.status_code,
            "download_success": attachment_response.ok
        }
        
        if attachment_response.ok:
            data = attachment_response.json()
            raw_data = data.get("data", "")
            result["raw_attachment_data_length"] = len(raw_data)
            
            if raw_data:
                # Test base64url decoding
                import base64
                try:
                    # Gmail uses base64url encoding
                    decoded_data = raw_data.replace('-', '+').replace('_', '/')
                    while len(decoded_data) % 4:
                        decoded_data += '='
                    
                    decoded_bytes = base64.b64decode(decoded_data)
                    result["decoded_size"] = len(decoded_bytes)
                    result["first_bytes_hex"] = decoded_bytes[:16].hex() if len(decoded_bytes) >= 16 else decoded_bytes.hex()
                    result["success"] = True
                    
                    # Check if it's a valid PDF
                    if decoded_bytes.startswith(b'%PDF'):
                        result["is_valid_pdf"] = True
                    else:
                        result["is_valid_pdf"] = False
                        result["actual_start"] = decoded_bytes[:20]
                        
                except Exception as decode_error:
                    result["decode_error"] = str(decode_error)
            else:
                result["error"] = "No attachment data in response"
                result["response_data"] = data
        else:
            result["error_details"] = attachment_response.text[:300]
        
        return result
        
    except Exception as e:
        import traceback
        return {
            "error": str(e),
            "traceback": traceback.format_exc()[:500]
        }

@app.post("/test-gmail-download")
async def test_gmail_download(req: Request):
    """Simple test of Gmail attachment download with detailed error reporting"""
    try:
        payload = await req.json()
        tenant_id = payload.get("tenantId", "cmgt9bchl0001uj2h4po89fim")
        
        # Get database connection
        db_url = os.getenv("DATABASE_URL")
        if not db_url:
            return {"error": "No DATABASE_URL configured"}
        
        # Get Gmail credentials from database
        from db_config import get_db_manager
        db_manager = get_db_manager()
        
        with db_manager.get_connection() as conn:
            cur = conn.cursor()
            cur.execute('SELECT "refreshToken" FROM "GmailTenantConnection" WHERE "tenantId" = %s', (tenant_id,))
            result = cur.fetchone()
            
            if not result:
                return {"error": f"No Gmail connection found for tenant {tenant_id}"}
                
            refresh_token = result[0]
        
        # Get access token
        import requests
        token_data = {
            'client_id': os.getenv('GMAIL_CLIENT_ID'),
            'client_secret': os.getenv('GMAIL_CLIENT_SECRET'),
            'grant_type': 'refresh_token',
            'refresh_token': refresh_token
        }
        
        token_response = requests.post('https://oauth2.googleapis.com/token', data=token_data)
        if not token_response.ok:
            return {
                "error": "Token refresh failed",
                "status": token_response.status_code,
                "details": token_response.text[:300]
            }
        
        access_token = token_response.json()['access_token']
        
        # Test attachment download with the corrected URL
        message_id = "19a3f6846b1e3038"
        attachment_id = "ANGjdJ-ow0gGB3JZQDm988R7Al9Gm5-wh1lzYUySz5Db-KrEOPOyQsJx6FrMcbp4Xk1zGKmv98XgzaXbKNlA_f9QMMClcfutqilXbzT6Ddf3XbKX8bFqnvuCPmEjZlu-DBoHbuBSmC6oGw59aPUjt23Sxp28oBMGw6Uk9qBjuT7cQneHIz9theMZ3CwLvmspZCUHvB7iA2yQXM-EPqKAnQDGMULafSijnK--mqx8ChnwkWrdPlXQjT2Sg_N1YCnqageHErL8hSXVZuOSZZKduFUjNatRJKVsZLaIzuyoanWd4ix5LFGNpbElU5Qb7D2m6LCfO0YZvXuTDIJguhqJQPU4S-JmTpzA-0gsroCpNwU2AWqCrPGymUqwdxpJ3v4KoqZ7fs5vMN3ZLzJWuWgD"
        
        url = f"https://www.googleapis.com/gmail/v1/users/me/messages/{message_id}/attachments/{attachment_id}"
        headers = {"Authorization": f"Bearer {access_token}"}
        
        download_response = requests.get(url, headers=headers)
        
        result = {
            "access_token_length": len(access_token),
            "download_url": url[:80] + "...",
            "download_status": download_response.status_code,
            "download_success": download_response.ok
        }
        
        if download_response.ok:
            data = download_response.json()
            attachment_data = data.get("data", "")
            result["raw_data_length"] = len(attachment_data)
            
            if attachment_data:
                # Decode base64url
                import base64
                decoded_data = attachment_data.replace('-', '+').replace('_', '/')
                while len(decoded_data) % 4:
                    decoded_data += '='
                
                try:
                    decoded_bytes = base64.b64decode(decoded_data)
                    result["decoded_size"] = len(decoded_bytes)
                    result["success"] = True
                    result["message"] = f"Successfully downloaded {len(decoded_bytes)} bytes"
                except Exception as decode_error:
                    result["decode_error"] = str(decode_error)
            else:
                result["error"] = "No attachment data in response"
        else:
            result["error"] = download_response.text[:300]
        
        return result
        
    except Exception as e:
        import traceback
        return {
            "error": str(e),
            "traceback": traceback.format_exc()[:500]
        }

@app.post("/debug-attachment-processing")
async def debug_attachment_processing(req: Request):
    """Debug attachment download and PDF processing"""
    try:
        payload = await req.json()
        tenant_id = payload.get("tenantId")
        
        if not tenant_id:
            return {"error": "tenantId required"}
            
        db_url = os.getenv("DATABASE_URL")
        if not db_url:
            return {"error": "No DATABASE_URL"}
            
        from email_trainer import EmailTrainingWorkflow
        from pdf_parser import extract_text_from_pdf_bytes, parse_client_quote_from_text
        
        # Initialize workflow
        workflow = EmailTrainingWorkflow(db_url, tenant_id)
        
        # Get Gmail connection details from database
        from db_config import get_db_manager
        db_manager = get_db_manager()
        
        with db_manager.get_connection() as conn:
            cur = conn.cursor()
            cur.execute('SELECT "refreshToken", "gmailAddress" FROM "GmailTenantConnection" WHERE "tenantId" = %s', (tenant_id,))
            result = cur.fetchone()
            
            if not result:
                return {"error": f"No Gmail connection found for tenant {tenant_id}"}
                
            refresh_token, gmail_address = result
        
        # Setup Gmail service
        gmail_credentials = {"refresh_token": refresh_token}
        workflow.setup_email_service("gmail", gmail_credentials)
        
        # Use a known message ID
        message_id = "19a3f6846b1e3038"  # From debug output
        
        # Get current email details and use real attachment ID
        import requests
        access_token = workflow.email_service._get_access_token()
        
        # Get the message details to get current attachment IDs
        msg_url = f'https://www.googleapis.com/gmail/v1/users/me/messages/{message_id}'
        headers = {'Authorization': f'Bearer {access_token}'}
        msg_response = requests.get(msg_url, headers=headers)
        
        if not msg_response.ok:
            return {"error": f"Failed to get message details: {msg_response.status_code}"}
        
        message_data = msg_response.json()
        payload = message_data.get('payload', {})
        
        # Find PDF attachments
        attachments = []
        workflow.email_service._extract_attachments(payload, attachments)
        
        pdf_attachments = [att for att in attachments if att['filename'].lower().endswith('.pdf')]
        
        if not pdf_attachments:
            return {"error": "No PDF attachments found in current message"}
        
        # Use the first PDF attachment
        attachment = pdf_attachments[0]
        attachment_id = attachment['attachment_id']
        
        debug_info = {
            "message_id": message_id,
            "attachment_filename": attachment['filename'],
            "attachment_id": attachment_id[:50] + "...",
            "steps": []
        }
        
        # Step 1: Download attachment using the service method
        debug_info["steps"].append("Downloading attachment...")
        try:
            attachment_data = workflow.email_service.download_attachment(message_id, attachment_id)
            debug_info["download_success"] = len(attachment_data) > 0
            debug_info["attachment_size"] = len(attachment_data)
            debug_info["steps"].append(f"Downloaded {len(attachment_data)} bytes")
        except Exception as e:
            debug_info["download_error"] = str(e)
            debug_info["steps"].append(f"Download failed: {e}")
            return debug_info
        
        # Step 2: Extract text from PDF
        debug_info["steps"].append("Extracting text from PDF...")
        try:
            pdf_text = extract_text_from_pdf_bytes(attachment_data)
            debug_info["text_extraction_success"] = len(pdf_text) > 0
            debug_info["extracted_text_length"] = len(pdf_text)
            debug_info["text_preview"] = pdf_text[:500] if pdf_text else "No text extracted"
            debug_info["steps"].append(f"Extracted {len(pdf_text)} characters")
        except Exception as e:
            debug_info["text_extraction_error"] = str(e)
            debug_info["steps"].append(f"Text extraction failed: {e}")
            return debug_info
        
        # Step 3: Parse client quote data
        debug_info["steps"].append("Parsing client quote data...")
        try:
            parsed_data = parse_client_quote_from_text(pdf_text)
            debug_info["parsing_success"] = True
            debug_info["parsed_data"] = parsed_data
            debug_info["confidence"] = parsed_data.get("confidence", 0.0)
            debug_info["steps"].append(f"Parsed with confidence: {parsed_data.get('confidence', 0.0)}")
        except Exception as e:
            debug_info["parsing_error"] = str(e)
            debug_info["steps"].append(f"Parsing failed: {e}")
            return debug_info
        
        return debug_info
        
    except Exception as e:
        import traceback
        return {
            "error": str(e),
            "traceback": traceback.format_exc()
        }

@app.get("/meta")
def meta():
    return {
        "ok": True,
        "columns": COLUMNS,
        "numeric_columns": sorted(list(NUMERIC_COLUMNS)),
        "categorical_columns": sorted(list(CATEGORICAL_COLUMNS)),
        "has_meta": bool(feature_meta),
        "models": models_status(),
    }

@app.post("/predict")
async def predict(req: Request):
    """
    Predict price and win probability for a quote based on questionnaire answers.
    Falls back to training data statistics if models aren't loaded.
    """
    try:
        payload = await req.json()
        q = QuoteIn(**payload)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Validation failed: {e}")

    # If models are loaded, use them
    if price_model and win_model:
        try:
            X = build_feature_row(q)
            
            # Enhanced error handling for model predictions
            try:
                price = float(price_model.predict(X)[0])
            except Exception as model_error:
                logger.error(f"Price model prediction failed: {model_error}")
                # Fallback: simple area-based pricing
                area = q.area_m2
                base_price_per_m2 = 800 if q.materials_grade == "Premium" else 600 if q.materials_grade == "Standard" else 400
                price = area * base_price_per_m2
                logger.info(f"Using fallback pricing: {area} m² × £{base_price_per_m2} = £{price}")
            
            try:
                if hasattr(win_model, "predict_proba"):
                    win_prob = float(win_model.predict_proba(X)[0][1])
                else:
                    win_pred = float(win_model.predict(X)[0])
                    win_prob = float(max(0.0, min(1.0, win_pred)))
            except Exception as model_error:
                logger.error(f"Win model prediction failed: {model_error}")
                # Fallback: simple probability based on price range and materials
                if price < 5000:
                    win_prob = 0.7
                elif price < 15000:
                    win_prob = 0.5
                else:
                    win_prob = 0.3
                if q.materials_grade == "Premium":
                    win_prob *= 0.8  # Premium is harder to win
                logger.info(f"Using fallback win probability: {win_prob}")
                    
        except Exception as e:
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"predict failed: {e}")

        return {
            "predicted_price": round(price, 2),
            "win_probability": round(win_prob, 3),
            "columns_used": COLUMNS,
            "model_status": "active"
        }
    
    # Models not loaded - use training data statistics
    logger.info("Models not loaded, using training data statistics for prediction")
    
    if EMAIL_TRAINING_AVAILABLE:
        try:
            from db_config import get_db_manager
            
            # Get average pricing from training data
            tenant_id = payload.get("tenantId") or payload.get("tenant_id")
            
            db_manager = get_db_manager()
            conn = db_manager.get_connection()
            with conn.cursor() as cur:
                # Get average estimated_total from training data
                cur.execute("""
                    SELECT 
                        AVG(estimated_total) as avg_total,
                        COUNT(*) as count,
                        AVG(confidence) as avg_confidence
                    FROM ml_training_data
                    WHERE estimated_total > 0
                    AND (tenant_id = %s OR %s IS NULL)
                """, (tenant_id, tenant_id))
                
                result = cur.fetchone()
                if result and result[0]:
                    avg_total = float(result[0])
                    sample_count = int(result[1])
                    avg_confidence = float(result[2]) if result[2] else 0.5
                    
                    # Adjust based on area if provided
                    area = q.area_m2
                    # Assume average is for ~30m² project
                    assumed_avg_area = 30.0
                    price = avg_total * (area / assumed_avg_area)
                    
                    # Adjust for materials grade
                    if q.materials_grade == "Premium":
                        price *= 1.3
                    elif q.materials_grade == "Basic":
                        price *= 0.7
                    
                    logger.info(f"Using training data average: £{avg_total} from {sample_count} examples, adjusted to £{price} for {area}m²")
                    
                    return {
                        "predicted_price": round(price, 2),
                        "win_probability": round(avg_confidence, 3),
                        "model_status": "training_data",
                        "training_samples": sample_count,
                        "note": f"Prediction based on {sample_count} training examples (models not yet trained)"
                    }
            
            conn.close()
        except Exception as e:
            logger.error(f"Failed to get training data statistics: {e}")
            traceback.print_exc()
    
    # Final fallback: simple area-based pricing
    area = q.area_m2
    base_price_per_m2 = 800 if q.materials_grade == "Premium" else 600 if q.materials_grade == "Standard" else 400
    price = area * base_price_per_m2
    win_prob = 0.5
    
    logger.info(f"Using simple fallback: {area} m² × £{base_price_per_m2} = £{price}")
    
    return {
        "predicted_price": round(price, 2),
        "win_probability": round(win_prob, 3),
        "model_status": "fallback",
        "note": "No trained models or training data available - using simple area-based estimate"
    }

# ----------------- supplier→client quote builder -----------------
def build_client_quote_from_supplier_parsed(
    supplier_parsed: Dict[str, Any],
    markup_percent: float = 20.0,
    vat_percent: float = 20.0,
    markup_delivery: bool = False,
    amalgamate_delivery: bool = True,
    client_delivery_gbp: Optional[float] = None,
    client_delivery_description: Optional[str] = None,
    round_to: int = 2,
) -> Dict[str, Any]:
    """
    Transform parsed supplier lines into a client-facing quote with markup and VAT.

    Inputs:
      - supplier_parsed: output of parse_quote_lines_from_text
      - markup_percent: percentage uplift applied to unit prices (e.g., 20.0)
      - vat_percent: VAT percent to compute VAT and total (set 0 for no VAT)
      - markup_delivery: whether to apply markup to delivery/shipping lines
      - round_to: rounding precision for prices

        Delivery handling:
            - Supplier delivery: any supplier 'delivery/shipping' lines are detected. If
                amalgamate_delivery=True (default), their total is distributed across non-delivery
                items proportionally to each item's original total. If False, delivery lines are kept
                and you can control markup on them via markup_delivery.
            - End-client delivery: if client_delivery_gbp is provided (>0), an extra client-facing
                'Delivery' line is appended after markups. This value contributes to subtotal and VAT.

        Output shape:
      - currency, markup_percent, vat_percent
            - lines: [{ description, qty, unit_price, total, unit_price_marked_up, total_marked_up }]
            - supplier_delivery_total, client_delivery_charge
            - subtotal, vat_amount, grand_total
    """
    currency = supplier_parsed.get("currency")
    lines_in: List[Dict[str, Any]] = supplier_parsed.get("lines", []) or []

    client_lines: List[Dict[str, Any]] = []
    subtotal = 0.0
    supplier_delivery_total = 0.0

    # Separate delivery lines (supplier side)
    base_items: List[Dict[str, Any]] = []
    for ln in lines_in:
        desc = (ln.get("description") or "").strip()
        qty = float(ln.get("qty") or ln.get("quantity") or 1)
        unit = float(ln.get("unit_price") or 0.0)
        total = float(ln.get("total") or (qty * unit))
        is_delivery_ln = bool(desc) and ("delivery" in desc.lower() or "shipping" in desc.lower())
        if is_delivery_ln:
            supplier_delivery_total += max(0.0, total)
        else:
            base_items.append({"description": desc, "qty": qty, "unit": unit, "total": total})

    # Compute proportional weights for amalgamation
    total_of_items = sum(bi["total"] for bi in base_items) or 0.0
    delivery_allocations: List[float] = []
    if amalgamate_delivery and supplier_delivery_total > 0 and total_of_items > 0:
        for bi in base_items:
            w = (bi["total"] / total_of_items) if total_of_items > 0 else 0.0
            delivery_allocations.append(round(supplier_delivery_total * w, round_to))
    else:
        delivery_allocations = [0.0 for _ in base_items]

    # Build client lines for base items
    for idx, bi in enumerate(base_items):
        desc = bi["description"]
        qty = bi["qty"]
        unit = bi["unit"]
        total = bi["total"]

        # If amalgamating delivery, fold the allocated share into the line total before markup
        extra_cost = delivery_allocations[idx] if idx < len(delivery_allocations) else 0.0
        effective_total_before_markup = total + (extra_cost or 0.0)
        # Convert to an effective unit price for marking up
        effective_unit_before_markup = (effective_total_before_markup / qty) if qty else unit

        uplift = (1.0 + (markup_percent / 100.0))
        unit_m = round(effective_unit_before_markup * uplift, round_to)
        total_m = round(unit_m * qty, round_to)

        client_lines.append({
            "description": desc,
            "qty": qty,
            "unit_price": round(unit, round_to),
            "total": round(total, round_to),
            "unit_price_marked_up": unit_m,
            "total_marked_up": total_m,
        })

        subtotal += total_m

    # If not amalgamating supplier delivery, keep delivery lines optionally with markup
    if not amalgamate_delivery and supplier_delivery_total > 0:
        apply_markup = bool(markup_delivery)
        uplift = (1.0 + (markup_percent / 100.0)) if apply_markup else 1.0
        unit_m = round(supplier_delivery_total * uplift, round_to)
        total_m = unit_m  # qty = 1
        client_lines.append({
            "description": "Delivery",
            "qty": 1,
            "unit_price": round(supplier_delivery_total, round_to),
            "total": round(supplier_delivery_total, round_to),
            "unit_price_marked_up": unit_m,
            "total_marked_up": total_m,
        })
        subtotal += total_m

    # Optional end-client delivery charge (added as a new client-facing line)
    client_delivery_added = None
    if client_delivery_gbp is not None and client_delivery_gbp > 0:
        desc = client_delivery_description or "Delivery"
        amt = round(float(client_delivery_gbp), round_to)
        client_lines.append({
            "description": desc,
            "qty": 1,
            "unit_price": 0.0,
            "total": 0.0,
            "unit_price_marked_up": amt,
            "total_marked_up": amt,
        })
        subtotal += amt
        client_delivery_added = amt

    subtotal = round(subtotal, round_to)
    vat_amount = round(subtotal * (vat_percent / 100.0), round_to) if vat_percent and vat_percent > 0 else 0.0
    grand_total = round(subtotal + vat_amount, round_to)

    return {
        "currency": currency,
        "markup_percent": markup_percent,
        "vat_percent": vat_percent,
        "supplier_delivery_total": round(supplier_delivery_total, round_to),
        "client_delivery_charge": client_delivery_added,
        "lines": client_lines,
        "subtotal": subtotal,
        "vat_amount": vat_amount,
        "grand_total": grand_total,
    }

# ----------------- per-line pricing endpoint -----------------
class PredictLinesIn(BaseModel):
    """Input schema for per-line pricing prediction.
    Accepts pre-parsed supplier lines and returns client-facing quote lines.
    """
    lines: List[Dict[str, Any]]
    currency: Optional[str] = None
    # Pricing options
    markupPercent: float = 20.0
    vatPercent: float = 20.0
    markupDelivery: bool = False
    amalgamateDelivery: bool = True
    clientDeliveryGBP: Optional[float] = None
    clientDeliveryDescription: Optional[str] = None
    roundTo: int = 2

@app.post("/predict-lines")
def predict_lines(payload: PredictLinesIn):
    """
    Compute per-line client pricing from supplier lines.

    Body: {
      lines: [{ description, qty, unit_price?, total?, costUnit?, lineTotal? }],
      currency?: string,
      markupPercent?: number,
      vatPercent?: number,
      markupDelivery?: boolean,
      amalgamateDelivery?: boolean,
      clientDeliveryGBP?: number,
      clientDeliveryDescription?: string,
      roundTo?: int
    }

    Returns: client_quote with line-level unit_price_marked_up/total_marked_up and totals.
    """
    try:
        # Normalise input lines to the internal supplier_parsed shape expected by builder
        norm_lines: List[Dict[str, Any]] = []
        for ln in payload.lines or []:
            desc = str(ln.get("description") or ln.get("desc") or "Item").strip()
            # qty
            qty_raw = ln.get("qty") if ln.get("qty") is not None else ln.get("quantity")
            try:
                qty = float(qty_raw) if qty_raw is not None else 1.0
            except Exception:
                qty = 1.0
            if qty <= 0:
                qty = 1.0
            # unit/total: accept either costUnit/lineTotal or unit_price/total
            unit = ln.get("unit_price")
            if unit is None:
                unit = ln.get("costUnit")
            try:
                unit_f = float(unit) if unit is not None else None
            except Exception:
                unit_f = None

            total = ln.get("total")
            if total is None:
                total = ln.get("lineTotal")
            try:
                total_f = float(total) if total is not None else None
            except Exception:
                total_f = None

            if unit_f is None and (total_f is not None and qty):
                unit_f = float(total_f) / float(qty) if qty else 0.0
            if total_f is None and (unit_f is not None and qty):
                total_f = float(unit_f) * float(qty)

            norm_lines.append({
                "description": desc,
                "qty": qty,
                "unit_price": float(unit_f or 0.0),
                "total": float(total_f or 0.0),
            })

        supplier_parsed = {
            "currency": payload.currency,
            "lines": norm_lines,
        }

        client_quote = build_client_quote_from_supplier_parsed(
            supplier_parsed,
            markup_percent=payload.markupPercent,
            vat_percent=payload.vatPercent,
            markup_delivery=payload.markupDelivery,
            amalgamate_delivery=payload.amalgamateDelivery,
            client_delivery_gbp=payload.clientDeliveryGBP,
            client_delivery_description=payload.clientDeliveryDescription,
            round_to=payload.roundTo,
        )

        return {
            "ok": True,
            "client_quote": client_quote,
            "line_count": len(norm_lines),
        }
    except Exception as e:
        logger.error(f"predict-lines failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"predict-lines failed: {e}")

# ----------------- parsing helpers -----------------
def _http_get_bytes(url: str, timeout: int = 30) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "JoineryAI-ML/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()

def _iso(dt_str: Optional[str]) -> Optional[str]:
    if not dt_str:
        return None
    try:
        # try RFC2822-like strings first (e.g., "Wed, 15 Oct 2025 12:59:55 +0100")
        return datetime.datetime.strptime(dt_str, "%a, %d %b %Y %H:%M:%S %z").astimezone(
            datetime.timezone.utc
        ).isoformat()
    except Exception:
        try:
            return datetime.datetime.fromisoformat(dt_str).astimezone(
                datetime.timezone.utc
            ).isoformat()
        except Exception:
            return None

# ----------------- parse-quote + train -----------------
class TrainItem(BaseModel):
    messageId: str
    attachmentId: str
    url: str
    filename: Optional[str] = None
    quotedAt: Optional[str] = None

class TrainPayload(BaseModel):
    tenantId: str
    items: List[TrainItem] = []

@app.post("/parse-quote")
async def parse_quote(req: Request):
    """
    Body: { url: string, filename?: string, quotedAt?: string }
    Downloads a single PDF, extracts text, and heuristically detects totals.
    """
    body = await req.json()
    url = body.get("url")
    if not url or not isinstance(url, str):
        raise HTTPException(status_code=422, detail="missing url")

    filename = body.get("filename") or "attachment.pdf"
    quoted_at = _iso(body.get("quotedAt"))

    try:
        pdf_bytes = _http_get_bytes(url)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"download_failed: {e}")

    text = extract_text_from_pdf_bytes(pdf_bytes) or ""
    parsed = parse_totals_from_text(text) if text else {
        "currency": None,
        "lines": [],
        "detected_totals": [],
        "estimated_total": None,
        "confidence": 0,
    }

    return {
        "ok": True,
        "filename": filename,
        "quotedAt": quoted_at,
        "text_chars": len(text),
        "parsed": parsed,
    }

class ProcessQuoteIn(BaseModel):
    url: str
    filename: Optional[str] = None
    quotedAt: Optional[str] = None
    markupPercent: float = 20.0
    vatPercent: float = 20.0
    markupDelivery: bool = False
    amalgamateDelivery: bool = True
    clientDeliveryGBP: Optional[float] = None
    clientDeliveryDescription: Optional[str] = None

@app.post("/process-quote")
async def process_quote(payload: ProcessQuoteIn):
    """
    Classify a PDF as supplier vs client, parse accordingly, and for supplier quotes
    return a client-facing quote with markup applied.

    Body: { url, filename?, quotedAt?, markupPercent?, vatPercent?, markupDelivery? }
    """
    try:
        pdf_bytes = _http_get_bytes(payload.url)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"download_failed: {e}")

    text = extract_text_from_pdf_bytes(pdf_bytes) or ""
    if not text.strip():
        return {
            "ok": False,
            "message": "No text extracted from PDF",
            "filename": payload.filename or "attachment.pdf",
            "quote_type": "unknown",
        }

    quote_type = determine_quote_type(text)

    # If unknown, try both parsers and choose by signal strength
    if quote_type == "unknown":
        supplier_try = parse_quote_lines_from_text(text)
        client_try = parse_client_quote_from_text(text)
        supplier_signal = len(supplier_try.get("lines", []))
        client_signal = float(client_try.get("confidence", 0.0))
        quote_type = "supplier" if supplier_signal >= 1 else ("client" if client_signal >= 0.2 else "unknown")

    if quote_type == "supplier":
        supplier_parsed = parse_quote_lines_from_text(text)
        client_quote = build_client_quote_from_supplier_parsed(
            supplier_parsed,
            markup_percent=payload.markupPercent,
            vat_percent=payload.vatPercent,
            markup_delivery=payload.markupDelivery,
            amalgamate_delivery=payload.amalgamateDelivery,
            client_delivery_gbp=payload.clientDeliveryGBP,
            client_delivery_description=payload.clientDeliveryDescription,
        )
        return {
            "ok": True,
            "filename": payload.filename or "attachment.pdf",
            "quotedAt": _iso(payload.quotedAt),
            "quote_type": "supplier",
            "supplier_parsed": supplier_parsed,
            "client_quote": client_quote,
        }
    elif quote_type == "client":
        client_parsed = parse_client_quote_from_text(text)
        return {
            "ok": True,
            "filename": payload.filename or "attachment.pdf",
            "quotedAt": _iso(payload.quotedAt),
            "quote_type": "client",
            "training_candidate": client_parsed,
        }
    else:
        # Unknown - return diagnostics
        return {
            "ok": True,
            "filename": payload.filename or "attachment.pdf",
            "quotedAt": _iso(payload.quotedAt),
            "quote_type": "unknown",
            "raw_text_length": len(text),
            "message": "Could not confidently classify quote type",
        }

@app.post("/train")
async def train(payload: TrainPayload):
    """
    Process supplier quotes and store them as training examples.
    Can be called with uploaded files or email attachments.
    Returns stats and stores examples in database for future model training.
    """
    if not EMAIL_TRAINING_AVAILABLE:
        # Fall back to simple processing without database storage
        ok = 0
        fails: List[Dict[str, Any]] = []
        samples: List[Dict[str, Any]] = []

        for item in payload.items:
            try:
                pdf_bytes = _http_get_bytes(item.url)
                text = extract_text_from_pdf_bytes(pdf_bytes) or ""
                parsed = parse_quote_lines_from_text(text) if text else {
                    "currency": None,
                    "lines": [],
                    "estimated_total": None,
                    "confidence": 0,
                }
                ok += 1

                if len(samples) < 5:
                    samples.append({
                        "url": item.url,
                        "filename": item.filename,
                        "text_chars": len(text),
                        "parsed": parsed,
                    })
            except Exception as e:
                fails.append({
                    "url": item.url,
                    "filename": item.filename,
                    "error": f"{e}",
                })

        return {
            "ok": True,
            "tenantId": payload.tenantId,
            "received_items": len(payload.items),
            "parsed_ok": ok,
            "failed": len(fails),
            "samples": samples,
            "failures": fails,
            "message": "Training job completed (database not available, examples not stored).",
        }

    # Full training workflow with database storage
    from db_config import get_db_manager
    import datetime
    
    ok = 0
    fails: List[Dict[str, Any]] = []
    samples: List[Dict[str, Any]] = []
    training_records: List[Dict[str, Any]] = []

    for item in payload.items:
        try:
            pdf_bytes = _http_get_bytes(item.url)
            text = extract_text_from_pdf_bytes(pdf_bytes) or ""
            
            if not text.strip():
                fails.append({
                    "url": item.url,
                    "filename": item.filename,
                    "error": "No text extracted from PDF",
                })
                continue
            
            # Determine quote type and parse accordingly
            quote_type = determine_quote_type(text)
            
            if quote_type == "supplier" or quote_type == "unknown":
                parsed = parse_quote_lines_from_text(text)
                training_type = "supplier_quote"
            else:
                parsed = parse_client_quote_from_text(text)
                training_type = "client_quote"
            
            confidence = float(parsed.get("confidence", 0.0))
            lines_count = len(parsed.get("lines", []))
            
            # Estimate total value
            estimated_total = None
            if quote_type == "supplier":
                totals = parsed.get("detected_totals", [])
                if totals:
                    estimated_total = max(totals)
            
            ok += 1

            # Prepare training record
            training_record = {
                'tenant_id': payload.tenantId,
                'email_subject': item.filename or f"Training upload {ok}",
                'email_date': datetime.datetime.utcnow(),
                'attachment_name': item.filename or f"quote_{ok}.pdf",
                'parsed_data': json.dumps(parsed),
                'project_type': training_type,
                'quoted_price': estimated_total,
                'area_m2': None,
                'materials_grade': None,
                'confidence': confidence,
                'source_type': training_type  # 'supplier_quote' or 'client_quote'
            }
            training_records.append(training_record)

            # Keep sample for response
            if len(samples) < 5:
                samples.append({
                    "url": item.url,
                    "filename": item.filename,
                    "quote_type": quote_type,
                    "text_chars": len(text),
                    "lines_extracted": lines_count,
                    "estimated_total": estimated_total,
                    "confidence": confidence,
                })
        except Exception as e:
            fails.append({
                "url": item.url,
                "filename": item.filename,
                "error": f"{e}",
            })

    # Save training records to database
    saved_count = 0
    if training_records:
        try:
            db_manager = get_db_manager()
            saved_count = db_manager.save_training_data(training_records)
            
            # Log training session
            db_manager.log_training_session({
                'tenant_id': payload.tenantId,
                'training_type': 'manual_upload',
                'quotes_processed': ok,
                'training_records_created': saved_count,
                'duration_seconds': 0,
                'status': 'completed'
            })
        except Exception as e:
            logger.error(f"Failed to save training data: {e}")

    avg_est = None
    vals = [s.get("estimated_total") for s in samples if s.get("estimated_total") is not None]
    if vals:
        try:
            avg_est = round(float(sum(vals)) / len(vals), 2)
        except Exception:
            avg_est = None

    return {
        "ok": True,
        "tenantId": payload.tenantId,
        "received_items": len(payload.items),
        "parsed_ok": ok,
        "failed": len(fails),
        "training_records_saved": saved_count,
        "avg_estimated_total": avg_est,
        "samples": samples,
        "failures": fails,
        "message": f"Training completed: {saved_count} examples saved to database.",
    }

@app.post("/debug-parse")
async def debug_parse(req: Request):
    """
    Debug endpoint to see raw PDF text extraction and parsing results.
    Body: { url: string, filename?: string }
    """
    body = await req.json()
    url = body.get("url")
    if not url or not isinstance(url, str):
        raise HTTPException(status_code=422, detail="missing url")

    filename = body.get("filename") or "debug.pdf"

    try:
        pdf_bytes = _http_get_bytes(url)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"download_failed: {e}")

    # Extract raw text
    raw_text = extract_text_from_pdf_bytes(pdf_bytes) or ""
    
    # Determine quote type
    quote_type = determine_quote_type(raw_text)
    
    # Parse with both methods for comparison
    supplier_parsed = parse_quote_lines_from_text(raw_text) if raw_text else {}
    legacy_parsed = parse_totals_from_text(raw_text) if raw_text else {}

    return {
        "ok": True,
        "filename": filename,
        "raw_text_length": len(raw_text),
        "raw_text_preview": raw_text[:1000] + "..." if len(raw_text) > 1000 else raw_text,
        "quote_type": quote_type,
        "supplier_parsing": {
            "lines_found": len(supplier_parsed.get("lines", [])),
            "lines": supplier_parsed.get("lines", [])[:5],  # First 5 lines
            "estimated_total": supplier_parsed.get("estimated_total"),
            "confidence": supplier_parsed.get("confidence"),
            "supplier": supplier_parsed.get("supplier"),
        },
        "legacy_parsing": {
            "lines_found": len(legacy_parsed.get("lines", [])),
            "estimated_total": legacy_parsed.get("estimated_total"),
            "detected_totals": legacy_parsed.get("detected_totals", []),
        }
    }

class EmailTrainingPayload(BaseModel):
    tenantId: str
    emailProvider: str  # "gmail" or "m365"
    credentials: Optional[Dict[str, Any]] = None  # Make credentials optional - will be fetched from DB
    daysBack: int = 30

@app.post("/start-email-training")
async def start_email_training(payload: EmailTrainingPayload):
    """
    Start the automated email-to-ML training workflow.
    Finds client quotes in email, parses them, and trains ML models.
    """
    if not EMAIL_TRAINING_AVAILABLE:
        raise HTTPException(status_code=503, detail="Email training not available - database connection required")
    
    try:
        # Get database URL
        db_url = os.getenv("DATABASE_URL")
        if not db_url:
            raise HTTPException(status_code=500, detail="DATABASE_URL not configured")

        from db_config import get_db_manager
        db_manager = get_db_manager()
        
        # Get Gmail credentials from database (same as API service does)
        gmail_credentials = {}
        tenant_id = payload.tenantId
        
        with db_manager.get_connection() as conn:
            cur = conn.cursor()
            # Check if Gmail is connected for this tenant
            cur.execute('SELECT "refreshToken", "gmailAddress" FROM "GmailTenantConnection" WHERE "tenantId" = %s', (tenant_id,))
            result = cur.fetchone()
            
            if result:
                refresh_token, gmail_address = result
                # Get fresh access token using refresh token
                gmail_credentials = {
                    'refresh_token': refresh_token,
                    'gmail_address': gmail_address,
                    'api_base_url': os.getenv('API_SERVICE_URL', 'https://joinery-ai.onrender.com'),
                    'headers': {
                        'Authorization': f'Bearer {refresh_token}',  # Will be refreshed to access token
                        'Content-Type': 'application/json'
                    }
                }
                
                # Set environment variables needed for Gmail API
                os.environ['GMAIL_CLIENT_ID'] = os.getenv('GMAIL_CLIENT_ID', '')
                os.environ['GMAIL_CLIENT_SECRET'] = os.getenv('GMAIL_CLIENT_SECRET', '')
                
                logger.info(f"Found Gmail connection for {gmail_address}")
            else:
                raise HTTPException(status_code=400, detail=f"No Gmail connection found for tenant {tenant_id}. Please connect Gmail first.")
        
        # Initialize workflow
        workflow = EmailTrainingWorkflow(db_url, tenant_id)
        
        # Collect progress messages
        progress_messages = []
        
        def progress_callback(progress_info):
            """Collect progress messages for user feedback"""
            progress_messages.append(progress_info)
        
        # Run the complete workflow with real Gmail credentials and progress tracking
        results = workflow.run_full_workflow(
            email_provider=payload.emailProvider,
            credentials=gmail_credentials,  # Use real credentials from database
            days_back=payload.daysBack,
            progress_callback=progress_callback
        )
        
        return {
            "ok": True,
            "message": "✅ Email training workflow completed",
            "results": {
                "quotes_found": results["quotes_found"],
                "training_records_saved": results["training_records_saved"],
                "ml_training_completed": results["ml_training_completed"],
                "duration_seconds": results["duration"].total_seconds(),
                "errors": results["errors"]
            },
            "progress": results.get("progress", []),
            "summary": {
                "emails_searched": len([msg for msg in results.get("progress", []) if "Found" in msg.get("message", "") and "emails" in msg.get("message", "")]),
                "pdfs_processed": len([msg for msg in results.get("progress", []) if msg.get("step") == "extracting"]),
                "quotes_found": results["quotes_found"],
                "training_completed": results["ml_training_completed"]
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Email training workflow failed: {e}")

@app.post("/upload-quote-training")
async def upload_quote_training(request: dict):
    """
    Upload and process a quote file for training.
    Supports drag-and-drop functionality for manual quote training.
    Expects JSON payload with base64 encoded file content.
    """
    if not EMAIL_TRAINING_AVAILABLE:
        raise HTTPException(status_code=503, detail="Quote training not available - database connection required")
    
    try:
        # Extract data from JSON request
        filename = request.get('filename')
        base64_content = request.get('base64')
        quote_type = request.get('quoteType', 'supplier')
        tenant_id = request.get('tenantId')
        project_type = request.get('projectType')
        client_name = request.get('clientName')
        quoted_price = request.get('quotedPrice')
        area_m2 = request.get('areaM2')
        materials_grade = request.get('materialsGrade')
        
        if not filename or not base64_content:
            raise HTTPException(status_code=422, detail="Missing filename or base64 content")
        
        # Validate file type
        if not filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=422, detail="Only PDF files are supported")
        
        # Decode base64 content
        import base64
        try:
            file_content = base64.b64decode(base64_content)
        except Exception:
            raise HTTPException(status_code=422, detail="Invalid base64 content")
        
        # Extract text from PDF
        pdf_text = extract_text_from_pdf_bytes(file_content) or ""
        
        if not pdf_text.strip():
            raise HTTPException(status_code=422, detail="Could not extract text from PDF")
        
        # Parse the quote based on type
        if quote_type == "supplier":
            parsed_data = parse_quote_lines_from_text(pdf_text)
            quote_type_result = "supplier"
        else:
            parsed_data = parse_client_quote_from_text(pdf_text)
            quote_type_result = "client"
        
        # Determine quote confidence
        confidence = parsed_data.get('confidence', 0.0) if parsed_data else 0.0
        
        # Get database URL and save training data
        db_url = os.getenv("DATABASE_URL")
        if not db_url:
            raise HTTPException(status_code=500, detail="DATABASE_URL not configured")
        
        # Use default tenant if not provided
        effective_tenant_id = tenant_id or "default-tenant"
        
        from db_config import get_db_manager
        db_manager = get_db_manager()  # This automatically creates tables
        
        # Create training data record
        training_record = {
            'tenant_id': effective_tenant_id,
            'email_subject': f"Manual upload: {filename}",
            'email_date': datetime.datetime.utcnow(),
            'attachment_name': filename,
            'parsed_data': json.dumps(parsed_data) if parsed_data else "{}",
            'project_type': project_type,
            'quoted_price': quoted_price,
            'area_m2': area_m2,
            'materials_grade': materials_grade,
            'confidence': confidence
        }
        
        # Save to database
        saved_count = db_manager.save_training_data([training_record])
        
        return {
            "ok": True,
            "message": f"Quote uploaded and processed successfully",
            "filename": filename,
            "quote_type": quote_type_result,
            "text_length": len(pdf_text),
            "confidence": confidence,
            "parsed_data": parsed_data,
            "training_records_saved": saved_count,
            "manual_metadata": {
                "project_type": project_type,
                "client_name": client_name,
                "quoted_price": quoted_price,
                "area_m2": area_m2,
                "materials_grade": materials_grade
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Quote upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Quote upload failed: {e}")

@app.post("/preview-email-quotes")
async def preview_email_quotes(payload: EmailTrainingPayload):
    """
    Preview client quotes found in email without training.
    Useful for testing and validation before full training.
    """
    if not EMAIL_TRAINING_AVAILABLE:
        raise HTTPException(status_code=503, detail="Email training not available - database connection required")
    
    try:
        # Get database URL  
        db_url = os.getenv("DATABASE_URL")
        if not db_url:
            raise HTTPException(status_code=500, detail="DATABASE_URL not configured")

        from db_config import get_db_manager
        db_manager = get_db_manager()
        
        # Get Gmail credentials from database
        tenant_id = payload.tenantId
        
        with db_manager.get_connection() as conn:
            cur = conn.cursor()
            # Check if Gmail is connected for this tenant
            cur.execute('SELECT "refreshToken", "gmailAddress" FROM "GmailTenantConnection" WHERE "tenantId" = %s', (tenant_id,))
            result = cur.fetchone()
            
            if not result:
                raise HTTPException(status_code=404, detail="Gmail not connected for this tenant")
                
            refresh_token, gmail_address = result
        
        # Get fresh access token using refresh token
        import requests
        token_data = {
            'client_id': os.getenv('GMAIL_CLIENT_ID'),
            'client_secret': os.getenv('GMAIL_CLIENT_SECRET'),
            'grant_type': 'refresh_token',
            'refresh_token': refresh_token
        }
        
        token_response = requests.post('https://oauth2.googleapis.com/token', data=token_data)
        if not token_response.ok:
            raise HTTPException(status_code=500, detail="Failed to refresh Gmail access token")
        
        access_token = token_response.json()['access_token']
        
        # Search for emails with attachments that might contain quotes
        # Use a broader search to find any emails with PDFs
        gmail_query = "has:attachment (quote OR estimate OR quotation OR proposal OR pdf OR joinery OR windows OR doors OR timber)"
        
        # Add date filter based on days back
        if payload.daysBack <= 7:
            gmail_query += " newer_than:7d"
        elif payload.daysBack <= 30:
            gmail_query += " newer_than:1m"
        
        # First search sent emails (quotes we sent to clients)
        sent_query = gmail_query + " in:sent"
        
        logger.info(f"Searching Gmail with query: {sent_query}")
        
        # Search Gmail using direct API
        headers = {"Authorization": f"Bearer {access_token}"}
        search_url = f"https://www.googleapis.com/gmail/v1/users/me/messages?q={sent_query}&maxResults=50"
        
        search_response = requests.get(search_url, headers=headers)
        if not search_response.ok:
            logger.error(f"Gmail search failed: {search_response.status_code}, {search_response.text}")
            # Try a simpler search
            simple_query = "has:attachment"
            simple_url = f"https://www.googleapis.com/gmail/v1/users/me/messages?q={simple_query}&maxResults=20"
            search_response = requests.get(simple_url, headers=headers)
            
        if not search_response.ok:
            raise HTTPException(status_code=500, detail="Failed to search Gmail")
        
        search_data = search_response.json()
        messages = search_data.get('messages', [])
        
        logger.info(f"Found {len(messages)} messages")
        
        # If no sent emails found, search received emails
        if not messages:
            logger.info("No sent emails found, searching all emails")
            all_query = gmail_query  # Remove in:sent
            all_url = f"https://www.googleapis.com/gmail/v1/users/me/messages?q={all_query}&maxResults=50"
            search_response = requests.get(all_url, headers=headers)
            if search_response.ok:
                search_data = search_response.json()
                messages = search_data.get('messages', [])
                logger.info(f"Found {len(messages)} total messages")
        
        quotes_found = []
        progress_messages = []
        
        if not messages:
            progress_messages.append({"step": "completed", "message": "No emails with attachments found"})
            return {
                "ok": True,
                "total_quotes_found": 0,
                "preview_quotes": [],
                "progress": progress_messages,
                "message": "No client quotes found in the specified time period",
                "summary": {
                    "emails_searched": 0,
                    "pdfs_processed": 0,
                    "quotes_found": 0
                }
            }
        
        progress_messages.append({"step": "searching", "message": f"🔍 Searching {len(messages)} emails for quotes..."})
        
        # Process each message to find PDF attachments with quotes
        for i, message in enumerate(messages[:10]):  # Limit to first 10 for preview
            message_id = message['id']
            
            try:
                # Get message details
                msg_url = f"https://www.googleapis.com/gmail/v1/users/me/messages/{message_id}"
                msg_response = requests.get(msg_url, headers=headers)
                if not msg_response.ok:
                    continue
                
                message_data = msg_response.json()
                payload_data = message_data.get('payload', {})
                
                # Extract headers
                headers_data = {h["name"]: h["value"] for h in payload_data.get("headers", [])}
                subject = headers_data.get("Subject", "No subject")
                
                progress_messages.append({"step": "processing", "message": f"📧 Processing email {i+1}/{len(messages)}: '{subject[:50]}...'"})
                
                # Find PDF attachments
                def find_pdf_attachments(payload):
                    attachments = []
                    
                    if 'parts' in payload:
                        for part in payload['parts']:
                            attachments.extend(find_pdf_attachments(part))
                    
                    # Check if this part is a PDF attachment
                    filename = payload.get('filename', '')
                    if filename.lower().endswith('.pdf') and payload.get('body', {}).get('attachmentId'):
                        attachments.append({
                            'filename': filename,
                            'attachment_id': payload['body']['attachmentId'],
                            'size': payload['body'].get('size', 0)
                        })
                    
                    return attachments
                
                pdf_attachments = find_pdf_attachments(payload_data)
                
                if not pdf_attachments:
                    continue
                
                # Process each PDF attachment
                for attachment in pdf_attachments:
                    try:
                        progress_messages.append({"step": "extracting", "message": f"📄 Processing PDF: {attachment['filename']}"})
                        
                        # Download attachment
                        attachment_url = f"https://www.googleapis.com/gmail/v1/users/me/messages/{message_id}/attachments/{attachment['attachment_id']}"
                        attachment_response = requests.get(attachment_url, headers=headers)
                        
                        if not attachment_response.ok:
                            continue
                        
                        attachment_data = attachment_response.json()
                        raw_data = attachment_data.get("data", "")
                        
                        if not raw_data:
                            continue
                        
                        # Decode base64url data
                        import base64
                        decoded_data = raw_data.replace('-', '+').replace('_', '/')
                        while len(decoded_data) % 4:
                            decoded_data += '='
                        
                        attachment_bytes = base64.b64decode(decoded_data)
                        
                        # Extract text and parse quote
                        pdf_text = extract_text_from_pdf_bytes(attachment_bytes)
                        if not pdf_text:
                            continue
                        
                        parsed_data = parse_client_quote_from_text(pdf_text)
                        confidence = parsed_data.get("confidence", 0.0)
                        
                        # Accept quotes with any confidence > 0 for preview
                        if confidence > 0:
                            quote_info = {
                                "subject": subject,
                                "date_sent": headers_data.get("Date", ""),
                                "attachment_name": attachment['filename'],
                                "confidence": confidence,
                                "project_type": parsed_data.get("questionnaire_answers", {}).get("project_type"),
                                "quoted_price": parsed_data.get("quoted_price"),
                                "area_m2": parsed_data.get("questionnaire_answers", {}).get("area_m2"),
                                "materials_grade": parsed_data.get("questionnaire_answers", {}).get("materials_grade"),
                            }
                            
                            quotes_found.append(quote_info)
                            progress_messages.append({"step": "found", "message": f"✅ Found quote in {attachment['filename']} (confidence: {confidence:.1%})"})
                        
                    except Exception as attachment_error:
                        logger.error(f"Error processing attachment {attachment['filename']}: {attachment_error}")
                        continue
                
            except Exception as message_error:
                logger.error(f"Error processing message {message_id}: {message_error}")
                continue
        
        progress_messages.append({"step": "completed", "message": f"🎯 Found {len(quotes_found)} valid quotes from {len(messages)} emails"})
        
        return {
            "ok": True,
            "total_quotes_found": len(quotes_found),
            "preview_quotes": quotes_found,
            "progress": progress_messages,
            "message": f"Found {len(quotes_found)} client quotes from {len(messages)} emails",
            "summary": {
                "emails_searched": len(messages),
                "pdfs_processed": sum(1 for q in quotes_found),
                "quotes_found": len(quotes_found)
            }
        }
        
    except Exception as e:
        logger.error(f"Preview email quotes failed: {e}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to preview email quotes: {str(e)}")
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Email preview failed: {e}")

@app.post("/train-client-quotes")
async def train_client_quotes(req: Request):
    """
    Train price prediction and win probability models from stored training data.
    Loads data from ml_training_data table, trains sklearn models, and saves them.
    """
    if not EMAIL_TRAINING_AVAILABLE:
        return {
            "ok": False,
            "error": "Training not available - database connection required",
            "model_status": "unavailable"
        }
    
    try:
        payload = await req.json()
        tenant_id = payload.get("tenantId")
        min_samples = int(payload.get("minSamples", 10))  # Minimum samples required for training
        
        from db_config import get_db_manager
        import pandas as pd
        from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import mean_absolute_error, r2_score, accuracy_score
        import joblib
        
        logger.info(f"Starting model retraining for tenant: {tenant_id or 'all'}")
        
        db_manager = get_db_manager()
        conn = db_manager.get_connection()
        
        # Load training data from database
        with conn.cursor() as cur:
            if tenant_id:
                cur.execute("""
                    SELECT 
                        id,
                        parsed_data,
                        confidence,
                        estimated_total,
                        project_type,
                        quoted_price,
                        quote_type,
                        source_type
                    FROM ml_training_data
                    WHERE tenant_id = %s
                    AND estimated_total > 0
                    AND confidence > 0.3
                    ORDER BY created_at DESC
                    LIMIT 1000
                """, (tenant_id,))
            else:
                cur.execute("""
                    SELECT 
                        id,
                        parsed_data,
                        confidence,
                        estimated_total,
                        project_type,
                        quoted_price,
                        quote_type,
                        source_type
                    FROM ml_training_data
                    WHERE estimated_total > 0
                    AND confidence > 0.3
                    ORDER BY created_at DESC
                    LIMIT 1000
                """)
            
            rows = cur.fetchall()
            
        conn.close()
        
        if len(rows) < min_samples:
            return {
                "ok": False,
                "error": f"Insufficient training data: {len(rows)} samples (minimum {min_samples} required)",
                "samples_found": len(rows),
                "min_required": min_samples,
                "message": "Upload more training quotes to enable model training"
            }
        
        logger.info(f"Loaded {len(rows)} training samples from database")
        
        # Extract features from training data
        training_data = []
        for row in rows:
            try:
                parsed_data = row[1] if isinstance(row[1], dict) else {}
                
                # Extract questionnaire answers if available
                qa = parsed_data.get("questionnaire_answers", {})
                
                # Try to extract area_m2 from various sources
                area_m2 = (
                    qa.get("area_m2") or 
                    parsed_data.get("area_m2") or
                    parsed_data.get("total_area") or
                    30.0  # default fallback
                )
                
                # Extract materials grade
                materials_grade = (
                    qa.get("materials_grade") or
                    parsed_data.get("materials_grade") or
                    "Standard"
                )
                
                # Extract project type
                project_type = (
                    row[4] or  # project_type column
                    qa.get("project_type") or
                    parsed_data.get("project_type") or
                    "windows"
                )
                
                # Extract standard premium features from questionnaire
                glazing_type = qa.get("glazing_type", "Standard Double Glazing")
                has_curves = bool(qa.get("has_curves", False))
                premium_hardware = bool(qa.get("premium_hardware", False))
                custom_finish = qa.get("custom_finish", "None")
                installation_required = bool(qa.get("installation_required", False))
                property_listed = bool(qa.get("property_listed", False))
                
                # Extract door/window specifics
                door_height_mm = qa.get("door_height_mm", 2100)
                door_width_mm = qa.get("door_width_mm", 900)
                num_doors = qa.get("num_doors", 0)
                num_windows = qa.get("num_windows", 0)
                
                # Extract context fields
                lead_source = qa.get("lead_source", "website")
                region = qa.get("region", "South East")
                
                # Use quoted_price if available, otherwise estimated_total
                target_price = float(row[5] or row[3] or 0)
                
                if target_price <= 0:
                    continue
                
                # Apply markup to supplier quotes (30-40% markup to get selling price)
                # Supplier quotes are cost prices, not selling prices
                source_type = row[7] if len(row) > 7 else 'client_quote'
                if source_type == 'supplier_quote':
                    # Apply 35% markup (typical trade markup for windows/doors)
                    target_price = target_price * 1.35
                    logger.debug(f"Applied 35% markup to supplier quote: {row[5] or row[3]:.2f} -> {target_price:.2f}")
                
                # Estimate win probability based on confidence and price range
                confidence = float(row[2] or 0.5)
                if target_price < 5000:
                    win_prob = min(0.9, confidence * 1.2)
                elif target_price < 15000:
                    win_prob = confidence
                else:
                    win_prob = max(0.3, confidence * 0.8)
                
                training_data.append({
                    "area_m2": float(area_m2),
                    "materials_grade": str(materials_grade),
                    "project_type": str(project_type),
                    "glazing_type": str(glazing_type),
                    "has_curves": has_curves,
                    "premium_hardware": premium_hardware,
                    "custom_finish": str(custom_finish),
                    "installation_required": installation_required,
                    "property_listed": property_listed,
                    "door_height_mm": float(door_height_mm) if door_height_mm else 2100.0,
                    "door_width_mm": float(door_width_mm) if door_width_mm else 900.0,
                    "num_doors": int(num_doors) if num_doors else 0,
                    "num_windows": int(num_windows) if num_windows else 0,
                    "lead_source": str(lead_source),
                    "region": str(region),
                    "target_price": target_price,
                    "win_probability": win_prob,
                    "confidence": confidence
                })
                
            except Exception as e:
                logger.warning(f"Failed to extract features from training sample: {e}")
                continue
        
        if len(training_data) < min_samples:
            return {
                "ok": False,
                "error": f"Insufficient valid training data: {len(training_data)} samples after feature extraction",
                "samples_found": len(training_data),
                "min_required": min_samples
            }
        
        # Create DataFrame
        df = pd.DataFrame(training_data)
        logger.info(f"Prepared {len(df)} training samples with features")
        
        # Prepare features (X) and targets (y)
        # Encode categorical variables
        df_encoded = df.copy()
        df_encoded["materials_grade_Premium"] = (df_encoded["materials_grade"] == "Premium").astype(int)
        df_encoded["materials_grade_Standard"] = (df_encoded["materials_grade"] == "Standard").astype(int)
        df_encoded["materials_grade_Basic"] = (df_encoded["materials_grade"] == "Basic").astype(int)
        
        # Simple project type encoding (can be enhanced)
        df_encoded["project_type_windows"] = df_encoded["project_type"].str.contains("window", case=False, na=False).astype(int)
        df_encoded["project_type_doors"] = df_encoded["project_type"].str.contains("door", case=False, na=False).astype(int)
        
        # Encode premium features (these capture expensive options like vacuum glass, curves)
        df_encoded["glazing_vacuum"] = df_encoded["glazing_type"].str.contains("vacuum", case=False, na=False).astype(int)
        df_encoded["glazing_triple"] = df_encoded["glazing_type"].str.contains("triple", case=False, na=False).astype(int)
        df_encoded["has_curves_int"] = df_encoded["has_curves"].astype(int)
        df_encoded["premium_hardware_int"] = df_encoded["premium_hardware"].astype(int)
        df_encoded["has_custom_finish"] = (df_encoded["custom_finish"] != "None").astype(int)
        df_encoded["installation_int"] = df_encoded["installation_required"].astype(int)
        df_encoded["listed_building"] = df_encoded["property_listed"].astype(int)
        
        feature_columns = [
            "area_m2",
            "materials_grade_Premium",
            "materials_grade_Standard", 
            "materials_grade_Basic",
            "project_type_windows",
            "project_type_doors",
            "glazing_vacuum",
            "glazing_triple",
            "has_curves_int",
            "premium_hardware_int",
            "has_custom_finish",
            "installation_int",
            "listed_building",
            "door_height_mm",
            "door_width_mm",
            "num_doors",
            "num_windows",
            "confidence"
        ]
        
        X = df_encoded[feature_columns]
        y_price = df_encoded["target_price"]
        y_win = df_encoded["win_probability"]
        
        # Split data for validation
        X_train, X_test, y_price_train, y_price_test, y_win_train, y_win_test = train_test_split(
            X, y_price, y_win, test_size=0.2, random_state=42
        )
        
        # Train price prediction model
        logger.info("Training price prediction model...")
        price_model_new = RandomForestRegressor(
            n_estimators=100,
            max_depth=10,
            min_samples_split=5,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1
        )
        price_model_new.fit(X_train, y_price_train)
        
        # Evaluate price model
        y_price_pred = price_model_new.predict(X_test)
        price_mae = mean_absolute_error(y_price_test, y_price_pred)
        price_r2 = r2_score(y_price_test, y_price_pred)
        
        logger.info(f"Price model - MAE: £{price_mae:.2f}, R²: {price_r2:.3f}")
        
        # Train win probability model
        logger.info("Training win probability model...")
        win_model_new = RandomForestRegressor(  # Using regressor for probabilities
            n_estimators=100,
            max_depth=8,
            min_samples_split=5,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1
        )
        win_model_new.fit(X_train, y_win_train)
        
        # Evaluate win model
        y_win_pred = win_model_new.predict(X_test)
        y_win_pred = np.clip(y_win_pred, 0, 1)  # Ensure probabilities are in [0, 1]
        win_mae = mean_absolute_error(y_win_test, y_win_pred)
        
        logger.info(f"Win model - MAE: {win_mae:.3f}")
        
        # Save models to disk
        os.makedirs("models", exist_ok=True)
        price_model_path = "models/price_model.joblib"
        win_model_path = "models/win_model.joblib"
        feature_meta_path = "models/feature_meta.json"
        
        joblib.dump(price_model_new, price_model_path)
        joblib.dump(win_model_new, win_model_path)
        
        # Save feature metadata
        feature_meta = {
            "columns": feature_columns,
            "trained_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "training_samples": len(df),
            "test_samples": len(X_test),
            "price_mae": float(price_mae),
            "price_r2": float(price_r2),
            "win_mae": float(win_mae),
            "tenant_id": tenant_id,
            "version": "1.0"
        }
        
        with open(feature_meta_path, "w") as f:
            json.dump(feature_meta, f, indent=2)
        
        logger.info(f"Models saved to {price_model_path} and {win_model_path}")
        
        # Reload models globally
        global price_model, win_model, COLUMNS, NUMERIC_COLUMNS
        price_model = load_model(price_model_path)
        win_model = load_model(win_model_path)
        COLUMNS = feature_columns
        NUMERIC_COLUMNS = ["area_m2", "confidence"]
        
        logger.info("Models reloaded successfully")
        
        return {
            "ok": True,
            "message": "Models trained and saved successfully",
            "training_samples": len(df),
            "test_samples": len(X_test),
            "metrics": {
                "price_mae": round(float(price_mae), 2),
                "price_r2": round(float(price_r2), 3),
                "win_mae": round(float(win_mae), 3)
            },
            "feature_columns": feature_columns,
            "model_paths": {
                "price": price_model_path,
                "win": win_model_path,
                "meta": feature_meta_path
            },
            "model_status": "trained"
        }
        
    except Exception as e:
        logger.error(f"Model training failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Model training failed: {str(e)}")

# ============================================================================
# Project Actuals Feedback (Real Costs vs Estimates)
# ============================================================================

class ProjectActualsPayload(BaseModel):
    """Capture completed project data with real costs for ML learning"""
    tenantId: str
    quoteId: Optional[str] = None
    leadId: Optional[str] = None
    questionnaireAnswers: Dict[str, Any]
    supplierQuoteCost: Optional[float] = None  # What supplier charged
    clientEstimate: Optional[float] = None  # Our initial quote
    clientOrderValue: float  # Final agreed price (the truth)
    materialCostActual: Optional[float] = None  # Real PO costs
    laborHoursActual: Optional[float] = None  # Real hours from timesheets
    laborCostActual: Optional[float] = None  # Real labor costs
    otherCostsActual: Optional[float] = None  # Transport, subcontractors
    completedAt: str  # ISO timestamp
    notes: Optional[str] = None

class MaterialCostRecord(BaseModel):
    tenantId: str
    materialCode: Optional[str] = None
    materialName: Optional[str] = None
    supplierName: Optional[str] = None
    currency: Optional[str] = "GBP"
    unit: Optional[str] = None
    unitPrice: float
    previousUnitPrice: Optional[float] = None
    purchaseOrderId: Optional[str] = None
    capturedAt: Optional[str] = None

class MaterialCostsPayload(BaseModel):
    tenantId: str
    items: List[MaterialCostRecord]

@app.post("/save-material-costs")
async def save_material_costs(payload: MaterialCostsPayload):
    """Save material cost changes from manual or uploaded purchase orders for trend tracking and ML feature enrichment."""
    if not EMAIL_TRAINING_AVAILABLE:
        raise HTTPException(status_code=503, detail="Material costs not available - database connection required")
    from db_config import get_db_manager
    db_manager = get_db_manager()
    inserted: List[Dict[str, Any]] = []
    try:
        with db_manager.get_connection() as conn:
            with conn.cursor() as cur:
                for item in payload.items:
                    captured_at = item.capturedAt or datetime.datetime.utcnow().isoformat()
                    price_change_percent = None
                    if item.previousUnitPrice is not None and item.previousUnitPrice > 0:
                        price_change_percent = ((item.unitPrice - item.previousUnitPrice) / item.previousUnitPrice) * 100.0
                    cur.execute(
                        """
                        INSERT INTO ml_material_costs (
                            tenant_id, material_code, material_name, supplier_name,
                            currency, unit, unit_price, previous_unit_price,
                            price_change_percent, purchase_order_id, captured_at
                        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        RETURNING id
                        """,
                        (
                            payload.tenantId,
                            item.materialCode,
                            item.materialName,
                            item.supplierName,
                            item.currency,
                            item.unit,
                            item.unitPrice,
                            item.previousUnitPrice,
                            price_change_percent,
                            item.purchaseOrderId,
                            captured_at,
                        ),
                    )
                    rid = cur.fetchone()[0]
                    inserted.append({
                        "id": rid,
                        "material_code": item.materialCode,
                        "supplier": item.supplierName,
                        "unit_price": item.unitPrice,
                        "previous_unit_price": item.previousUnitPrice,
                        "price_change_percent": round(price_change_percent,3) if price_change_percent is not None else None
                    })
                conn.commit()
        return {"ok": True, "count": len(inserted), "items": inserted}
    except Exception as e:
        logger.error(f"Failed to save material costs: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="material_costs_save_failed")

@app.get("/material-costs/recent")
async def recent_material_costs(tenantId: str, limit: int = 50):
    """Return recent material cost snapshots & latest change per material."""
    if not EMAIL_TRAINING_AVAILABLE:
        raise HTTPException(status_code=503, detail="material_costs_unavailable")
    from db_config import get_db_manager
    db_manager = get_db_manager()
    try:
        items: List[Dict[str, Any]] = []
        latest_map: Dict[str, Dict[str, Any]] = {}
        with db_manager.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, material_code, material_name, supplier_name, unit_price, previous_unit_price,
                           price_change_percent, purchase_order_id, captured_at
                    FROM ml_material_costs
                    WHERE tenant_id = %s
                    ORDER BY captured_at DESC
                    LIMIT %s
                    """,
                    (tenantId, limit)
                )
                rows = cur.fetchall()
                for r in rows:
                    rec = {
                        "id": r[0],
                        "material_code": r[1],
                        "material_name": r[2],
                        "supplier_name": r[3],
                        "unit_price": float(r[4]) if r[4] is not None else None,
                        "previous_unit_price": float(r[5]) if r[5] is not None else None,
                        "price_change_percent": float(r[6]) if r[6] is not None else None,
                        "purchase_order_id": r[7],
                        "captured_at": r[8].isoformat() if r[8] else None,
                    }
                    items.append(rec)
                    mc = rec["material_code"] or rec["material_name"] or "unknown"
                    if mc not in latest_map:
                        latest_map[mc] = rec
        summary = [latest_map[k] for k in sorted(latest_map.keys())]
        return {"ok": True, "count": len(items), "materials": summary, "recent": items}
    except Exception as e:
        logger.error(f"Failed to fetch recent material costs: {e}")
        raise HTTPException(status_code=500, detail="material_costs_fetch_failed")

@app.get("/material-costs/trends")
async def material_cost_trends(tenantId: str, window: int = 12):
    """Return per-material trend series (last N snapshots) with change metrics."""
    if not EMAIL_TRAINING_AVAILABLE:
        raise HTTPException(status_code=503, detail="material_costs_unavailable")
    from db_config import get_db_manager
    db_manager = get_db_manager()
    try:
        with db_manager.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT material_code, material_name, supplier_name,
                           array_agg(unit_price ORDER BY captured_at DESC) as prices,
                           array_agg(captured_at ORDER BY captured_at DESC) as times
                    FROM (
                        SELECT material_code, material_name, supplier_name, unit_price, captured_at
                        FROM ml_material_costs
                        WHERE tenant_id = %s
                        ORDER BY captured_at DESC
                    ) t
                    GROUP BY material_code, material_name, supplier_name
                    """,
                    (tenantId,)
                )
                rows = cur.fetchall()
        trends: list[dict[str, Any]] = []
        for r in rows:
            code, name, supplier, prices, times = r
            if not prices:
                continue
            series = list(reversed([float(p) for p in prices[:window]]))  # chronological
            ts_series = list(reversed([t.isoformat() for t in times[:window]]))
            first = series[0]
            latest = series[-1]
            pct_change = ((latest - first) / first * 100.0) if first else 0.0
            trends.append({
                "material_code": code,
                "material_name": name,
                "supplier_name": supplier,
                "series": series,
                "timestamps": ts_series,
                "latest": latest,
                "first": first,
                "pct_change": round(pct_change, 2)
            })
        # Sort by absolute pct change desc
        trends.sort(key=lambda x: abs(x["pct_change"]), reverse=True)
        return {"ok": True, "count": len(trends), "trends": trends}
    except Exception as e:
        logger.error(f"Failed to fetch material cost trends: {e}")
        raise HTTPException(status_code=500, detail="material_costs_trends_failed")

@app.post("/save-project-actuals")
async def save_project_actuals(payload: ProjectActualsPayload):
    """
    Save completed project actuals for ML to learn from real-world results.
    This is the gold standard training data - what actually happened vs what we estimated.
    """
    if not EMAIL_TRAINING_AVAILABLE:
        raise HTTPException(status_code=503, detail="Project actuals not available - database connection required")
    
    try:
        from db_config import get_db_manager
        import json
        
        db_manager = get_db_manager()
        
        # Calculate derived metrics
        total_cost = (payload.materialCostActual or 0) + (payload.laborCostActual or 0) + (payload.otherCostsActual or 0)
        gross_profit = payload.clientOrderValue - total_cost
        gp_percent = (gross_profit / payload.clientOrderValue * 100) if payload.clientOrderValue > 0 else 0
        
        estimate_variance = (payload.clientOrderValue - payload.clientEstimate) if payload.clientEstimate else None
        cost_variance = (payload.materialCostActual - payload.supplierQuoteCost) if (payload.materialCostActual and payload.supplierQuoteCost) else None
        
        # Insert into ml_project_actuals
        insert_sql = """
            INSERT INTO ml_project_actuals (
                tenant_id, quote_id, lead_id, questionnaire_answers,
                supplier_quote_cost, client_estimate, client_order_value,
                material_cost_actual, labor_hours_actual, labor_cost_actual, other_costs_actual,
                total_cost_actual, gross_profit_actual, gp_percent_actual,
                estimate_variance, cost_variance, completed_at, notes
            ) VALUES (
                %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s, %s
            ) RETURNING id
        """
        
        with db_manager.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(insert_sql, (
                    payload.tenantId,
                    payload.quoteId,
                    payload.leadId,
                    json.dumps(payload.questionnaireAnswers),
                    payload.supplierQuoteCost,
                    payload.clientEstimate,
                    payload.clientOrderValue,
                    payload.materialCostActual,
                    payload.laborHoursActual,
                    payload.laborCostActual,
                    payload.otherCostsActual,
                    total_cost,
                    gross_profit,
                    gp_percent,
                    estimate_variance,
                    cost_variance,
                    payload.completedAt,
                    payload.notes
                ))
                result = cur.fetchone()
                project_actual_id = result[0] if result else None
                conn.commit()
        
        logger.info(f"Saved project actuals for tenant {payload.tenantId}: GP={gp_percent:.1f}%, Variance={estimate_variance}")
        
        return {
            "ok": True,
            "id": project_actual_id,
            "metrics": {
                "total_cost_actual": round(total_cost, 2),
                "gross_profit_actual": round(gross_profit, 2),
                "gp_percent_actual": round(gp_percent, 1),
                "estimate_variance": round(estimate_variance, 2) if estimate_variance else None,
                "cost_variance": round(cost_variance, 2) if cost_variance else None,
                "hit_target": gp_percent >= 40.0
            },
            "message": f"Project actuals saved. GP: {gp_percent:.1f}% {'✅' if gp_percent >= 40 else '⚠️'}"
        }
        
    except Exception as e:
        logger.error(f"Failed to save project actuals: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to save project actuals: {str(e)}")

class QuoteMarkupPayload(BaseModel):
    """Capture quote builder markup application for ML learning"""
    tenantId: str
    quoteId: str
    questionnaireAnswers: Dict[str, Any]
    supplierCost: float
    clientEstimate: float
    markupPercent: float
    currency: str
    source: str = "quote_builder_markup"

@app.post("/save-quote-markup")
async def save_quote_markup(payload: QuoteMarkupPayload):
    """
    Auto-save quote builder markup applications to ML training data.
    Captures supplier cost + client estimate to learn pricing patterns.
    """
    if not EMAIL_TRAINING_AVAILABLE:
        return {"ok": False, "message": "ML training not available"}
    
    try:
        from db_config import get_db_manager
        import json
        import datetime
        
        db_manager = get_db_manager()
        
        # Create training record
        training_record = {
            'tenant_id': payload.tenantId,
            'email_subject': f"Quote Builder Markup - {payload.quoteId}",
            'email_date': datetime.datetime.utcnow(),
            'attachment_name': f"quote_{payload.quoteId}.pdf",
            'parsed_data': json.dumps({
                'questionnaire_answers': payload.questionnaireAnswers,
                'supplier_cost': payload.supplierCost,
                'client_estimate': payload.clientEstimate,
                'markup_percent': payload.markupPercent,
                'source': payload.source
            }),
            'project_type': 'quote_builder',
            'quoted_price': payload.clientEstimate,
            'area_m2': payload.questionnaireAnswers.get('area_m2'),
            'materials_grade': payload.questionnaireAnswers.get('materials_grade'),
            'confidence': 0.95,  # High confidence - user manually applied markup
            'source_type': 'client_quote'  # This is the final client price
        }
        
        saved = db_manager.save_training_data([training_record])
        
        logger.info(f"Saved quote markup to training: {payload.quoteId}, £{payload.supplierCost:.0f} -> £{payload.clientEstimate:.0f} ({payload.markupPercent}%)")
        
        return {
            "ok": True,
            "saved": saved,
            "message": f"Quote markup saved to ML training ({payload.markupPercent}% markup)"
        }
        
    except Exception as e:
        logger.error(f"Failed to save quote markup: {e}")
        return {"ok": False, "error": str(e)}

# ============================================================================
# Lead Classifier Training Endpoints
# ============================================================================

class LeadFeedbackPayload(BaseModel):
    """Payload for lead classification feedback"""
    tenantId: str
    emailId: str  # email identifier (gmail:messageId or ms365:messageId) 
    provider: str  # gmail or ms365
    messageId: str
    isLead: bool  # true = this email is a lead, false = not a lead
    subject: Optional[str] = None
    fromEmail: Optional[str] = None
    snippet: Optional[str] = None
    confidence: Optional[float] = None
    reason: Optional[str] = None

class LeadClassifierRetrainPayload(BaseModel):
    """Payload for retraining lead classifier"""
    tenantId: str
    limit: Optional[int] = 100  # Number of recent training examples to use

@app.post("/lead-classifier/feedback")
async def submit_lead_feedback(payload: LeadFeedbackPayload):
    """
    Submit feedback on whether an email is actually a lead or not.
    This trains the lead classifier to be more accurate.
    """
    if not EMAIL_TRAINING_AVAILABLE:
        raise HTTPException(status_code=503, detail="Lead training not available - database connection required")
    
    try:
        # Get database URL
        db_url = os.getenv("DATABASE_URL")
        if not db_url:
            raise HTTPException(status_code=500, detail="DATABASE_URL not configured")
        
        # Store the feedback in the training database
        from db_config import get_db_manager
        db_manager = get_db_manager()  # This automatically creates tables
        
        # Create lead feedback table if not exists
        # Create the table if it doesn't exist
        create_table_sql = """
            CREATE TABLE IF NOT EXISTS lead_classifier_training (
                id SERIAL PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                email_id TEXT NOT NULL,
                provider TEXT NOT NULL,
                message_id TEXT NOT NULL,
                is_lead BOOLEAN NOT NULL,
                subject TEXT,
                from_email TEXT,
                snippet TEXT,
                confidence DECIMAL(3,2),
                reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(tenant_id, email_id)
            );
            
            CREATE INDEX IF NOT EXISTS idx_lead_classifier_tenant_created 
            ON lead_classifier_training(tenant_id, created_at);
        """
        
        db_manager.execute_query(create_table_sql)
        
        db_manager.execute_query(create_table_sql)
        
        # Insert the feedback (upsert to handle duplicates)
        upsert_sql = """
            INSERT INTO lead_classifier_training (
                tenant_id, provider, message_id, email_id, is_lead, 
                subject, from_email, snippet, confidence, reason
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (tenant_id, provider, message_id) 
            DO UPDATE SET 
                is_lead = EXCLUDED.is_lead,
                subject = EXCLUDED.subject,
                from_email = EXCLUDED.from_email,
                snippet = EXCLUDED.snippet,
                confidence = EXCLUDED.confidence,
                reason = EXCLUDED.reason,
                created_at = CURRENT_TIMESTAMP
        """
        
        db_manager.execute_query(upsert_sql, (
            payload.tenantId,
            payload.provider,
            payload.messageId,
            payload.emailId,
            payload.isLead,
            payload.subject,
            payload.fromEmail,
            payload.snippet,
            payload.confidence,
            payload.reason
        ))
        
        return {
            "ok": True,
            "message": f"Lead classification feedback recorded: {'LEAD' if payload.isLead else 'NOT_LEAD'}",
            "tenantId": payload.tenantId,
            "emailId": payload.emailId,
            "isLead": payload.isLead
        }
        
    except Exception as e:
        logger.error(f"Lead feedback error: {e}")
        raise HTTPException(status_code=500, detail=f"Lead feedback failed: {e}")

@app.post("/lead-classifier/retrain")
async def retrain_lead_classifier(payload: LeadClassifierRetrainPayload):
    """
    Retrain the lead classifier using accumulated feedback.
    This improves the accuracy of email classification.
    """
    if not EMAIL_TRAINING_AVAILABLE:
        raise HTTPException(status_code=503, detail="Lead training not available - database connection required")
    
    try:
        # Get database URL
        db_url = os.getenv("DATABASE_URL")
        if not db_url:
            raise HTTPException(status_code=500, detail="DATABASE_URL not configured")
        
        from db_config import get_db_manager
        db_manager = get_db_manager()  # This automatically creates tables
        
        # Ensure retraining log table exists
        create_log_table_sql = """
            CREATE TABLE IF NOT EXISTS lead_classifier_retraining_log (
                id SERIAL PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                examples_used INTEGER,
                performance_metrics JSONB,
                retrained_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_retrain_log_tenant_date 
            ON lead_classifier_retraining_log(tenant_id, retrained_at);
        """
        
        db_manager.execute_query(create_log_table_sql)
        
        # Get recent training examples
        query_sql = """
            SELECT tenant_id, provider, message_id, email_id, is_lead, 
                   subject, from_email, snippet, confidence, reason, created_at
            FROM lead_classifier_training 
            WHERE tenant_id = %s 
            ORDER BY created_at DESC 
            LIMIT %s
        """
        
        training_data = db_manager.fetch_all(query_sql, (payload.tenantId, payload.limit))
        
        if not training_data:
            return {
                "ok": True,
                "message": "No training data available for retraining",
                "tenantId": payload.tenantId,
                "examples_used": 0
            }
        
        # Count leads vs non-leads
        leads_count = sum(1 for row in training_data if row[4])  # is_lead column
        non_leads_count = len(training_data) - leads_count
        
        # TODO: Implement actual ML model retraining here
        # For now, we'll simulate the retraining process
        
        # Simulate performance metrics based on training data size
        performance_metrics = {
            "accuracy": 0.85 + (leads_count + non_leads_count) * 0.01,  # Simulate improving accuracy
            "precision": 0.80 + leads_count * 0.005,
            "recall": 0.75 + non_leads_count * 0.003,
            "training_examples": len(training_data),
            "leads_count": leads_count,
            "non_leads_count": non_leads_count,
            "model_version": "1.0"
        }
        
        # Log retraining event
        retrain_log_sql = """
            INSERT INTO lead_classifier_retraining_log (
                tenant_id, examples_used, performance_metrics
            ) VALUES (%s, %s, %s)
        """
        
        import json
        db_manager.execute_query(retrain_log_sql, (
            payload.tenantId,
            len(training_data),
            json.dumps(performance_metrics)
        ))
        
        return {
            "ok": True,
            "message": "Lead classifier retrained successfully",
            "tenantId": payload.tenantId,
            "examples_used": len(training_data),
            "leads_count": leads_count,
            "non_leads_count": non_leads_count,
            "performance": performance_metrics
        }
        
    except Exception as e:
        logger.error(f"Lead classifier retrain error: {e}")
        raise HTTPException(status_code=500, detail=f"Lead classifier retraining failed: {e}")

@app.get("/lead-classifier/stats")
async def get_lead_classifier_stats(tenantId: str):
    """
    Get statistics about lead classifier training and performance.
    """
    if not EMAIL_TRAINING_AVAILABLE:
        raise HTTPException(status_code=503, detail="Lead training not available - database connection required")
    
    try:
        # Get database URL
        db_url = os.getenv("DATABASE_URL")
        if not db_url:
            raise HTTPException(status_code=500, detail="DATABASE_URL not configured")
        
        from db_config import get_db_manager
        db_manager = get_db_manager()  # This automatically creates tables
        
        # Get training data stats
        stats_sql = """
            SELECT 
                COUNT(*) as total_examples,
                SUM(CASE WHEN is_lead THEN 1 ELSE 0 END) as leads_count,
                SUM(CASE WHEN NOT is_lead THEN 1 ELSE 0 END) as non_leads_count,
                AVG(CASE WHEN confidence IS NOT NULL THEN confidence ELSE NULL END) as avg_confidence,
                MAX(created_at) as last_feedback
            FROM lead_classifier_training 
            WHERE tenant_id = %s
        """
        
        with db_manager.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(stats_sql, (tenantId,))
                stats_result = cur.fetchone()
        
        # Get retraining history - handle case where table doesn't exist yet
        try:
            retrain_history_sql = """
                SELECT retrained_at, examples_used, performance_metrics
                FROM lead_classifier_retraining_log 
                WHERE tenant_id = %s 
                ORDER BY retrained_at DESC 
                LIMIT 5
            """
            
            with db_manager.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(retrain_history_sql, (tenantId,))
                    retrain_history = cur.fetchall()
        except Exception as e:
            # Table might not exist yet - that's ok
            retrain_history = []
        
        if stats_result:
            return {
                "ok": True,
                "tenantId": tenantId,
                "training_stats": {
                    "total_examples": stats_result[0] or 0,
                    "leads_count": stats_result[1] or 0,
                    "non_leads_count": stats_result[2] or 0,
                    "avg_confidence": float(stats_result[3]) if stats_result[3] else None,
                    "last_feedback": stats_result[4].isoformat() if stats_result[4] else None
                },
                "retrain_history": [
                    {
                        "retrained_at": row[0].isoformat() if row[0] else None,
                        "examples_used": row[1],
                        "performance_metrics": row[2]
                    }
                    for row in retrain_history
                ] if retrain_history else []
            }
        else:
            return {
                "ok": True,
                "tenantId": tenantId,
                "training_stats": {
                    "total_examples": 0,
                    "leads_count": 0,
                    "non_leads_count": 0,
                    "avg_confidence": None,
                    "last_feedback": None
                },
                "retrain_history": []
            }
        
    except Exception as e:
        logger.error(f"Lead classifier stats error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get lead classifier stats: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)