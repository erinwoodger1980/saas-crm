# ml/test_main.py - Simplified version without database for testing
from __future__ import annotations
from fastapi import FastAPI, Request, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import joblib, pandas as pd, numpy as np
import json, os, traceback, urllib.request, datetime

from pdf_parser import extract_text_from_pdf_bytes, parse_totals_from_text, parse_client_quote_from_text, determine_quote_type, parse_quote_lines_from_text

app = FastAPI(title="JoineryAI ML API (Test)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data models
class LineItem(BaseModel):
    name: str
    quantity: float
    rate: float
    amount: float

class ParsedQuote(BaseModel):
    lines: List[LineItem]
    total: float
    success: bool

class QuoteAnalysis(BaseModel):
    project_type: Optional[str] = None
    area_m2: Optional[float] = None
    materials_grade: Optional[str] = None
    quoted_price: Optional[float] = None
    confidence: float = 0.0

# Basic endpoints for testing
@app.get("/")
async def root():
    return {"message": "JoineryAI ML API is running!"}

@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.datetime.now().isoformat()}

@app.post("/parse-supplier-quote", response_model=ParsedQuote)
async def parse_supplier_quote(file: UploadFile = File(...)):
    """Parse a supplier quote PDF and extract line items"""
    try:
        pdf_bytes = await file.read()
        
        # Extract text from PDF
        text = extract_text_from_pdf_bytes(pdf_bytes)
        if not text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from PDF")
        
        # Determine quote type
        quote_type = determine_quote_type(text)
        
        if quote_type != 'supplier':
            raise HTTPException(status_code=400, detail="This appears to be a client quote, not a supplier quote")
        
        # Parse line items
        lines = parse_quote_lines_from_text(text)
        
        # Parse total
        total = parse_totals_from_text(text)
        
        return ParsedQuote(
            lines=[LineItem(**line) for line in lines],
            total=total,
            success=True
        )
        
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error parsing quote: {str(e)}")

@app.post("/debug-parse")
async def debug_parse(file: UploadFile = File(...)):
    """Debug endpoint to see extracted text and parsing results"""
    try:
        pdf_bytes = await file.read()
        
        # Extract text from PDF
        text = extract_text_from_pdf_bytes(pdf_bytes)
        
        # Determine quote type
        quote_type = determine_quote_type(text)
        
        # Try to parse line items
        try:
            lines = parse_quote_lines_from_text(text)
        except Exception as e:
            lines = []
        
        # Try to parse total
        try:
            total = parse_totals_from_text(text)
        except Exception as e:
            total = 0.0
        
        return {
            "extracted_text": text[:2000] + "..." if len(text) > 2000 else text,
            "quote_type": quote_type,
            "parsed_lines": lines,
            "parsed_total": total,
            "text_length": len(text)
        }
        
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error in debug parsing: {str(e)}")

@app.post("/analyze-client-quote", response_model=QuoteAnalysis)
async def analyze_client_quote(file: UploadFile = File(...)):
    """Analyze a client quote for ML training data"""
    try:
        pdf_bytes = await file.read()
        
        # Extract text from PDF
        text = extract_text_from_pdf_bytes(pdf_bytes)
        if not text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from PDF")
        
        # Determine quote type
        quote_type = determine_quote_type(text)
        
        if quote_type != 'client':
            raise HTTPException(status_code=400, detail="This appears to be a supplier quote, not a client quote")
        
        # Parse client quote data
        quote_data = parse_client_quote_from_text(text)
        
        return QuoteAnalysis(**quote_data)
        
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error analyzing quote: {str(e)}")

# Simplified email training endpoints (without database)
class EmailTrainingRequest(BaseModel):
    tenantId: str
    emailProvider: str
    daysBack: int = 30
    credentials: Dict[str, Any]

@app.post("/preview-email-quotes")
async def preview_email_quotes(request: EmailTrainingRequest):
    """Preview quotes found in email (mock for testing)"""
    return {
        "ok": True,
        "total_quotes_found": 5,
        "preview_quotes": [
            {
                "subject": "Quote for Kitchen Renovation",
                "date_sent": "2024-01-15T10:30:00Z",
                "attachment_name": "kitchen_quote.pdf",
                "project_type": "Kitchen",
                "quoted_price": 15000,
                "area_m2": 20.5,
                "materials_grade": "Premium",
                "confidence": 0.85
            },
            {
                "subject": "Bathroom Refurbishment Quote",
                "date_sent": "2024-01-20T14:15:00Z",
                "attachment_name": "bathroom_quote.pdf",
                "project_type": "Bathroom",
                "quoted_price": 8500,
                "area_m2": 12.0,
                "materials_grade": "Standard",
                "confidence": 0.92
            }
        ]
    }

@app.post("/start-email-training")
async def start_email_training(request: EmailTrainingRequest):
    """Start email training workflow (mock for testing)"""
    return {
        "ok": True,
        "results": {
            "quotes_found": 5,
            "training_records_saved": 5,
            "ml_training_completed": True,
            "duration_seconds": 12.5,
            "errors": []
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)