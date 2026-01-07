const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Path to the Excel file
const filePath = path.join(process.env.HOME, 'Desktop', 'Costings for Copilot.xls');

console.log(`📂 Reading file: ${filePath}\n`);

// Check if file exists
if (!fs.existsSync(filePath)) {
  console.error('❌ File not found!');
  process.exit(1);
}

// Read the workbook
const workbook = XLSX.readFile(filePath);

console.log(`📊 Workbook contains ${workbook.SheetNames.length} sheet(s):\n`);
workbook.SheetNames.forEach((name, i) => {
  console.log(`  ${i + 1}. ${name}`);
});

console.log('\n' + '='.repeat(80) + '\n');

// Process each sheet
workbook.SheetNames.forEach((sheetName) => {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📄 SHEET: ${sheetName}`);
  console.log('='.repeat(80) + '\n');
  
  const worksheet = workbook.Sheets[sheetName];
  
  // Get the range of the worksheet
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  console.log(`📏 Range: ${worksheet['!ref']} (${range.e.r + 1} rows × ${range.e.c + 1} columns)\n`);
  
  // Convert to JSON for easier reading
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
    header: 1,
    defval: '',
    raw: false 
  });
  
  // Display first 50 rows
  const maxRows = Math.min(50, jsonData.length);
  console.log(`Showing first ${maxRows} rows:\n`);
  
  jsonData.slice(0, maxRows).forEach((row, i) => {
    // Filter out empty cells at the end
    const nonEmptyCells = [];
    for (let j = 0; j < row.length; j++) {
      if (row[j] !== '' || nonEmptyCells.length > 0) {
        nonEmptyCells.push(row[j]);
      }
    }
    
    if (nonEmptyCells.length > 0) {
      console.log(`Row ${i + 1}:`);
      nonEmptyCells.forEach((cell, j) => {
        const colLetter = XLSX.utils.encode_col(j);
        if (cell !== '') {
          console.log(`  ${colLetter}: ${cell}`);
        }
      });
      console.log('');
    }
  });
  
  if (jsonData.length > maxRows) {
    console.log(`... and ${jsonData.length - maxRows} more rows\n`);
  }
  
  // Also show as table format (if not too wide)
  const headers = jsonData[0] || [];
  if (headers.length <= 10 && headers.length > 0) {
    console.log('\n' + '-'.repeat(80));
    console.log('TABLE VIEW (first 20 rows):');
    console.log('-'.repeat(80) + '\n');
    
    const tableData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    console.table(tableData.slice(0, 20));
  }
});

// Also save as JSON for further analysis
const outputPath = path.join(process.cwd(), 'costings-data.json');
const allData = {};

workbook.SheetNames.forEach((sheetName) => {
  const worksheet = workbook.Sheets[sheetName];
  allData[sheetName] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
});

fs.writeFileSync(outputPath, JSON.stringify(allData, null, 2));
console.log(`\n✅ Full data saved to: ${outputPath}`);
console.log(`\n📊 Summary:`);
workbook.SheetNames.forEach((sheetName) => {
  console.log(`  ${sheetName}: ${allData[sheetName].length} rows`);
});
