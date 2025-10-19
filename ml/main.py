# ml/main.py
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List, Set
import joblib, pandas as pd, numpy as np
import json, os, traceback
from pdf_parser import parse_pdf_from_url

app = FastAPI(title="JoineryAI ML API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://joineryai.app",
        "https://www.joineryai.app",
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

# --------- Introspect pipelines to recover expected input columns ----------
def _walk_estimators(obj):
    """Yield nested estimators/transformers inside sklearn Pipelines/ColumnTransformers."""
    try:
        from sklearn.pipeline import Pipeline
        from sklearn.compose import ColumnTransformer
    except Exception:
        return
    if isinstance(obj, Pipeline):
        for _, step in obj.steps:
            yield step
            for inner in _walk_estimators(step):
                yield inner
    elif hasattr(obj, "transformers"):  # ColumnTransformer-like
        try:
            for _name, trans, _cols in obj.transformers:  # type: ignore[attr-defined]
                yield trans
                if hasattr(trans, "transformers"):
                    for inner in _walk_estimators(trans):
                        yield inner
        except Exception:
            pass

def expected_columns_from_model(model) -> List[str]:
    """Try to read the column names a ColumnTransformer was fit with."""
    cols: List[str] = []
    for est in _walk_estimators(model):
        if hasattr(est, "transformers"):
            try:
                for _name, _trans, _cols in est.transformers:  # type: ignore[attr-defined]
                    if isinstance(_cols, (list, tuple, np.ndarray)):
                        str_cols = [c for c in _cols if isinstance(c, str)]
                        cols.extend(str_cols)
            except Exception:
                continue
    # Deduplicate preserving order
    seen = set()
    out: List[str] = []
    for c in cols:
        if c not in seen:
            seen.add(c)
            out.append(c)
    return out

# Build the final expected column list:
meta_cols: List[str] = list(feature_meta.get("columns") or [])
price_cols = expected_columns_from_model(price_model) if price_model else []
win_cols   = expected_columns_from_model(win_model) if win_model else []

# Union in a stable order: meta first, then any new from models
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

# Work out numeric vs categorical
NUMERIC_COLUMNS: Set[str] = set(feature_meta.get("numeric_columns") or [])
CATEGORICAL_COLUMNS: Set[str] = set(feature_meta.get("categorical_columns") or [])
if not NUMERIC_COLUMNS and not CATEGORICAL_COLUMNS:
    # Heuristics + known numerics
    numeric_hints = ("area", "num_", "days_", "value", "gbp", "amount", "count")
    known_numerics = {"area_m2", "num_emails_thread", "days_to_first_reply", "quote_value_gbp"}
    for col in COLUMNS:
        if col in known_numerics or any(h in col.lower() for h in numeric_hints):
            NUMERIC_COLUMNS.add(col)
    CATEGORICAL_COLUMNS = set(c for c in COLUMNS if c not in NUMERIC_COLUMNS)

# --------- Request schema ----------
class QuoteIn(BaseModel):
    area_m2: float = Field(..., description="Projected area (m^2)")
    materials_grade: str = Field(..., description="Basic | Standard | Premium")
    project_type: Optional[str] = None
    lead_source: Optional[str] = None
    region: Optional[str] = "uk"

# --------- Feature row builder ----------
def build_feature_row(q: QuoteIn) -> pd.DataFrame:
    base = {
        "area_m2": float(q.area_m2),
        "materials_grade": q.materials_grade or "",
        "project_type": (q.project_type or ""),
        "lead_source": (q.lead_source or ""),
        "region": (q.region or "uk"),
    }

    # Fill all expected columns; default 0 for numeric, "" for categorical
    row: Dict[str, Any] = {}
    for col in COLUMNS:
        if col in base:
            row[col] = base[col]
        else:
            row[col] = 0 if col in NUMERIC_COLUMNS else ""

    df = pd.DataFrame([row], columns=COLUMNS)

    # Enforce dtypes
    for col in NUMERIC_COLUMNS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
    for col in CATEGORICAL_COLUMNS:
        if col in df.columns:
            df[col] = df[col].astype(str)

    return df

def models_status():
    return {"price": bool(price_model), "win": bool(win_model)}

# --------- Routes ----------
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
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Feature build failed: {e}")

    try:
        price = float(price_model.predict(X)[0])
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"price predict failed: {e}")

    try:
        if hasattr(win_model, "predict_proba"):
            win_prob = float(win_model.predict_proba(X)[0][1])
        else:
            win_pred = float(win_model.predict(X)[0])
            win_prob = float(max(0.0, min(1.0, win_pred)))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"win predict failed: {e}")

    return {
        "predicted_price": round(price, 2),
        "win_probability": round(win_prob, 3),
        "columns_used": COLUMNS,
    }

# --------- Training (structured payload from API) ----------
class TrainItem(BaseModel):
    messageId: str
    attachmentId: str
    downloadUrl: str
    quotedAt: str

class TrainPayload(BaseModel):
    tenantId: str
    items: List[TrainItem] = []

@app.post("/train")
async def train(payload: TrainPayload):
    """
    Download each signed attachment URL, parse lightweight quote structure,
    and return a summary (placeholder for real training).
    """
    parsed_results = []
    failures = []

    for it in payload.items:
        res = parse_pdf_from_url(it.downloadUrl)
        if res.get("ok"):
            parsed_results.append({
                "messageId": it.messageId,
                "attachmentId": it.attachmentId,
                "quotedAt": it.quotedAt,
                "url": it.downloadUrl,
                "text_chars": res.get("text_chars", 0),
                "parsed": res.get("parsed", {}),
            })
        else:
            failures.append({
                "messageId": it.messageId,
                "attachmentId": it.attachmentId,
                "url": it.downloadUrl,
                "error": res.get("error", "unknown"),
            })

    # Naive placeholder “training”: aggregate a few stats
    total_docs = len(payload.items)
    ok_docs = len(parsed_results)
    fail_docs = len(failures)
    avg_total = None
    totals = []
    for r in parsed_results:
        est = (r.get("parsed") or {}).get("estimated_total")
        if isinstance(est, (int, float)):
            totals.append(float(est))
    if totals:
        avg_total = round(sum(totals) / len(totals), 2)

    return {
        "ok": True,
        "tenantId": payload.tenantId,
        "received_items": total_docs,
        "parsed_ok": ok_docs,
        "failed": fail_docs,
        "avg_estimated_total": avg_total,
        "samples": parsed_results[:5],  # include first few examples for debugging
        "failures": failures[:5],
        "message": "Training job accepted (placeholder).",
    }