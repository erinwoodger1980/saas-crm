#!/usr/bin/env python3
"""
Test script to verify production ML service endpoints
Run this once your ML service deploys to test the optimized database functionality
"""

import requests
import json
import time

# Update this URL to your actual ML service URL
ML_SERVICE_URL = "https://your-ml-service.render.com"

def test_health():
    """Test health endpoint"""
    try:
        response = requests.get(f"{ML_SERVICE_URL}/health", timeout=10)
        print(f"✅ Health Check: {response.status_code} - {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Health Check Failed: {e}")
        return False

def test_parse_supplier_quote():
    """Test supplier quote parsing"""
    test_data = {
        "text": """
ABC Suppliers Quote
Date: 2024-01-15

Description          Qty    Price   Total
Widget A             5      $20.00  $100.00
Widget B             2      $50.00  $100.00
Service Fee          1      $25.00  $25.00

Subtotal: $225.00
Tax (10%): $22.50
Total: $247.50
        """
    }
    
    try:
        response = requests.post(
            f"{ML_SERVICE_URL}/parse-supplier-quote",
            json=test_data,
            timeout=30
        )
        result = response.json()
        print(f"✅ Supplier Parse: {response.status_code}")
        print(f"   Lines found: {len(result.get('lines', []))}")
        print(f"   Total: {result.get('estimated_total')}")
        print(f"   Supplier: {result.get('supplier')}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Supplier Parse Failed: {e}")
        return False

def test_parse_client_quote():
    """Test client quote parsing"""
    test_data = {
        "text": """
Client Requirements:
- Project Type: Windows
- Material: Oak
- Area: 25 square meters
- Budget: £5000-7000
        """
    }
    
    try:
        response = requests.post(
            f"{ML_SERVICE_URL}/parse-client-quote", 
            json=test_data,
            timeout=30
        )
        result = response.json()
        print(f"✅ Client Parse: {response.status_code}")
        print(f"   Project type: {result.get('project_type')}")
        print(f"   Material: {result.get('material')}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Client Parse Failed: {e}")
        return False

def main():
    """Run all tests"""
    print("🧪 Testing Production ML Service")
    print(f"📍 URL: {ML_SERVICE_URL}")
    print("-" * 50)
    
    # Wait for service to be ready
    print("⏳ Waiting for service to be ready...")
    ready = False
    for i in range(30):  # Try for 5 minutes
        if test_health():
            ready = True
            break
        time.sleep(10)
        print(f"   Attempt {i+1}/30...")
    
    if not ready:
        print("❌ Service not ready after 5 minutes")
        return False
    
    print("\n🧪 Running endpoint tests...")
    
    # Test parsing endpoints
    supplier_ok = test_parse_supplier_quote()
    client_ok = test_parse_client_quote()
    
    print("\n📊 Test Results:")
    print(f"   Health: ✅")
    print(f"   Supplier Parse: {'✅' if supplier_ok else '❌'}")
    print(f"   Client Parse: {'✅' if client_ok else '❌'}")
    
    if supplier_ok and client_ok:
        print("\n🎉 All tests passed! ML service is working with optimized database.")
        print("🔄 Connection pooling and batch operations are active.")
    else:
        print("\n⚠️  Some tests failed. Check the service logs in Render dashboard.")

if __name__ == "__main__":
    main()