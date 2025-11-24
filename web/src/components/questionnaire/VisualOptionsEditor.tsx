"use client";
import React, { useState, useEffect } from "react";
import { X, Plus, GripVertical } from "lucide-react";
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface VisualOptionsEditorProps {
  options: string[];
  onChange: (newOptions: string[]) => void;
}

function SortableOption({ option, index, onRemove, onEdit }: { 
  option: string; 
  index: number; 
  onRemove: () => void;
  onEdit: (newValue: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: option + index });
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(option);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  function handleSave() {
    if (editValue.trim()) {
      onEdit(editValue.trim());
      setIsEditing(false);
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg group hover:bg-blue-100 transition-colors"
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600">
        <GripVertical className="w-4 h-4" />
      </div>
      
      {isEditing ? (
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") {
              setEditValue(option);
              setIsEditing(false);
            }
          }}
          autoFocus
          className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      ) : (
        <span 
          className="flex-1 text-sm text-slate-700 cursor-pointer"
          onClick={() => setIsEditing(true)}
          title="Click to edit"
        >
          {option}
        </span>
      )}
      
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-100 rounded text-red-600"
        title="Remove option"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function VisualOptionsEditor({ options, onChange }: VisualOptionsEditorProps) {
  const [items, setItems] = useState<string[]>(options || []);
  const [newOption, setNewOption] = useState("");
  const [dirty, setDirty] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Sync with parent when options change externally
  useEffect(() => {
    if (!dirty) {
      setItems(options || []);
    }
  }, [options, dirty]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setItems((prev) => {
      const oldIndex = prev.findIndex((_, i) => active.id === prev[i] + i);
      const newIndex = prev.findIndex((_, i) => over.id === prev[i] + i);
      const newArr = arrayMove(prev, oldIndex, newIndex);
      setDirty(true);
      return newArr;
    });
  }

  function addOption() {
    if (!newOption.trim()) return;
    if (items.includes(newOption.trim())) {
      alert("This option already exists");
      return;
    }
    setItems([...items, newOption.trim()]);
    setNewOption("");
    setDirty(true);
  }

  function removeOption(index: number) {
    setItems(items.filter((_, i) => i !== index));
    setDirty(true);
  }

  function editOption(index: number, newValue: string) {
    const updated = [...items];
    updated[index] = newValue;
    setItems(updated);
    setDirty(true);
  }

  function save() {
    onChange(items);
    setDirty(false);
  }

  function reset() {
    setItems(options || []);
    setDirty(false);
  }

  return (
    <div className="space-y-3">
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd} sensors={sensors}>
        <SortableContext items={items.map((opt, i) => opt + i)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {items.length === 0 ? (
              <div className="text-xs text-slate-400 italic py-2">No options yet. Add one below.</div>
            ) : (
              items.map((option, index) => (
                <SortableOption
                  key={option + index}
                  option={option}
                  index={index}
                  onRemove={() => removeOption(index)}
                  onEdit={(newValue) => editOption(index, newValue)}
                />
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex gap-2">
        <input
          type="text"
          value={newOption}
          onChange={(e) => setNewOption(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addOption();
            }
          }}
          placeholder="Add new option..."
          className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={addOption}
          disabled={!newOption.trim()}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 text-sm"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>

      {dirty && (
        <div className="flex gap-2 pt-2 border-t">
          <button
            type="button"
            onClick={save}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 text-sm font-medium"
          >
            Save Changes
          </button>
          <button
            type="button"
            onClick={reset}
            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 text-sm"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
