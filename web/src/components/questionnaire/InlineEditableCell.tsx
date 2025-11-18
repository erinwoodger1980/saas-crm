"use client";

import React, { useState, useEffect, useRef } from "react";

interface InlineEditableCellProps {
  value: string;
  onSave: (next: string) => Promise<void> | void;
  type?: "text" | "select";
  selectOptions?: string[];
  className?: string;
}

// Simple inline editable cell: click to edit, blur or Enter to save
export const InlineEditableCell: React.FC<InlineEditableCellProps> = ({
  value,
  onSave,
  type = "text",
  selectOptions = [],
  className = "",
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const prevValue = useRef(value);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  useEffect(() => {
    if (value !== prevValue.current && !editing) {
      setDraft(value);
      prevValue.current = value;
    }
  }, [value, editing]);

  async function commit() {
    if (draft === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  if (editing) {
    if (type === "select") {
      return (
        <select
          ref={inputRef as any}
          className={`w-full rounded border px-2 py-1 text-sm bg-white ${className}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
        >
          {selectOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }
    return (
      <input
        ref={inputRef as any}
        className={`w-full rounded border px-2 py-1 text-sm bg-white ${className}`}
        value={draft}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <div
      className={`cursor-pointer px-2 py-1 ${className}`}
      onClick={() => setEditing(true)}
      title="Click to edit"
    >
      {saving ? <span className="animate-pulse text-xs text-slate-400">Saving…</span> : draft || <span className="text-slate-400">(empty)</span>}
    </div>
  );
};

export default InlineEditableCell;
