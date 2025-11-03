#!/usr/bin/env node

// Simple CSV parser for joinery leads
// Usage: node parse-csv.js your-file.csv

const fs = require('fs');
const path = require('path');

function parseCSV(csvText) {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  
  // Parse headers
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  
  // Parse rows
  const rows = lines.slice(1).map(line => {
    const cells = [];
    let currentCell = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        cells.push(currentCell.trim());
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    cells.push(currentCell.trim()); // Don't forget the last cell
    return cells;
  });
  
  return { headers, rows };
}

function mapToJoineryFields(headers, rows) {
  // Joinery-specific field mapping
  const fieldMapping = {
    'contact name': 'Contact Name',
    'name': 'Contact Name', 
    'email': 'Email',
    'phone': 'Phone',
    'company': 'Company',
    'project type': 'Project Type (Doors/Windows)',
    'property type': 'Property Type',
    'material preference': 'Material',
    'material': 'Material', 
    'budget range': 'Budget',
    'budget': 'Budget',
    'timeline': 'Timeline',
    'installation required': 'Installation',
    'description': 'Description',
    'project description': 'Description'
  };
  
  console.log('\n🏗️  JOINERY LEADS ANALYSIS');
  console.log('=' .repeat(50));
  console.log(`📊 Total Records: ${rows.length}`);
  console.log(`📋 Columns Found: ${headers.length}`);
  console.log('\n📂 COLUMN MAPPING:');
  
  headers.forEach((header, index) => {
    const normalized = header.toLowerCase();
    const mapped = fieldMapping[normalized] || header;
    console.log(`${index + 1}. "${header}" → ${mapped}`);
  });
  
  console.log('\n📋 SAMPLE DATA (First 3 records):');
  console.log('-'.repeat(80));
  
  rows.slice(0, 3).forEach((row, index) => {
    console.log(`\n📄 Record ${index + 1}:`);
    headers.forEach((header, colIndex) => {
      const value = row[colIndex] || '';
      if (value) {
        console.log(`  • ${header}: ${value}`);
      }
    });
  });
  
  console.log('\n🎯 JOINERY PROJECT SUMMARY:');
  console.log('-'.repeat(40));
  
  // Analyze project types
  const projectTypeIndex = headers.findIndex(h => 
    h.toLowerCase().includes('project') && h.toLowerCase().includes('type')
  );
  if (projectTypeIndex >= 0) {
    const projectTypes = {};
    rows.forEach(row => {
      const type = row[projectTypeIndex];
      if (type) projectTypes[type] = (projectTypes[type] || 0) + 1;
    });
    console.log('📊 Project Types:');
    Object.entries(projectTypes).forEach(([type, count]) => {
      console.log(`  • ${type}: ${count} leads`);
    });
  }
  
  // Analyze budget ranges
  const budgetIndex = headers.findIndex(h => 
    h.toLowerCase().includes('budget')
  );
  if (budgetIndex >= 0) {
    const budgets = {};
    rows.forEach(row => {
      const budget = row[budgetIndex];
      if (budget) budgets[budget] = (budgets[budget] || 0) + 1;
    });
    console.log('\n💰 Budget Ranges:');
    Object.entries(budgets).forEach(([budget, count]) => {
      console.log(`  • ${budget}: ${count} leads`);
    });
  }
  
  console.log('\n✅ Ready for manual import into JoineryAI!');
  console.log('💡 Tip: Copy the data above to manually create leads in your CRM');
}

// Main execution
const filename = process.argv[2];
if (!filename) {
  console.log('Usage: node parse-csv.js your-file.csv');
  process.exit(1);
}

try {
  const csvContent = fs.readFileSync(filename, 'utf8');
  const { headers, rows } = parseCSV(csvContent);
  mapToJoineryFields(headers, rows);
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}