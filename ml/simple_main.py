# ml/simple_main.py - Production ML service for Quote Builder
from __future__ import annotations
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any
import traceback, urllib.request

from pdf_parser import extract_text_from_pdf_bytes, parse_totals_from_text

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

def _http_get_bytes(url: str) -> bytes:
    """Download bytes from URL"""
    with urllib.request.urlopen(url) as resp:
        return resp.read()

@app.get("/")
async def root():
    return {"message": "JoineryAI ML API"}

@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": "2025-10-31T21:00:00Z"}

@app.post("/parse-quote")
async def parse_quote(req: Request):
    """
    Body: { url: string, filename?: string, quotedAt?: string }
    Downloads a single PDF, extracts text, and heuristically detects totals and line items.
    """
    body = await req.json()
    url = body.get("url")
    if not url or not isinstance(url, str):
        raise HTTPException(status_code=422, detail="missing url")

    filename = body.get("filename") or "attachment.pdf"
    quoted_at = body.get("quotedAt")

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

@app.post("/debug-parse")
async def debug_parse(req: Request):
    """
    Debug endpoint to see extracted text and parsing results
    """
    try:
        body = await req.json()
        url = body.get("url")
        if not url:
            raise HTTPException(status_code=422, detail="missing url")

        # Download PDF
        pdf_bytes = _http_get_bytes(url)
        
        # Extract text from PDF
        text = extract_text_from_pdf_bytes(pdf_bytes) or ""
        
        # Try to parse
        try:
            parsed = parse_totals_from_text(text) if text else {}
        except Exception as e:
            parsed = {"error": str(e)}
        
        return {
            "ok": True,
            "extracted_text": text[:2000] + "..." if len(text) > 2000 else text,
            "text_length": len(text),
            "parsed": parsed,
        }
        
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error in debug parsing: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)