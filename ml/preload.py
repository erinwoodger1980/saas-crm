#!/usr/bin/env python3
"""
preload.py - Preload heavy ML modules to speed up first requests
"""
import time
import sys

def preload_modules():
    """Preload critical modules that cause slow first requests"""
    start_time = time.time()
    
    try:
        # Core scientific computing
        import numpy
        import pandas
        
        # ML libraries (heaviest imports)
        import sklearn
        import joblib
        import xgboost
        
        # PDF/OCR libraries
        import fitz  # PyMuPDF
        import pytesseract
        
        # FastAPI components we'll need
        from fastapi import FastAPI, UploadFile
        import uvicorn
        
        load_time = time.time() - start_time
        print(f"✅ Preloaded ML modules in {load_time:.2f}s")
        return True
        
    except ImportError as e:
        print(f"❌ Failed to preload modules: {e}")
        return False

if __name__ == "__main__":
    success = preload_modules()
    sys.exit(0 if success else 1)