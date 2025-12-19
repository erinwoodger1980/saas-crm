"use client";

import React from "react";

interface ClientDatabaseField {
  name: string;
  type: string;
  nullable: boolean;
  description: string;
}

const CLIENT_MODEL_FIELDS: ClientDatabaseField[] = [
  { name: "name", type: "text", nullable: false, description: "Client company name" },
  { name: "type", type: "select", nullable: true, description: "Client type (public, trade, reseller)" },
  { name: "email", type: "email", nullable: true, description: "Primary email address" },
  { name: "phone", type: "text", nullable: true, description: "Primary phone number" },
  { name: "companyName", type: "text", nullable: true, description: "Official company name" },
  { name: "contactPerson", type: "text", nullable: true, description: "Primary contact name" },
  { name: "address", type: "text", nullable: true, description: "Street address" },
  { name: "city", type: "text", nullable: true, description: "City" },
  { name: "postcode", type: "text", nullable: true, description: "Postal code" },
  { name: "country", type: "text", nullable: true, description: "Country" },
  { name: "notes", type: "textarea", nullable: true, description: "Internal notes" },
  { name: "tags", type: "array", nullable: true, description: "Custom tags" },
  { name: "isActive", type: "boolean", nullable: false, description: "Whether client is active" },
];

export const ClientDatabaseFieldsDisplay: React.FC = () => {
  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">📦 Client Database Fields (Built-in)</h3>
        <p className="text-xs text-blue-700 mb-4">
          These fields are always available in the Client model. They cannot be edited or deleted, but you can add custom fields below.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {CLIENT_MODEL_FIELDS.map((field) => (
            <div key={field.name} className="rounded-lg bg-white p-3 border border-blue-100">
              <div className="flex items-start justify-between mb-1">
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-xs font-semibold text-slate-900">{field.name}</div>
                  <div className="text-xs text-slate-600 mt-0.5">{field.description}</div>
                </div>
                <div className="ml-2 flex-shrink-0">
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                    {field.type}
                  </span>
                </div>
              </div>
              {field.nullable && (
                <div className="text-[10px] text-slate-500 italic">Optional</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
