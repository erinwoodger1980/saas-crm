"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { X } from "lucide-react";

type ProductCategory = "doors" | "windows" | null;

type DoorType = "entrance" | "bifold" | "sliding" | "french";
type WindowType = "sash-cord" | "sash-spring" | "casement" | "stormproof" | "alu-clad";

type DoorConfig = {
  type: DoorType;
  label: string;
  options: Array<{
    id: string;
    label: string;
    imagePath: string;
  }>;
};

type WindowConfig = {
  type: WindowType;
  label: string;
  options: Array<{
    id: string;
    label: string;
    imagePath: string;
  }>;
};

const DOOR_TYPES: DoorConfig[] = [
  {
    type: "entrance",
    label: "Entrance Door",
    options: [
      { id: "entrance-single", label: "Single Door", imagePath: "/diagrams/doors/entrance-single.svg" },
      { id: "entrance-double", label: "Double Door", imagePath: "/diagrams/doors/entrance-double.svg" },
    ],
  },
  {
    type: "bifold",
    label: "Bi-fold",
    options: [
      { id: "bifold-2-panel", label: "2 Panel", imagePath: "/diagrams/doors/bifold-2.svg" },
      { id: "bifold-3-panel", label: "3 Panel", imagePath: "/diagrams/doors/bifold-3.svg" },
      { id: "bifold-4-panel", label: "4 Panel", imagePath: "/diagrams/doors/bifold-4.svg" },
    ],
  },
  {
    type: "sliding",
    label: "Sliding",
    options: [
      { id: "sliding-single", label: "Single Slider", imagePath: "/diagrams/doors/sliding-single.svg" },
      { id: "sliding-double", label: "Double Slider", imagePath: "/diagrams/doors/sliding-double.svg" },
    ],
  },
  {
    type: "french",
    label: "French Door",
    options: [
      { id: "french-standard", label: "Standard French", imagePath: "/diagrams/doors/french-standard.svg" },
      { id: "french-extended", label: "Extended French", imagePath: "/diagrams/doors/french-extended.svg" },
    ],
  },
];

const WINDOW_TYPES: WindowConfig[] = [
  {
    type: "sash-cord",
    label: "Sash (Cord)",
    options: [
      { id: "sash-cord-single", label: "Single Hung", imagePath: "/diagrams/windows/sash-cord-single.svg" },
      { id: "sash-cord-double", label: "Double Hung", imagePath: "/diagrams/windows/sash-cord-double.svg" },
    ],
  },
  {
    type: "sash-spring",
    label: "Sash (Spring)",
    options: [
      { id: "sash-spring-single", label: "Single Hung", imagePath: "/diagrams/windows/sash-spring-single.svg" },
      { id: "sash-spring-double", label: "Double Hung", imagePath: "/diagrams/windows/sash-spring-double.svg" },
    ],
  },
  {
    type: "casement",
    label: "Casement",
    options: [
      { id: "casement-single", label: "Single Casement", imagePath: "/diagrams/windows/casement-single.svg" },
      { id: "casement-double", label: "Double Casement", imagePath: "/diagrams/windows/casement-double.svg" },
    ],
  },
  {
    type: "stormproof",
    label: "Stormproof",
    options: [
      { id: "stormproof-single", label: "Single Stormproof", imagePath: "/diagrams/windows/stormproof-single.svg" },
      { id: "stormproof-double", label: "Double Stormproof", imagePath: "/diagrams/windows/stormproof-double.svg" },
    ],
  },
  {
    type: "alu-clad",
    label: "Alu-Clad",
    options: [
      { id: "alu-clad-casement", label: "Casement", imagePath: "/diagrams/windows/alu-clad-casement.svg" },
      { id: "alu-clad-tilt-turn", label: "Tilt & Turn", imagePath: "/diagrams/windows/alu-clad-tilt-turn.svg" },
    ],
  },
];

interface TypeSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (selection: { category: string; type: string; option: string }) => void;
}

