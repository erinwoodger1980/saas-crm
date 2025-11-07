'use client';

import { Plus, Trash2, Shield, CheckCircle, Award, Clock } from 'lucide-react';

interface Guarantee {
  icon: string;
  title: string;
  description: string;
}

interface GuaranteesEditorProps {
  guarantees: Guarantee[];
  onGuaranteesChange: (guarantees: Guarantee[]) => void;
}

const iconOptions = [
  { value: 'shield', label: 'Shield', Icon: Shield },
  { value: 'check', label: 'Check Circle', Icon: CheckCircle },
  { value: 'award', label: 'Award', Icon: Award },
  { value: 'clock', label: 'Clock', Icon: Clock },
];

export default function GuaranteesEditor({ guarantees, onGuaranteesChange }: GuaranteesEditorProps) {
  const handleAdd = () => {
    const newGuarantee: Guarantee = {
      icon: 'shield',
      title: '',
      description: '',
    };
    onGuaranteesChange([...guarantees, newGuarantee]);
  };

  const handleDelete = (index: number) => {
    const newGuarantees = guarantees.filter((_, i) => i !== index);
    onGuaranteesChange(newGuarantees);
  };

  const handleChange = (index: number, field: keyof Guarantee, value: string) => {
    const newGuarantees = [...guarantees];
    newGuarantees[index] = { ...newGuarantees[index], [field]: value };
    onGuaranteesChange(newGuarantees);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Trust Signals & Guarantees</h2>
          <p className="text-sm text-gray-600 mt-1">
            Highlight your promises and credentials
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus size={18} />
          Add Guarantee
        </button>
      </div>

      {guarantees.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
          <Shield size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 mb-4">No guarantees added yet</p>
          <button
            onClick={handleAdd}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={18} />
            Add First Guarantee
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {guarantees.map((guarantee, index) => (
            <div
              key={index}
              className="p-4 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex items-start gap-4">
                {/* Icon Selector */}
                <div className="w-32 flex-shrink-0">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Icon
                  </label>
                  <select
                    value={guarantee.icon}
                    onChange={(e) => handleChange(index, 'icon', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    {iconOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <div className="mt-2 flex justify-center">
                    {(() => {
                      const IconComponent = iconOptions.find((opt) => opt.value === guarantee.icon)?.Icon || Shield;
                      return <IconComponent size={32} className="text-blue-600" />;
                    })()}
                  </div>
                </div>

                {/* Title & Description */}
                <div className="flex-1">
                  <div className="mb-3">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Title
                    </label>
                    <input
                      type="text"
                      value={guarantee.title}
                      onChange={(e) => handleChange(index, 'title', e.target.value)}
                      placeholder="10-Year Guarantee"
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={guarantee.description}
                      onChange={(e) => handleChange(index, 'description', e.target.value)}
                      placeholder="All our work comes with a comprehensive 10-year warranty for your peace of mind."
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                    />
                  </div>
                </div>

                {/* Delete Button */}
                <button
                  onClick={() => handleDelete(index)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded transition"
                  title="Delete guarantee"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Add Suggestions */}
      {guarantees.length === 0 && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm font-semibold text-blue-900 mb-2">Quick suggestions:</p>
          <div className="flex flex-wrap gap-2">
            {[
              '10-Year Guarantee',
              'Fully Insured',
              'Free No-Obligation Quote',
              '5-Star Rated',
            ].map((title) => (
              <button
                key={title}
                onClick={() => {
                  onGuaranteesChange([
                    ...guarantees,
                    {
                      icon: 'shield',
                      title,
                      description: `Our commitment to ${title.toLowerCase()}.`,
                    },
                  ]);
                }}
                className="px-3 py-1 bg-white border border-blue-300 text-blue-700 rounded text-sm hover:bg-blue-100 transition"
              >
                + {title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
