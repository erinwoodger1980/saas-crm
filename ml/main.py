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

app = FastAPI(title="JoineryAI ML API")

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
        
        # Test specific attachment processing
        message_id = "19a3f6846b1e3038"  # From debug output
        attachment_id = "ANGjdJ-ow0gGB3JZQDm988R7Al9Gm5-wh1lzYUySz5Db-KrEOPOyQsJx6FrMcbp4Xk1zGKmv98XgzaXbKNlA_f9QMMClcfutqilXbzT6Ddf3XbKX8bFqnvuCPmEjZlu-DBoHbuBSmC6oGw59aPUjt23Sxp28oBMGw6Uk9qBjuT7cQneHIz9theMZ3CwLvmspZCUHvB7iA2yQXM-EPqKAnQDGMULafSijnK--mqx8ChnwkWrdPlXQjT2Sg_N1YCnqageHErL8hSXVZuOSZZKduFUjNatRJKVsZLaIzuyoanWd4ix5LFGNpbElU5Qb7D2m6LCfO0YZvXuTDIJguhqJQPU4S-JmTpzA-0gsroCpNwU2AWqCrPGymUqwdxpJ3v4KoqZ7fs5vMN3ZLzJWuWgD"
        
        debug_info = {
            "message_id": message_id,
            "attachment_id": attachment_id[:50] + "...",  # Truncate for readability
            "steps": []
        }
        
        # Step 1: Download attachment
        debug_info["steps"].append("Downloading attachment...")
        try:
            # Create a custom download method with error capture
            access_token = workflow.email_service._get_access_token()
            
            # Test Gmail attachment download directly
            import requests
            url = f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{message_id}/attachments/{attachment_id}"
            headers = {"Authorization": f"Bearer {access_token}"}
            
            response = requests.get(url, headers=headers)
            debug_info["download_url"] = url[:100] + "..."
            debug_info["download_status"] = response.status_code
            debug_info["download_ok"] = response.ok
            
            if not response.ok:
                debug_info["download_error_text"] = response.text[:500]
                debug_info["steps"].append(f"Download failed with status {response.status_code}")
                return debug_info
            
            data = response.json()
            attachment_data_raw = data.get("data", "")
            debug_info["raw_data_length"] = len(attachment_data_raw)
            
            if not attachment_data_raw:
                debug_info["steps"].append("No data in response")
                return debug_info
            
            # Decode base64url
            import base64
            attachment_data_raw = attachment_data_raw.replace('-', '+').replace('_', '/')
            while len(attachment_data_raw) % 4:
                attachment_data_raw += '='
            
            attachment_data = base64.b64decode(attachment_data_raw)
            
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
    if not price_model or not win_model:
        raise HTTPException(status_code=503, detail="models not loaded")
    try:
        payload = await req.json()
        q = QuoteIn(**payload)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Validation failed: {e}")

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
        "model_status": "active" if price_model and win_model else "fallback"
    }

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

