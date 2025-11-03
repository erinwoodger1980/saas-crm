const express = require('express');
const multer = require('multer');
const cors = require('cors');

const app = express();
const upload = multer();

// Enable CORS for all routes
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mock leads import preview endpoint
app.post('/leads/import/preview', upload.single('csvFile'), (req, res) => {
  console.log('Received import preview request');
  
  if (!req.file) {
    return res.status(400).json({ error: 'CSV file is required' });
  }

  try {
    // Parse the CSV content
    const csvText = req.file.buffer.toString('utf-8');
    const lines = csvText.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      return res.status(400).json({ error: 'CSV file is empty' });
    }

    // Extract headers (first line)
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    // Extract data rows (skip header)
    const rows = lines.slice(1).map(line => 
      line.split(',').map(cell => cell.trim().replace(/"/g, ''))
    );

    // Mock available fields for joinery business based on our seed template
    const availableFields = [
      { key: 'contactName', label: 'Contact Name', required: true },
      { key: 'email', label: 'Email', required: false },
      { key: 'phone', label: 'Phone', required: false },
      { key: 'company', label: 'Company', required: false },
      { key: 'description', label: 'Description', required: false },
      { key: 'source', label: 'Source', required: false },
      { key: 'status', label: 'Status', required: false },
      // Joinery-specific questionnaire fields from our seed template
      { key: 'custom.project_type', label: 'Project Type (Questionnaire)', required: false },
      { key: 'custom.property_type', label: 'Property Type (Questionnaire)', required: false },
      { key: 'custom.material_preference', label: 'Material Preference (Questionnaire)', required: false },
      { key: 'custom.glass_type', label: 'Glass Type (Questionnaire)', required: false },
      { key: 'custom.quantity', label: 'Quantity (Questionnaire)', required: false },
      { key: 'custom.budget_range', label: 'Budget Range (Questionnaire)', required: false },
      { key: 'custom.timeline', label: 'Timeline (Questionnaire)', required: false },
      { key: 'custom.measurements_available', label: 'Measurements Available (Questionnaire)', required: false },
      { key: 'custom.installation_required', label: 'Installation Required (Questionnaire)', required: false },
      { key: 'custom.security_features', label: 'Security Features (Questionnaire)', required: false },
      { key: 'custom.project_description', label: 'Project Description (Questionnaire)', required: false },
      { key: 'custom.special_requirements', label: 'Special Requirements (Questionnaire)', required: false }
    ];

    // Return first 5 rows as preview
    const preview = rows.slice(0, 5);

    console.log(`Parsed CSV: ${headers.length} headers, ${rows.length} total rows`);

    res.json({
      headers,
      preview,
      totalRows: rows.length,
      availableFields
    });
  } catch (error) {
    console.error('Error parsing CSV:', error);
    res.status(400).json({ error: 'Failed to parse CSV file' });
  }
});

// Mock leads import execute endpoint
app.post('/leads/import/execute', (req, res) => {
  console.log('Received import execute request');
  const { fieldMapping, totalRows } = req.body;
  
  // Mock successful import
  res.json({
    successful: totalRows || 0,
    failed: 0,
    errors: [],
    leadIds: Array.from({ length: totalRows || 0 }, (_, i) => `mock-lead-${i + 1}`)
  });
});

// Catch all 404 handler
app.use((req, res) => {
  console.log(`404 - ${req.method} ${req.path}`);
  res.status(404).json({ error: 'not_found', path: req.path });
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`🚀 Mock API server running on http://localhost:${PORT}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   GET  /health`);
  console.log(`   POST /leads/import/preview`);
  console.log(`   POST /leads/import/execute`);
});