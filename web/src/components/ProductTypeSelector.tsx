/**
 * Phase 3: Product Type Selector
 * 
 * Drill-down modal for selecting ProductType (category → type → option)
 * with visual previews and smart defaults based on lead data
 */

'use client';

import React, { useState, useMemo } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ProductTypeLevel {
  id: string;
  code: string;
  name: string;
  description?: string;
  svgPreview?: string;
  level: 'category' | 'type' | 'option';
  parentId?: string;
  questionSetId?: string;
}

interface ProductTypeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (productType: ProductTypeLevel) => void;
  productTypes: ProductTypeLevel[];
  loading?: boolean;
}

export default function ProductTypeSelector({
  isOpen,
  onClose,
  onSelect,
  productTypes,
  loading = false
}: ProductTypeSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);

  // Build hierarchical structure
  const categories = useMemo(
    () => productTypes.filter(pt => pt.level === 'category'),
    [productTypes]
  );

  const types = useMemo(
    () => productTypes.filter(
      pt => pt.level === 'type' && (
        !selectedCategoryId || pt.parentId === selectedCategoryId
      )
    ),
    [productTypes, selectedCategoryId]
  );

  const options = useMemo(
    () => productTypes.filter(
      pt => pt.level === 'option' && (
        !selectedTypeId || pt.parentId === selectedTypeId
      )
    ),
    [productTypes, selectedTypeId]
  );

  // Filter by search
  const filteredCategories = useMemo(
    () => categories.filter(cat =>
      !searchQuery || 
      cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cat.code.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [categories, searchQuery]
  );

  const filteredTypes = useMemo(
    () => types.filter(typ =>
      !searchQuery || 
      typ.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      typ.code.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [types, searchQuery]
  );

  const filteredOptions = useMemo(
    () => options.filter(opt =>
      !searchQuery || 
      opt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      opt.code.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [options, searchQuery]
  );

  const handleSelectOption = (option: ProductTypeLevel) => {
    onSelect(option);
    onClose();
  };

  const breadcrumbs = [];
  if (selectedCategoryId) {
    const category = categories.find(c => c.id === selectedCategoryId);
    if (category) breadcrumbs.push(category.name);
  }
  if (selectedTypeId) {
    const type = types.find(t => t.id === selectedTypeId);
    if (type) breadcrumbs.push(type.name);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Select Product Type</h2>
            {breadcrumbs.length > 0 && (
              <p className="text-sm text-gray-600 mt-1">{breadcrumbs.join(' → ')}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-4 border-b">
          <Input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {/* Category Selection */}
              {!selectedCategoryId && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Categories</h3>
                  <div className="space-y-2">
                    {filteredCategories.length > 0 ? (
                      filteredCategories.map(category => (
                        <button
                          key={category.id}
                          onClick={() => {
                            setSelectedCategoryId(category.id);
                            setSelectedTypeId(null);
                          }}
                          className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors group"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900">{category.name}</p>
                              {category.description && (
                                <p className="text-xs text-gray-600 mt-1">{category.description}</p>
                              )}
                            </div>
                            <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                          </div>
                        </button>
                      ))
                    ) : (
                      <p className="text-gray-500 text-sm">No categories match your search</p>
                    )}
                  </div>
                </div>
              )}

              {/* Type Selection */}
              {selectedCategoryId && !selectedTypeId && (
                <div>
                  <div className="mb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedCategoryId(null);
                        setSearchQuery('');
                      }}
                    >
                      ← Back to Categories
                    </Button>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-3">Types</h3>
                  <div className="space-y-2">
                    {filteredTypes.length > 0 ? (
                      filteredTypes.map(type => (
                        <button
                          key={type.id}
                          onClick={() => setSelectedTypeId(type.id)}
                          className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors group"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900">{type.name}</p>
                              {type.description && (
                                <p className="text-xs text-gray-600 mt-1">{type.description}</p>
                              )}
                            </div>
                            <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                          </div>
                        </button>
                      ))
                    ) : (
                      <p className="text-gray-500 text-sm">No types match your search</p>
                    )}
                  </div>
                </div>
              )}

              {/* Option Selection */}
              {selectedCategoryId && selectedTypeId && (
                <div>
                  <div className="mb-4 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedTypeId(null)}
                    >
                      ← Back to Types
                    </Button>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-3">Options</h3>
                  <div className="space-y-2">
                    {filteredOptions.length > 0 ? (
                      filteredOptions.map(option => (
                        <button
                          key={option.id}
                          onClick={() => handleSelectOption(option)}
                          className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-green-500 hover:bg-green-50 transition-colors group"
                        >
                          <div className="flex items-start justify-between gap-3">
                            {option.svgPreview && (
                              <div
                                className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded flex items-center justify-center"
                                dangerouslySetInnerHTML={{ __html: option.svgPreview }}
                              />
                            )}
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{option.name}</p>
                              {option.description && (
                                <p className="text-xs text-gray-600 mt-1">{option.description}</p>
                              )}
                              <p className="text-xs text-gray-500 mt-1">Code: {option.code}</p>
                            </div>
                            <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-green-500 transition-colors flex-shrink-0 mt-1" />
                          </div>
                        </button>
                      ))
                    ) : (
                      <p className="text-gray-500 text-sm">No options match your search</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
