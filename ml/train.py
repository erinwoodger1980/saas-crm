# ml/train.py
import os
import json
import math
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.metrics import mean_absolute_error, roc_auc_score
from sklearn.preprocessing import OneHotEncoder
from xgboost import XGBRegressor, XGBClassifier  # requires libomp on macOS
import psycopg


# ----------------------------
# 0) Tiny .env loader (no deps)
# ----------------------------
def load_dotenv_inline(env_path: Path):
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        k, v = line.split("=", 1)
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        # don't overwrite an already-set env var
        if os.getenv(k) is None:
            os.environ[k] = v


# Auto-load .env from ml/.env if present
load_dotenv_inline(Path(__file__).parent / ".env")

# Ensure DATABASE_URL exists
DB_URL = os.getenv("DATABASE_URL", "").strip()
if not DB_URL:
    # Try to fall back to the API .env one directory up
    api_env = Path(__file__).resolve().parents[1] / "api" / ".env"
    load_dotenv_inline(api_env)
    DB_URL = os.getenv("DATABASE_URL", "").strip()

if not DB_URL:
    raise SystemExit(
        "❌ DATABASE_URL not set. Create ml/.env with:\n"
        "DATABASE_URL=postgresql://<user>:<pass>@<host>/<db>?sslmode=require"
    )

# If no sslmode provided, add it (Render needs it)
if "sslmode=" not in DB_URL:
    sep = "&" if "?" in DB_URL else "?"
    DB_URL = f"{DB_URL}{sep}sslmode=require"
    os.environ["DATABASE_URL"] = DB_URL


# ----------------------------
# 1) SQL queries
# ----------------------------
PRICE_SQL = """
SELECT
  q.id,
  q."totalGBP" AS price,
  COALESCE(l.custom->>'projectType','') AS project_type,
  (l.custom->>'area_m2')::float AS area_m2,
  COALESCE(l.custom->>'materials_grade','') AS materials_grade,
  COALESCE(l.custom->>'source','') AS lead_source,
  'uk'::text AS region
FROM "Quote" q
LEFT JOIN "Lead" l ON l.id = q."leadId"
WHERE q."status" IN ('ACCEPTED','SENT') AND q."totalGBP" IS NOT NULL;
"""

WIN_SQL = """
SELECT
  o.id,
  (o.stage = 'WON')::int AS won,
  COALESCE(q."totalGBP", 0) AS quote_value_gbp,
  0::int AS num_emails_thread,
  0::int AS days_to_first_reply,
  COALESCE(l.custom->>'projectType','') AS project_type,
  COALESCE(l.custom->>'materials_grade','') AS materials_grade,
  (l.custom->>'area_m2')::float AS area_m2,
  COALESCE(l.custom->>'source','') AS lead_source,
  'uk'::text AS region
FROM "Opportunity" o
JOIN "Lead" l ON l.id = o."leadId"
LEFT JOIN "Quote" q ON q."leadId" = o."leadId";
"""


# ----------------------------
# 2) DB helpers
# ----------------------------
def df_from_sql(sql: str) -> pd.DataFrame:
    with psycopg.connect(DB_URL) as conn:
        return pd.read_sql_query(sql, conn)


# ----------------------------
# 3) Training: Price model
# ----------------------------
def train_price(models_dir: Path) -> dict:
    df = df_from_sql(PRICE_SQL)

    # Basic cleanliness
    df = df.dropna(subset=["price"])
    # Some installs may have area_m2 as None/NaN — fill with median
    if "area_m2" in df.columns:
        df["area_m2"] = pd.to_numeric(df["area_m2"], errors="coerce")
        if df["area_m2"].isna().all():
            df["area_m2"] = 0.0
        else:
            df["area_m2"] = df["area_m2"].fillna(df["area_m2"].median())
    else:
        df["area_m2"] = 0.0

    # Features we expect
    num_cols = ["area_m2"]
    cat_cols = ["materials_grade", "project_type", "lead_source", "region"]
    # Ensure missing categorical columns exist
    for c in cat_cols:
        if c not in df.columns:
            df[c] = ""

    features = num_cols + cat_cols
    X = df[features].copy()
    y = df["price"].astype(float)

    if len(df) < 5:
        print(f"[price] Not enough rows to train (got {len(df)}). Skipping.")
        return {"rows": len(df), "trained": False}

    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=42)

    pre = ColumnTransformer(
        transformers=[
            ("num", "passthrough", num_cols),
            ("cat", OneHotEncoder(handle_unknown="ignore"), cat_cols),
        ]
    )

    model = XGBRegressor(
        n_estimators=200,
        learning_rate=0.08,
        max_depth=5,
        subsample=0.9,
        colsample_bytree=0.9,
        random_state=42,
        n_jobs=2,
    )

    pipe = Pipeline(steps=[("pre", pre), ("model", model)])
    pipe.fit(Xtr, ytr)

    ypred = pipe.predict(Xte)
    mae = float(mean_absolute_error(yte, ypred)) if len(yte) else math.nan

    models_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipe, models_dir / "price_model.joblib")

    print(f"[price] trained on {len(df)} quotes — MAE: £{mae:,.2f}")
    return {
        "rows": len(df),
        "trained": True,
        "mae": mae,
        "features": features,
        "num_cols": num_cols,
        "cat_cols": cat_cols,
    }