export function TypeSelectorModal({ isOpen, onClose, onSelect }: TypeSelectorModalProps) {
  const [category, setCategory] = useState<ProductCategory>(null);
  const [selectedType, setSelectedType] = useState<DoorType | WindowType | null>(null);

  const handleCategorySelect = (cat: ProductCategory) => {
    setCategory(cat);
    setSelectedType(null);
  };

  const handleTypeSelect = (type: DoorType | WindowType) => {
    setSelectedType(type);
  };

  const handleOptionSelect = (optionId: string) => {
    if (!category || !selectedType) return;
    onSelect({
      category,
      type: selectedType,
      option: optionId,
    });
    handleClose();
  };

  const handleClose = () => {
    setCategory(null);
    setSelectedType(null);
    onClose();
  };

  const handleBack = () => {
    if (selectedType) {
      setSelectedType(null);
    } else if (category) {
      setCategory(null);
    }
  };

  const currentTypeConfig = (() => {
    if (!selectedType) return null;
    if (category === "doors") {
      return DOOR_TYPES.find((t) => t.type === selectedType);
    } else if (category === "windows") {
      return WINDOW_TYPES.find((t) => t.type === selectedType);
    }
    return null;
  })();

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>
              {!category && "Select Product Type"}
              {category && !selectedType && `Select ${category === "doors" ? "Door" : "Window"} Type`}
              {category && selectedType && currentTypeConfig?.label}
            </DialogTitle>
            <div className="flex gap-2">
              {(category || selectedType) && (
                <Button variant="outline" size="sm" onClick={handleBack}>
                  Back
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-6">
          {/* Category Selection */}
          {!category && (
            <div className="grid grid-cols-2 gap-6">
              <button
                onClick={() => handleCategorySelect("doors")}
                className="p-8 border-2 border-slate-200 rounded-xl hover:border-sky-400 hover:bg-sky-50 transition-all group"
              >
                <div className="text-6xl mb-4">🚪</div>
                <div className="text-xl font-semibold text-slate-900">Doors</div>
                <div className="text-sm text-slate-500 mt-2">
                  Entrance, Bi-fold, Sliding, French
                </div>
              </button>
              <button
                onClick={() => handleCategorySelect("windows")}
                className="p-8 border-2 border-slate-200 rounded-xl hover:border-sky-400 hover:bg-sky-50 transition-all group"
              >
                <div className="text-6xl mb-4">🪟</div>
                <div className="text-xl font-semibold text-slate-900">Windows</div>
                <div className="text-sm text-slate-500 mt-2">
                  Sash, Casement, Stormproof, Alu-Clad
                </div>
              </button>
            </div>
          )}

          {/* Type Selection */}
          {category && !selectedType && (
            <div className="grid grid-cols-2 gap-4">
              {(category === "doors" ? DOOR_TYPES : WINDOW_TYPES).map((typeConfig) => (
                <button
                  key={typeConfig.type}
                  onClick={() => handleTypeSelect(typeConfig.type)}
                  className="p-6 border-2 border-slate-200 rounded-lg hover:border-sky-400 hover:bg-sky-50 transition-all text-left"
                >
                  <div className="text-lg font-semibold text-slate-900">{typeConfig.label}</div>
                  <div className="text-sm text-slate-500 mt-1">
                    {typeConfig.options.length} options
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Option Selection with Diagrams */}
          {category && selectedType && currentTypeConfig && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              {currentTypeConfig.options.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleOptionSelect(option.id)}
                  className="p-6 border-2 border-slate-200 rounded-lg hover:border-sky-400 hover:bg-sky-50 transition-all group"
                >
                  <div className="aspect-square bg-slate-100 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
                    {/* SVG Diagram */}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 100 100"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-16 h-16 text-slate-600"
                    >
                      {option.id.includes("alu-clad") ? (
                        <>
                          {/* outer clad */}
                          <rect x="16" y="16" width="68" height="68" rx="2" />
                          {/* timber frame inside */}
                          <rect x="20" y="20" width="60" height="60" rx="2" strokeWidth="2" />
                          {/* sash */}
                          <rect x="24" y="24" width="52" height="52" rx="1" />
                        </>
                      ) : (
                        <circle cx="50" cy="50" r="30" />
                      )}
                    </svg>
                  </div>
                  <div className="text-sm font-semibold text-slate-900 text-center">
                    {option.label}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
