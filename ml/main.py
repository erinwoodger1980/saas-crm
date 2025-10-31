# ml/main.py
from __future__ import annotations
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List, Set
import joblib, pandas as pd, numpy as np
import json, os, traceback, urllib.request, datetime

from pdf_parser import extract_text_from_pdf_bytes, parse_totals_from_text, parse_client_quote_from_text, determine_quote_type

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
        return joblib.load(path) if os.path.exists(path) else None
    except Exception:
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
    return {"status": "ok", "models": models_status()}

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
        price = float(price_model.predict(X)[0])
        if hasattr(win_model, "predict_proba"):
            win_prob = float(win_model.predict_proba(X)[0][1])
        else:
            win_pred = float(win_model.predict(X)[0])
            win_prob = float(max(0.0, min(1.0, win_pred)))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"predict failed: {e}")

    return {
        "predicted_price": round(price, 2),
        "win_probability": round(win_prob, 3),
        "columns_used": COLUMNS,
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