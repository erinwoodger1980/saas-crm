"use client";

import { useState, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";

interface CsvPreview {
  headers: string[];
  preview: string[][];
  totalRows: number;
  availableFields: Array<{ key: string; label: string; required: boolean }>;
}

interface ImportResult {
  successful: number;
  failed: number;
  errors: Array<{ row: number; errors: string[] }>;
  leadIds: string[];
}

interface CsvImportModalProps {
  open: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export default function CsvImportModal({ open, onClose, onImportComplete }: CsvImportModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<'upload' | 'mapping' | 'importing' | 'results'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);

  const resetState = useCallback(() => {
    setStep('upload');
    setFile(null);
    setPreview(null);
    setFieldMapping({});
    setImportResult(null);
    setLoading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('csvFile', selectedFile);
      
      const result = await apiFetch<CsvPreview>('/leads/import/preview', {
        method: 'POST',
        body: formData,
      });
      
      setPreview(result);
      setStep('mapping');
      
      // Auto-map fields where column names match
      const autoMapping: Record<string, string> = {};
      result.headers.forEach(headerRaw => {
        const header = typeof headerRaw === 'string' ? headerRaw : headerRaw == null ? '' : String(headerRaw);
        const normalizedHeader = header.toLowerCase().trim();
        if (!normalizedHeader) {
          return;
        }
        
        // First check exact matches (case-insensitive)
        let matchingField = result.availableFields.find(field => {
          const fieldLabel = field.label.toLowerCase();
          const fieldKey = field.key.toLowerCase();
          return fieldLabel === normalizedHeader || 
                 fieldKey === normalizedHeader ||
                 (fieldKey.startsWith('custom.') && fieldKey.substring(7) === normalizedHeader);
        });
        
        // If no exact match, try pattern matching
        if (!matchingField) {
          matchingField = result.availableFields.find(field => {
            const fieldLabel = field.label.toLowerCase();
            const fieldKey = field.key.toLowerCase();
            
            // Basic field patterns
            if ((normalizedHeader.includes('name') || normalizedHeader.includes('contact')) && field.key === 'contactName') return true;
            if (normalizedHeader.includes('email') && field.key === 'email') return true;
            if (normalizedHeader.includes('phone') && field.key === 'phone') return true;
            if (normalizedHeader.includes('company') && field.key === 'company') return true;
            if (normalizedHeader.includes('description') && field.key === 'description') return true;
            if (normalizedHeader.includes('source') && field.key === 'source') return true;
            if (normalizedHeader.includes('status') && field.key === 'status') return true;
            
            // Questionnaire field patterns
            if (field.key.startsWith('custom.')) {
              // Check if header contains words from the field label
              const labelWords = fieldLabel.split(/\s+|[^\w]/);
              const headerWords = normalizedHeader.split(/\s+|[^\w]/);
              const matchingWords = labelWords.filter(word => 
                word.length > 2 && headerWords.some(hw => hw.includes(word) || word.includes(hw))
              );
              return matchingWords.length > 0;
            }
            
            return false;
          });
        }
        
        if (matchingField) {
          autoMapping[header] = matchingField.key;
        }
      });
      setFieldMapping(autoMapping);
      
    } catch (error: any) {
      toast({
        title: "Failed to parse CSV",
        description: error.message || "Please check your file format",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const handleImport = useCallback(async () => {
    if (!file || !preview) return;
    
    // Validate required fields are mapped
    const requiredFields = preview.availableFields.filter(f => f.required);
    const mappedFields = Object.values(fieldMapping);
    const missingRequired = requiredFields.filter(field => !mappedFields.includes(field.key));
    
    if (missingRequired.length > 0) {
      toast({
        title: "Missing required fields",
        description: `Please map: ${missingRequired.map(f => f.label).join(', ')}`,
        variant: "destructive"
      });
      return;
    }
    
    setStep('importing');
    setLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('csvFile', file);
      formData.append('fieldMapping', JSON.stringify(fieldMapping));
      
      const result = await apiFetch<ImportResult>('/leads/import/execute', {
        method: 'POST',
        body: formData,
      });
      
      setImportResult(result);
      setStep('results');
      
      if (result.successful > 0) {
        toast({
          title: "Import completed",
          description: `Successfully imported ${result.successful} leads${result.failed > 0 ? `, ${result.failed} failed` : ''}`,
        });
        onImportComplete();
      }
      
    } catch (error: any) {
      toast({
        title: "Import failed",
        description: error.message || "Please try again",
        variant: "destructive"
      });
      setStep('mapping');
    } finally {
      setLoading(false);
    }
  }, [file, preview, fieldMapping, toast, onImportComplete]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={handleClose} />
      
      <div className="relative w-full max-w-4xl max-h-[90vh] mx-4 bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Import Leads from CSV</h2>
            <p className="text-sm text-gray-500 mt-1">
              Step {step === 'upload' ? '1' : step === 'mapping' ? '2' : step === 'importing' ? '3' : '4'} of 4
            </p>
          </div>
          
          <Button
            onClick={handleClose}
            variant="ghost"
            size="sm"
            className="p-2 h-auto"
          >
            ✕
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          
          {/* Step 1: File Upload */}
          {step === 'upload' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file);
                    }}
                    className="hidden"
                  />
                  
                  <div className="space-y-4">
                    <div className="text-4xl">📊</div>
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">Choose CSV file</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Upload a CSV file with your lead data. Max file size: 5MB
                      </p>
                    </div>
                    
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={loading}
                    >
                      {loading ? 'Processing...' : 'Select File'}
                    </Button>
                  </div>
                </div>
              </div>
              
                  <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">CSV Format Requirements:</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• First row should contain column headers</li>
                  <li>• Contact Name column is required</li>
                  <li>• Supported columns: Name, Email, Phone, Company, Description, Source, Status</li>
                  <li>• <strong>Questionnaire fields:</strong> Import directly into any of your questionnaire questions</li>
                  <li>• Use comma separation, quotes for text containing commas</li>
                </ul>
              </div>
            </div>
          )}

          {/* Step 2: Field Mapping */}
          {step === 'mapping' && preview && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Map CSV columns to lead fields</h3>
                <p className="text-sm text-gray-500">
                  Found {preview.totalRows} rows. Map your CSV columns to the appropriate lead fields.
                </p>
              </div>

              {/* Field Mapping */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {preview.headers.map((header, index) => {
                    // Separate basic fields from questionnaire fields
                    const basicFields = preview.availableFields.filter(f => !f.key.startsWith('custom.'));
                    const questionnaireFields = preview.availableFields.filter(f => f.key.startsWith('custom.'));
                    
                    return (
                      <div key={index} className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          CSV Column: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{header}</span>
                        </label>
                        <select
                          value={fieldMapping[header] || ''}
                          onChange={(e) => {
                            setFieldMapping(prev => ({
                              ...prev,
                              [header]: e.target.value
                            }));
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="">Don't import this column</option>
                          
                          {/* Basic Lead Fields */}
                          <optgroup label="Basic Lead Fields">
                            {basicFields.map(field => (
                              <option key={field.key} value={field.key}>
                                {field.label} {field.required ? '(Required)' : ''}
                              </option>
                            ))}
                          </optgroup>
                          
                          {/* Questionnaire Fields */}
                          {questionnaireFields.length > 0 && (
                            <optgroup label="Questionnaire Fields">
                              {questionnaireFields.map(field => (
                                <option key={field.key} value={field.key}>
                                  {field.label} {field.required ? '(Required)' : ''}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Preview */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Data Preview</h4>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {preview.headers.map((header, index) => (
                          <th key={index} className="px-4 py-2 text-left font-medium text-gray-900 border-r">
                            {header}
                            {fieldMapping[header] && (
                              <div className="text-xs text-blue-600 mt-1">
                                → {preview.availableFields.find(f => f.key === fieldMapping[header])?.label}
                              </div>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.preview.map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-t">
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className="px-4 py-2 border-r max-w-32 truncate">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Importing */}
          {step === 'importing' && (
            <div className="text-center space-y-4">
              <div className="text-4xl">⏳</div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">Importing leads...</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Please wait while we process your CSV file and create the leads.
                </p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full animate-pulse w-1/2"></div>
              </div>
            </div>
          )}

          {/* Step 4: Results */}
          {step === 'results' && importResult && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-4xl mb-4">
                  {importResult.successful > 0 ? '✅' : '❌'}
                </div>
                <h3 className="text-lg font-medium text-gray-900">Import Complete</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{importResult.successful}</div>
                  <div className="text-sm text-green-700">Leads imported successfully</div>
                </div>
                
                {importResult.failed > 0 && (
                  <div className="bg-red-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{importResult.failed}</div>
                    <div className="text-sm text-red-700">Failed imports</div>
                  </div>
                )}
              </div>

              {importResult.errors.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Import Errors</h4>
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {importResult.errors.map((error, index) => (
                      <div key={index} className="bg-red-50 p-3 rounded-lg text-sm">
                        <div className="font-medium text-red-700">Row {error.row}:</div>
                        <ul className="text-red-600 ml-4 list-disc">
                          {error.errors.map((err, errIndex) => (
                            <li key={errIndex}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
          <div className="text-sm text-gray-500">
            {step === 'mapping' && preview && `${preview.totalRows} rows to import`}
            {step === 'results' && importResult && `${importResult.successful + importResult.failed} rows processed`}
          </div>
          
          <div className="flex gap-2">
            {(step === 'mapping' || step === 'results') && (
              <Button
                variant="outline"
                onClick={() => {
                  if (step === 'results') {
                    handleClose();
                  } else {
                    setStep('upload');
                    setPreview(null);
                    setFieldMapping({});
                  }
                }}
              >
                {step === 'results' ? 'Close' : 'Back'}
              </Button>
            )}
            
            {step === 'mapping' && (
              <Button
                onClick={handleImport}
                disabled={loading}
              >
                Import {preview?.totalRows} Leads
              </Button>
            )}

            {step === 'results' && importResult && importResult.successful > 0 && (
              <Button onClick={handleClose}>
                View Imported Leads
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}