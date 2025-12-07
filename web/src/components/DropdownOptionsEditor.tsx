'use client';

import React, { useState, useEffect } from 'react';

interface DropdownOptionsEditorProps {
  isOpen: boolean;
  onClose: () => void;
  fieldName: string;
  fieldLabel: string;
  currentOptions: string[];
  currentColors: Record<string, { bg: string; text: string }>;
  onSave: (options: string[], colors: Record<string, { bg: string; text: string }>) => void;
}

const PRESET_COLORS = [
  { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Gray' },
  { bg: 'bg-red-100', text: 'text-red-700', label: 'Red' },
  { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Orange' },
  { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Amber' },
  { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Yellow' },
  { bg: 'bg-lime-100', text: 'text-lime-700', label: 'Lime' },
  { bg: 'bg-green-100', text: 'text-green-700', label: 'Green' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Emerald' },
  { bg: 'bg-teal-100', text: 'text-teal-700', label: 'Teal' },
  { bg: 'bg-cyan-100', text: 'text-cyan-700', label: 'Cyan' },
  { bg: 'bg-sky-100', text: 'text-sky-700', label: 'Sky' },
  { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Blue' },
  { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Indigo' },
  { bg: 'bg-violet-100', text: 'text-violet-700', label: 'Violet' },
  { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Purple' },
  { bg: 'bg-fuchsia-100', text: 'text-fuchsia-700', label: 'Fuchsia' },
  { bg: 'bg-pink-100', text: 'text-pink-700', label: 'Pink' },
  { bg: 'bg-rose-100', text: 'text-rose-700', label: 'Rose' },
];

export default function DropdownOptionsEditor({
  isOpen,
  onClose,
  fieldName,
  fieldLabel,
  currentOptions,
  currentColors,
  onSave,
}: DropdownOptionsEditorProps) {
  const [options, setOptions] = useState<string[]>([]);
  const [colors, setColors] = useState<Record<string, { bg: string; text: string }>>({});
  const [newOption, setNewOption] = useState('');
  const [editingOption, setEditingOption] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setOptions([...currentOptions]);
      setColors({ ...currentColors });
      setNewOption('');
      setEditingOption(null);
    }
  }, [isOpen, currentOptions, currentColors]);

  const handleAddOption = () => {
    if (newOption.trim() && !options.includes(newOption.trim())) {
      setOptions([...options, newOption.trim()]);
      setNewOption('');
    }
  };

  const handleRemoveOption = (option: string) => {
    setOptions(options.filter((o) => o !== option));
    const newColors = { ...colors };
    delete newColors[`${fieldName}:${option}`];
    setColors(newColors);
  };

  const handleSetColor = (option: string, color: { bg: string; text: string }) => {
    setColors({
      ...colors,
      [`${fieldName}:${option}`]: color,
    });
    setEditingOption(null);
  };

  const handleSave = () => {
    onSave(options, colors);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Edit {fieldLabel} Options
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 140px)' }}>
          {/* Add new option */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Add New Option
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newOption}
                onChange={(e) => setNewOption(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddOption()}
                placeholder="Enter option name"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAddOption}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Add
              </button>
            </div>
          </div>

          {/* Existing options */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Options ({options.length})
            </label>
            <div className="space-y-2">
              {options.map((option) => {
                const colorKey = `${fieldName}:${option}`;
                const currentColor = colors[colorKey];
                const isEditing = editingOption === option;

                return (
                  <div
                    key={option}
                    className="relative flex items-center gap-2 p-2 border border-slate-200 rounded-md"
                  >
                    <span
                      className={`flex-1 px-3 py-1.5 rounded ${
                        currentColor
                          ? `${currentColor.bg} ${currentColor.text}`
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {option}
                    </span>
                    <button
                      onClick={() => setEditingOption(isEditing ? null : option)}
                      className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded"
                      title="Set color"
                    >
                      {isEditing ? 'Cancel' : 'Color'}
                    </button>
                    <button
                      onClick={() => handleRemoveOption(option)}
                      className="px-3 py-1.5 text-sm bg-red-100 text-red-700 hover:bg-red-200 rounded"
                      title="Remove option"
                    >
                      Remove
                    </button>

                    {isEditing && (
                      <div className="absolute left-0 top-full mt-2 p-3 bg-white border border-slate-300 rounded-lg shadow-xl z-10 grid grid-cols-6 gap-2">
                        {PRESET_COLORS.map((preset) => (
                          <button
                            key={preset.label}
                            onClick={() => handleSetColor(option, { bg: preset.bg, text: preset.text })}
                            className={`w-10 h-10 rounded ${preset.bg} ${preset.text} border-2 border-transparent hover:border-slate-400 flex items-center justify-center text-xs font-medium`}
                            title={preset.label}
                          >
                            {preset.label.charAt(0)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
