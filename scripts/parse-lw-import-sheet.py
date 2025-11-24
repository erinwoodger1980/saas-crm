#!/usr/bin/env python3
"""
Parse Lloyd Worrall Import Sheet CSV
Extract all column headers and generate field mapping for Prisma models
"""

import csv
import json
import re

def to_camel_case(text):
    """Convert text to camelCase for field names"""
    # Remove special characters and split
    text = re.sub(r'[^\w\s/-]', '', text)
    words = re.split(r'[\s/_-]+', text.strip())
    
    # First word lowercase, rest capitalized
    if not words:
        return text.lower()
    
    result = words[0].lower()
    for word in words[1:]:
        if word:
            result += word.capitalize()
    
    return result

def infer_type(header):
    """Infer Prisma field type from column header"""
    lower = header.lower()
    
    # Numeric fields
    if any(word in lower for word in ['width', 'height', 'depth', 'thickness', 'size', 'quantity']):
        if 'quantity' in lower:
            return 'Int'
        return 'Decimal'  # Measurements can be fractional
    
    # Boolean fields  
    if any(word in lower for word in ['required', 'prep', 'protection']):
        return 'Boolean'
    
    # Enum-like fields (limited options)
    if any(word in lower for word in ['type', 'rating', 'material', 'finish', 'configuration', 
                                       'action', 'handing', 'position', 'side', 'supply']):
        return 'String  // Consider enum'
    
    # Default to String
    return 'String'

def parse_csv(file_path):
    """Parse CSV and extract structure"""
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        headers = next(reader)
        
        # Get sample data (first non-empty row)
        sample_row = None
        for row in reader:
            if any(row):  # If row has any non-empty values
                sample_row = row
                break
    
    return headers, sample_row

def main():
    csv_path = '/Users/Erin/saas-crm/docs/LAJ & Lloyd Worrall Import Sheet (Master).csv'
    
    headers, sample = parse_csv(csv_path)
    
    print(f"Found {len(headers)} columns\n")
    print("="*80)
    print("COLUMN MAPPING")
    print("="*80)
    
    field_mappings = []
    
    for i, header in enumerate(headers):
        if not header.strip():
            continue
            
        field_name = to_camel_case(header)
        field_type = infer_type(header)
        
        mapping = {
            'csvHeader': header,
            'fieldName': field_name,
            'prismaType': field_type,
            'columnIndex': i
        }
        
        field_mappings.append(mapping)
        
        print(f"\n{i+1}. CSV: \"{header}\"")
        print(f"   Field: {field_name}")
        print(f"   Type: {field_type}")
    
    print("\n" + "="*80)
    print("PRISMA MODEL FIELDS")
    print("="*80)
    print()
    
    for mapping in field_mappings:
        field_name = mapping['fieldName']
        field_type = mapping['prismaType'].split()[0]  # Remove comments
        nullable = '?' if 'enum' not in mapping['prismaType'].lower() else '?'
        
        print(f"  {field_name:<40} {field_type}{nullable}")
    
    # Save to JSON
    output_path = '/Users/Erin/saas-crm/docs/lw-import-sheet-mapping.json'
    with open(output_path, 'w') as f:
        json.dump({
            'totalColumns': len(field_mappings),
            'fieldMappings': field_mappings
        }, f, indent=2)
    
    print(f"\n\nMapping saved to: {output_path}")
    print(f"\nTotal fields to implement: {len(field_mappings)}")

if __name__ == '__main__':
    main()
