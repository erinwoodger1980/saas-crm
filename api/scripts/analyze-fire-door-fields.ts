// Script to analyze Test Import CSV and generate comprehensive schema
// Run this to see all 200+ columns that need to be added

const csvColumns = [
  // From Test Import.csv header - ALL columns
  "Item", "Name", "Code", "Type", "Height", "Width", "Depth", "Material", "CNC Program", "Quantity", "Value", 
  "Cost of Labour", "Cost of Materials", "Internal Colour", "External Colour", "Hinges", "Sequence", "Batch / Phase", 
  "Door Ref", "Location", "Doorset / Leaf / Frame", "Type", "Quantity", "Fire Rating", "Acoustic Rating dB", 
  "Bottom Seal Requirement", "Bottom Seal Type", "Lead Lining Code", "Number of Leaves (inc solid overpanels)", 
  "Leaf Configuration", "If Split, Master Leaf Size", "Action", "Handing", "Hinge Supply Type", "Hinge Qty", 
  "Hinge Type", "Hinge Configuration", "Lock Prep", "Lock Supply Type", "Lock Type 1", "Lock Height to Spindle (FFL)", 
  "Lock Type 2", "Lock 2 Height to Spindle (FFL)", "Levers & Pull Handles", "Escutcheons / Bathroom Turn", 
  "Cylinders - Lock 1", "Cylinders - Lock 2", "Finger Plates", "Kick Plates", "Kick Plate Position", "Bump Plate", 
  "Fire Signage", "Additional Signage", "Letter Plate", "Letter Plate Position", "Door Viewer", "Door Viewer Position", 
  "Door Viewer hole Prep Size", "Door Chain", "Spindle Face Prep", "Cylinder Face Prep", "Flush Bolt Supply/Prep", 
  "Flush Bolt Qty", "Finger Protection", "Fire ID Disc", "Factory Fit Hinges", "Factory Fit Locks", 
  "Factory Fit Flush Bolts", "Ironmongery Pack Ref", "Comments", "Closers / Floor Springs", 
  "Anti Barricade / Emergency Stops", "Wiring Prep", "Free Issue Cable Loop", "Addition 1 / Note 1", 
  "Addition 1 Qty", "Addition 2 / Note 2", "Addition 2 Qty", "Addition 3 / Note 3", "Addition 3 Qty", 
  "S/O Width", "S/O Height", "S/O Wall Thickness", "Extension Material", "Extension Lining Width (Visible size)", 
  "Extension Lining Width (Actual size inc lip)", "Overpanel Details", "Screen Details", "Fanlight / Overpanel Qty", 
  "Fanlight / Overpanel Height", "Fanlight / Overpanel Width", "Number of Sidelight 1", "Sidelight 1 Width", 
  "Sidelight 1 Height", "Number of Sidelight 2", "Sidelight 2 Width", "Sidelight 2 Height", "Number of Sidelight 3", 
  "Sidelight 3 Width", "Sidelight 3 Height", "Number of Sidelight 4", "Sidelight 4 Width", "Sidelight 4 Height", 
  "Fanlight/Sidelight Glazing", "O/F Width (doorset)", "O/F Height (doorset)", "Frame Thickness", "Frame Material", 
  "Lining Thickness - Jambs", "Jamb Profile", "Lining Thickness - Heads", "Frame Finish", "Frame Type", 
  "Stop Material", "Rebate / Stop Width", "Rebate / Stop Depth", "Arc Material", "Arc Detail", "Arc Width", 
  "Arc Depth", "M Leaf Width", "S Leaf Width", "Leaf Height", "Leaf Thickness", "Core Type", "Leaf Style", 
  "Vision Panel Qty, Leaf 1", "Leaf 1 Aperture 1 Width (See Size Detail)", "Leaf 1 Aperture 1 Height (See Size Detail)", 
  "Aperture Position 1", "Leaf 1 Aperture 2 Width (See Size Detail)", "Leaf 1 Aperture 2 Height (See Size Detail)", 
  "Aperture Position 2", "Air Transfer Grille Requirement", "Air Transfer Grille Qty", "Air Transfer Grille Size", 
  "Air Transfer Grille Position", "Vision Panel Qty, Leaf 2", "Leaf 2 Cut Out Aperture 1 Width", 
  "Leaf 2 Cut Out Aperture 1 Height", "Leaf 2 Cut Out Aperture 2 Width", "Leaf 2 Cut Out Aperture 2 Height", 
  "Vision Panel Size Detail", "Temp Glass Check", "Glass Type", "Bead Type", "Bead Material", 
  "Total Glazed Area Master Leaf (msq)", "Glazing Tape", "Max Permitted Glazed Area (Based on Strebord)", 
  "Door Facing", "Door Finish - Side 1 (Push)", "Door Finish - Side 2 (Pull)", "Door Colour", "Lipping Material", 
  "Lipping Style", "Lipping Thickness", "Lipping Finish", "Door Edge Protection Type", "Door Edge Protection Position", 
  "PVC Face Protection", "PVC Colour", "Door Undercut", "Certification", "Q Mark Plug Outer Colour", 
  "Q Mark Tree Colour", "Q Mark Vision Panel Plug", "Material Sustainability", "Door Ref7", "Price Ea", "Qty2", 
  "Line Price", "Important notes for Fire Rating", "LAJ Check", "Fire Rating2", "Latched/Unlatched", 
  "Single Action / Double Action", "Single Door / Double Door", "Door Leaf Type", "Wizardoorer Ref (If used)", 
  "Leaf Concat", "Test Certificate Used", "Associated Document", "Master Leaf Area", "Slave Leaf Area", 
  "Leaf Weight Code", "Leaf Weight msq", "Master Leaf Weight (Approx) kg", "Slave Leaf Weight (Approx) kg", 
  "Lining Volume", "Lining Material", "Lining Material Weight msq", "Lining Weight (Approx) kg", "Stop Volume", 
  "Stop Material2", "Stop Material Density", "Stop Weight (Approx) kg", "Arc Volume", "Arc Material3", 
  "Arc Material Density", "Arc Weight (Approx) kg", "Fanlight", "Screen", "Frame Weight (Approx) kg", 
  "Doorset Weight (Approx) kg - Ironmongery not allowed for", "Master Leaf Width", "Master Leaf Height", 
  "Slave Leaf Width", "Core Thickness", "Core Size Checked with Certification", 
  "Intumescent Seal Used (assume STS if NOT stated", "Is Ironmongery Intumescent Required??", 
  "Ironmongery Intumescent Protection (Where Required) IGNORE***TRIAL ONLY***", "Core Type Confirmation", 
  "Core Width", "Core Height", "Core Thickness2", "Core Code", "Price Per Core", "Number Of Cores", 
  "Total Core Price"
  // ... continues with pricing/calculation columns
];