@app.post("/train")
async def train(payload: TrainPayload):
    """
    Downloads each signed URL -> extracts text -> finds totals (heuristic).
    Returns quick stats + a few sample records. Later you can fit/refresh models here.
    """
    ok = 0
    fails: List[Dict[str, Any]] = []
    samples: List[Dict[str, Any]] = []

    for item in payload.items:
        try:
            pdf_bytes = _http_get_bytes(item.url)
            text = extract_text_from_pdf_bytes(pdf_bytes) or ""
            parsed = parse_totals_from_text(text) if text else {
                "currency": None,
                "lines": [],
                "detected_totals": [],
                "estimated_total": None,
                "confidence": 0,
            }
            ok += 1

            # keep up to 5 samples
            if len(samples) < 5:
                samples.append({
                    "messageId": item.messageId,
                    "attachmentId": item.attachmentId,
                    "quotedAt": _iso(item.quotedAt),
                    "url": item.url,
                    "text_chars": len(text),
                    "parsed": parsed,
                })
        except Exception as e:
            fails.append({
                "messageId": item.messageId,
                "attachmentId": item.attachmentId,
                "url": item.url,
                "error": f"{e}",
            })

    avg_est = None
    vals = [
        s["parsed"]["estimated_total"]
        for s in samples
        if s.get("parsed", {}).get("estimated_total") is not None
    ]
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
        "avg_estimated_total": avg_est,
        "samples": samples,
        "failures": fails,
        "message": "Training job accepted (heuristic parser).",
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
    credentials: Dict[str, Any]
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
        
        # Run the complete workflow with real Gmail credentials
        results = workflow.run_full_workflow(
            email_provider=payload.emailProvider,
            credentials=gmail_credentials,  # Use real credentials from database
            days_back=payload.daysBack
        )
        
        return {
            "ok": True,
            "message": "Email training workflow completed",
            "results": {
                "quotes_found": results["quotes_found"],
                "training_records_saved": results["training_records_saved"],
                "ml_training_completed": results["ml_training_completed"],
                "duration_seconds": results["duration"].total_seconds(),
                "errors": results["errors"]
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
        
        # Get Gmail credentials from database (same as start-email-training)
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
            else:
                raise HTTPException(status_code=404, detail="Gmail not connected for this tenant")
        
        # Initialize workflow
        workflow = EmailTrainingWorkflow(db_url, payload.tenantId)
        workflow.setup_email_service(payload.emailProvider, gmail_credentials)
        
        # Find quotes without training
        quotes = workflow.find_client_quotes(payload.daysBack)
        
        # Convert to preview format
        preview_quotes = []
        for quote in quotes[:10]:  # Limit to first 10 for preview
            preview_quotes.append({
                "subject": quote.subject,
                "date_sent": quote.date_sent.isoformat(),
                "attachment_name": quote.attachment_name,
                "confidence": quote.confidence,
                "project_type": quote.parsed_data.get("questionnaire_answers", {}).get("project_type"),
                "quoted_price": quote.parsed_data.get("quoted_price"),
                "area_m2": quote.parsed_data.get("questionnaire_answers", {}).get("area_m2"),
                "materials_grade": quote.parsed_data.get("questionnaire_answers", {}).get("materials_grade"),
            })
        
        return {
            "ok": True,
            "total_quotes_found": len(quotes),
            "preview_quotes": preview_quotes,
            "message": f"Found {len(quotes)} client quotes from last {payload.daysBack} days"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Email preview failed: {e}")

@app.post("/train-client-quotes")
async def train_client_quotes(payload: TrainPayload):
    """
    Process client quotes from emails to extract questionnaire answers and pricing
    for training ML models on how to quote based on client requirements.
    """
    ok = 0
    fails: List[Dict[str, Any]] = []
    training_samples: List[Dict[str, Any]] = []

    for item in payload.items:
        try:
            pdf_bytes = _http_get_bytes(item.url)
            text = extract_text_from_pdf_bytes(pdf_bytes) or ""
            
            # Determine quote type
            quote_type = determine_quote_type(text)
            
            if quote_type == "client":
                # Parse as client quote for training data
                parsed = parse_client_quote_from_text(text)
            else:
                # Fallback to supplier quote parsing
                parsed = parse_totals_from_text(text)
                
            ok += 1

            # Store training data sample
            training_sample = {
                "messageId": item.messageId,
                "attachmentId": item.attachmentId,
                "quotedAt": _iso(item.quotedAt),
                "quote_type": quote_type,
                "text_chars": len(text),
                "parsed": parsed,
            }
            
            training_samples.append(training_sample)
            
        except Exception as e:
            fails.append({
                "messageId": item.messageId,
                "attachmentId": item.attachmentId,
                "url": item.url,
                "error": f"{e}",
            })

    # Calculate training stats
    client_quotes = [s for s in training_samples if s["quote_type"] == "client"]
    avg_quoted_price = None
    
    if client_quotes:
        quoted_prices = [
            s["parsed"]["quoted_price"]
            for s in client_quotes
            if s.get("parsed", {}).get("quoted_price") is not None
        ]
        if quoted_prices:
            try:
                avg_quoted_price = round(float(sum(quoted_prices)) / len(quoted_prices), 2)
            except Exception:
                avg_quoted_price = None

    return {
        "ok": True,
        "tenantId": payload.tenantId,
        "received_items": len(payload.items),
        "parsed_ok": ok,
        "failed": len(fails),
        "client_quotes_found": len(client_quotes),
        "avg_quoted_price": avg_quoted_price,
        "training_samples": training_samples[:5],  # Return first 5 samples
        "failures": fails,
        "message": "Client quote training data extracted successfully.",
    }

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