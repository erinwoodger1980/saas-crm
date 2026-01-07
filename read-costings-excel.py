#!/usr/bin/env python3
import pandas as pd
import json
import sys
from pathlib import Path

# Path to the Excel file
file_path = Path.home() / 'Desktop' / 'Costings for Copilot.xls'

print(f"📂 Reading file: {file_path}\n")

if not file_path.exists():
    print("❌ File not found!")
    sys.exit(1)

# Read all sheets
excel_file = pd.ExcelFile(file_path)

print(f"📊 Workbook contains {len(excel_file.sheet_names)} sheet(s):\n")
for i, name in enumerate(excel_file.sheet_names, 1):
    print(f"  {i}. {name}")

print('\n' + '=' * 80 + '\n')

# Process each sheet
all_data = {}

for sheet_name in excel_file.sheet_names:
    print(f"\n{'=' * 80}")
    print(f"📄 SHEET: {sheet_name}")
    print('=' * 80 + '\n')
    
    # Read the sheet
    df = pd.read_excel(file_path, sheet_name=sheet_name)
    
    print(f"📏 Dimensions: {df.shape[0]} rows × {df.shape[1]} columns\n")
    
    # Show columns
    print("📋 Columns:")
    for i, col in enumerate(df.columns, 1):
        print(f"  {i}. {col}")
    
    print(f"\n📊 First 20 rows:\n")
    print(df.head(20).to_string())
    
    print(f"\n\n")
    
    # Store for JSON export
    all_data[sheet_name] = df.to_dict(orient='records')

# Save as JSON
output_path = Path.cwd() / 'costings-data.json'
with open(output_path, 'w') as f:
    json.dump(all_data, f, indent=2, default=str)

print(f"\n✅ Full data saved to: {output_path}")
print(f"\n📊 Summary:")
for sheet_name, data in all_data.items():
    print(f"  {sheet_name}: {len(data)} rows")