// Convert to camelCase field names
function toCamelCase(str: string): string {
  return str
    .replace(/[^\w\s]/g, '') // Remove special chars
    .replace(/\s+(.)/g, (_, c) => c.toUpperCase()) // Capitalize after space
    .replace(/^(.)/, (_, c) => c.toLowerCase()) // Lowercase first char
    .replace(/\d+/g, (m) => m); // Keep numbers
}

// Generate field mappings
const fieldMappings = csvColumns.map(col => ({
  csvName: col,
  fieldName: toCamelCase(col),
  type: inferType(col)
}));

function inferType(columnName: string): string {
  const lower = columnName.toLowerCase();
  
  if (lower.includes('qty') || lower.includes('quantity') || lower.includes('number of')) {
    return 'Int';
  }
  if (lower.includes('width') || lower.includes('height') || lower.includes('depth') || 
      lower.includes('thickness') || lower.includes('length') || lower.includes('size') ||
      lower.includes('weight') || lower.includes('area') || lower.includes('volume')) {
    return 'Decimal';
  }
  if (lower.includes('price') || lower.includes('cost') || lower.includes('value') || 
      lower.includes('total')) {
    return 'Decimal';
  }
  if (lower.includes('date') || lower.includes(' at')) {
    return 'DateTime';
  }
  if (lower.includes('check') || lower.includes('required') || lower.includes('is ')) {
    return 'Boolean';
  }
  
  return 'String';
}

console.log('Total columns:', csvColumns.length);
console.log('\nField Mappings:\n');
console.log(JSON.stringify(fieldMappings, null, 2));

console.log('\n\nPrisma Schema Fields:\n');
fieldMappings.forEach(({ fieldName, type }) => {
  let prismaType = type;
  if (type === 'Decimal') prismaType = 'Decimal? @db.Decimal(10, 2)';
  else if (type === 'Int') prismaType = 'Int?';
  else if (type === 'DateTime') prismaType = 'DateTime?';
  else if (type === 'Boolean') prismaType = 'Boolean?';
  else prismaType = 'String?';
  
  console.log(`  ${fieldName.padEnd(50)} ${prismaType}`);
});