# ----------------------------
# 4) Training: Win model
# ----------------------------
def train_win(models_dir: Path) -> dict:
    df = df_from_sql(WIN_SQL)

    # Ensure required columns exist and types are OK
    must_have = [
        "won",
        "quote_value_gbp",
        "num_emails_thread",
        "days_to_first_reply",
        "project_type",
        "materials_grade",
        "area_m2",
        "lead_source",
        "region",
    ]
    for c in must_have:
        if c not in df.columns:
            # create sensible defaults if missing
            df[c] = 0 if c in {"won", "quote_value_gbp", "num_emails_thread", "days_to_first_reply", "area_m2"} else ""

    df["won"] = pd.to_numeric(df["won"], errors="coerce").fillna(0).astype(int)
    df["quote_value_gbp"] = pd.to_numeric(df["quote_value_gbp"], errors="coerce").fillna(0.0)
    df["num_emails_thread"] = pd.to_numeric(df["num_emails_thread"], errors="coerce").fillna(0).astype(int)
    df["days_to_first_reply"] = pd.to_numeric(df["days_to_first_reply"], errors="coerce").fillna(0).astype(int)
    df["area_m2"] = pd.to_numeric(df["area_m2"], errors="coerce").fillna(0.0)

    # Features we’ll train with (keep aligned with API’s /predict)
    num_cols = ["area_m2", "quote_value_gbp", "num_emails_thread", "days_to_first_reply"]
    cat_cols = ["materials_grade", "project_type", "lead_source", "region"]

    # Ensure we have at least two classes
    class_counts = df["won"].value_counts()
    if len(class_counts) < 2:
        print(f"[win] Only one class present in data (counts: {class_counts.to_dict()}). Seeding or more data required.")
        return {"rows": int(len(df)), "trained": False}

    X = df[num_cols + cat_cols].copy()
    y = df["won"].astype(int)

    test_size = 0.2
    # Guard if dataset too small for stratify
    if int(len(df) * test_size) < len(class_counts):
        test_size = max(len(class_counts) / len(df), 0.34)  # widen split to fit both classes

    Xtr, Xte, ytr, yte = train_test_split(
        X, y, test_size=test_size, random_state=42, stratify=y
    )

    pre = ColumnTransformer(
        transformers=[
            ("num", "passthrough", num_cols),
            ("cat", OneHotEncoder(handle_unknown="ignore"), cat_cols),
        ]
    )

    model = XGBClassifier(
        n_estimators=250,
        learning_rate=0.08,
        max_depth=5,
        subsample=0.9,
        colsample_bytree=0.9,
        random_state=42,
        n_jobs=2,
        eval_metric="logloss",
    )

    pipe = Pipeline(steps=[("pre", pre), ("model", model)])
    pipe.fit(Xtr, ytr)

    # AUC (guard if test set tiny)
    try:
        proba = pipe.predict_proba(Xte)[:, 1]
        auc = float(roc_auc_score(yte, proba))
    except Exception:
        auc = float("nan")

    models_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipe, models_dir / "win_model.joblib")

    print(f"[win] trained on {len(df)} opportunities — ROC-AUC: {auc:.3f}")
    return {
        "rows": int(len(df)),
        "trained": True,
        "auc": auc,
        "features": num_cols + cat_cols,
        "num_cols": num_cols,
        "cat_cols": cat_cols,
    }


# ----------------------------
# 5) Orchestration
# ----------------------------
def main():
    print("Set DATABASE_URL")
    models_dir = Path(__file__).parent / "models"

    price_info = train_price(models_dir)
    win_info = train_win(models_dir)

    # Save a small meta file so the API knows expected features
    meta = {
        "price": {
            "trained": bool(price_info.get("trained")),
            "features": price_info.get("features", []),
            "num_cols": price_info.get("num_cols", []),
            "cat_cols": price_info.get("cat_cols", []),
            "mae": price_info.get("mae"),
            "rows": price_info.get("rows"),
        },
        "win": {
            "trained": bool(win_info.get("trained")),
            "features": win_info.get("features", []),
            "num_cols": win_info.get("num_cols", []),
            "cat_cols": win_info.get("cat_cols", []),
            "auc": win_info.get("auc"),
            "rows": win_info.get("rows"),
        },
    }
    (Path(__file__).parent / "models").mkdir(parents=True, exist_ok=True)
    with open(models_dir / "feature_meta.json", "w") as f:
        json.dump(meta, f, indent=2)

    print("[ok] wrote", models_dir / "feature_meta.json")
    print("Training complete.")


if __name__ == "__main__":
    main()