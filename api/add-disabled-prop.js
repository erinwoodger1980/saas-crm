#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../web/src/app/fire-door-schedule/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Find the renderCell function and add disabled prop
const replacements = [
  // Date inputs
  {
    search: /(<input\s+type="date"\s+className="[^"]+"\s+value=)/g,
    replace: '$1disabled={isCustomerPortal}\n          '
  },
  // Number inputs  
  {
    search: /(<input\s+type="number"\s+min=)/g,
    replace: '<input\n          disabled={isCustomerPortal}\n          type="number"\n          min='
  },
  // Checkbox inputs
  {
    search: /(<input\s+type="checkbox"\s+checked=)/g,
    replace: '<input\n          disabled={isCustomerPortal}\n          type="checkbox"\n          checked='
  },
  // Select elements - job location
  {
    search: /(<select\s+value=\{value \|\| ''\}\s+onChange=\{[^}]+\}\s+className="text-\[11px\] font-medium)/g,
    replace: '<select\n          disabled={isCustomerPortal}\n          value={value || \'\'}\n          onChange={$1'
  },
  // Select elements - general
  {
    search: /(<select\s+value=\{value \|\| ''\}\s+onChange=)/g,
    replace: '<select\n          disabled={isCustomerPortal}\n          value={value || \'\'}\n          onChange='
  },
  // Textarea elements
  {
    search: /(<textarea\s+className="bg-transparent)/g,
    replace: '<textarea\n          disabled={isCustomerPortal}\n          className="bg-transparent'
  },
  // Default text inputs
  {
    search: /(return \(\s+<input\s+className="bg-transparent outline-none w-full text-sm font-semibold")/g,
    replace: 'return (\n      <input\n        disabled={isCustomerPortal}\n        className="bg-transparent outline-none w-full text-sm font-semibold"'
  }
];

console.log('Adding disabled prop to all editable fields...');

for (const { search, replace } of replacements) {
  const matches = content.match(search);
  if (matches) {
    console.log(`Found ${matches.length} matches for pattern`);
    content = content.replace(search, replace);
  }
}

fs.writeFileSync(filePath, content);
console.log('✓ Done! File updated.');
