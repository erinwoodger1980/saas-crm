#!/usr/bin/env python3
"""
Run training on sample supplier PDFs.
This script processes local PDFs using the ML service's classification and parsing.
"""
import sys
import os
from pathlib import Path
import requests
import json
from flask import Flask
from http.server import HTTPServer, SimpleHTTPRequestHandler
import threading
import time

# PDF files to train on
SAMPLE_PDFS = [
    "/Users/Erin/Desktop/51105-01NB1 Wealden Joinery - Ascott polo mansion (hardwood).pdf",
    "/Users/Erin/Desktop/51105-01NB Wealden Joinery - Ascott polo mansion (softwood).pdf",
    "/Users/Erin/Desktop/15.10.25 Woodger - Woodleys.pdf",
    "/Users/Erin/Desktop/Joinery ai example supplier quote.pdf",
]

ML_URL = os.getenv("ML_URL", "http://localhost:8000")
TENANT_ID = "demo"

def serve_file_locally(filepath: str, port: int = 9999) -> str:
    """
    Serve a file via HTTP so ML service can download it.
    Returns the URL.
    """
    from http.server import SimpleHTTPRequestHandler
    import socketserver
    import threading
    
    # Create a simple HTTP handler that serves the file
    directory = os.path.dirname(filepath)
    filename = os.path.basename(filepath)
    
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=directory, **kwargs)
    
    # Start server in background thread
    server = socketserver.TCPServer(("", port), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    
    return f"http://localhost:{port}/{filename}"

def process_pdf(pdf_path: str, use_local_server: bool = True) -> dict:
    """Process a single PDF through the ML classification and parsing."""
    if not os.path.exists(pdf_path):
        return {"error": "file_not_found", "path": pdf_path}
    
    print(f"📄 Processing: {os.path.basename(pdf_path)}")
    
    try:
        # Serve file locally and get URL
        if use_local_server:
            url = serve_file_locally(pdf_path)
            time.sleep(0.5)  # Give server time to start
            
            payload = {
                "url": url,
                "filename": os.path.basename(pdf_path),
                "markupPercent": 20,
                "vatPercent": 20,
                "markupDelivery": False,
                "amalgamateDelivery": True,
            }
            
            response = requests.post(
                f"{ML_URL}/process-quote",
                json=payload,
                timeout=30,
            )
        else:
            # Direct PDF bytes approach
            with open(pdf_path, "rb") as f:
                pdf_bytes = f.read()
            
            # Call parse-quote instead
            response = requests.post(
                f"{ML_URL}/parse-quote",
                json={"url": f"file://{pdf_path}", "filename": os.path.basename(pdf_path)},
                timeout=30,
            )
        
        if response.status_code == 200:
            result = response.json()
            quote_type = result.get('quote_type', result.get('type', 'unknown'))
            print(f"  ✅ Type: {quote_type}")
            
            if result.get('quote_type') == 'supplier':
                client_quote = result.get('client_quote', {})
                grand_total = client_quote.get('grand_total', 0)
                line_count = len(client_quote.get('lines', []))
                print(f"  💰 Grand total: £{grand_total:.2f} ({line_count} lines)")
            
            return {"ok": True, "result": result}
        else:
            print(f"  ❌ Error {response.status_code}: {response.text[:200]}")
            return {"error": "processing_failed", "status": response.status_code, "detail": response.text[:500]}
    
    except Exception as e:
        print(f"  ❌ Exception: {str(e)}")
        return {"error": "exception", "detail": str(e)}

def prepare_training_items() -> list:
    """Prepare training items from processed PDFs."""
    items = []
    
    for pdf_path in SAMPLE_PDFS:
        if not os.path.exists(pdf_path):
            print(f"⚠️  Skipping missing file: {pdf_path}")
            continue
        
        # For training, we just need URLs. Since these are local files,
        # we'll create file:// URLs or upload them
        filename = os.path.basename(pdf_path)
        
        # For now, we'll use file:// protocol (ML service needs to support this or we upload)
        item = {
            "url": f"file://{pdf_path}",
            "filename": filename,
            "quotedAt": None,
            "sourceType": "supplier_quote",
        }
        items.append(item)
    
    return items

def train_model():
    """Train the supplier estimator model."""
    print("\n🎓 Starting training process...\n")
    
    # First, process each PDF to verify they work
    processed = []
    for pdf_path in SAMPLE_PDFS:
        result = process_pdf(pdf_path)
        processed.append(result)
    
    print(f"\n📊 Processed {len(processed)} PDFs")
    successful = sum(1 for r in processed if r.get('ok'))
    print(f"  ✅ Successful: {successful}")
    print(f"  ❌ Failed: {len(processed) - successful}")
    
    # Now prepare training items
    training_items = prepare_training_items()
    
    print(f"\n🔧 Training with {len(training_items)} items...")
    
    payload = {
        "tenantId": TENANT_ID,
        "model": "supplier_estimator",
        "items": training_items,
    }
    
    try:
        response = requests.post(
            f"{ML_URL}/train",
            json=payload,
            timeout=120,  # 2 minutes for training
        )
        
        if response.status_code == 200:
            result = response.json()
            print("\n✅ Training completed successfully!")
            print(f"  📊 Dataset: {result.get('datasetHash', 'unknown')[:12]}...")
            
            metrics = result.get('metrics', {})
            if metrics:
                print(f"  📈 Metrics:")
                for key, value in metrics.items():
                    if isinstance(value, float):
                        print(f"    • {key}: {value:.4f}")
                    else:
                        print(f"    • {key}: {value}")
            
            return {"ok": True, "result": result}
        else:
            print(f"\n❌ Training failed: {response.status_code}")
            print(f"  {response.text[:500]}")
            return {"error": "training_failed", "status": response.status_code}
    
    except Exception as e:
        print(f"\n❌ Training exception: {str(e)}")
        return {"error": "exception", "detail": str(e)}

if __name__ == "__main__":
    print("=" * 60)
    print("🤖 Supplier Estimator Training")
    print("=" * 60)
    print(f"ML Service: {ML_URL}")
    print(f"Tenant ID: {TENANT_ID}")
    print(f"Sample PDFs: {len(SAMPLE_PDFS)}")
    print("=" * 60)
    
    result = train_model()
    
    print("\n" + "=" * 60)
    if result.get('ok'):
        print("✅ Training session completed")
        sys.exit(0)
    else:
        print("❌ Training session failed")
        sys.exit(1)
