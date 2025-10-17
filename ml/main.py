from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib, numpy as np, json, os

app = FastAPI(title="JoineryAI ML API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://joineryai.app", "https://www.joineryai.app", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load models
PRICE_PATH = "models/price_model.joblib"
WIN_PATH   = "models/win_model.joblib"
META_PATH  = "models/feature_meta.json"

price_model = joblib.load(PRICE_PATH) if os.path.exists(PRICE_PATH) else None
win_model   = joblib.load(WIN_PATH)   if os.path.exists(WIN_PATH)   else None
feature_meta = json.load(open(META_PATH)) if os.path.exists(META_PATH) else {}

class QuoteIn(BaseModel):
    area_m2: float
    materials_grade: str
    project_type: str
    region: str = "uk"

@app.get("/")
def root():
    return {"ok": True, "models": {"price": bool(price_model), "win": bool(win_model)}}

@app.post("/predict")
def predict(q: QuoteIn):
    if not price_model or not win_model:
        return {"error": "models not loaded"}
    X = np.array([[q.area_m2, {"Basic":1,"Standard":2,"Premium":3}.get(q.materials_grade,1)]])
    price = float(price_model.predict(X)[0])
    win_prob = float(win_model.predict_proba(X)[0][1])
    return {"predicted_price": round(price,2), "win_probability": round(win_prob,3)}
