"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useEffect } from "react";
import { ChevronDown, Plus, Trash2, Copy } from "lucide-react";

interface FormulaToken {
  type: "field" | "operator" | "function" | "lookup" | "number" | "text";
  value: string;
  label?: string;
}

interface FormulaWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (formula: string) => void;
  initialFormula?: string;
  availableFields: Array<{ name: string; type: string }>;
  availableLookupTables: Array<{ id: string; tableName?: string; name?: string; category?: string }>;
  availableFunctions?: string[];
}

const AVAILABLE_FUNCTIONS = [
  { name: "SUM", description: "Add numbers: SUM(a, b, c)" },
  { name: "MULTIPLY", description: "Multiply numbers: MULTIPLY(a, b)" },
  { name: "DIVIDE", description: "Divide: DIVIDE(a, b)" },
  { name: "SUBTRACT", description: "Subtract: SUBTRACT(a, b)" },
  { name: "IF", description: "Conditional: IF(condition, true_value, false_value)" },
  { name: "MAX", description: "Maximum: MAX(a, b, c)" },
  { name: "MIN", description: "Minimum: MIN(a, b, c)" },
  { name: "ROUND", description: "Round: ROUND(number, decimals)" },
  { name: "CEIL", description: "Round up: CEIL(number)" },
  { name: "FLOOR", description: "Round down: FLOOR(number)" },
  { name: "LOOKUP", description: "Lookup value: LOOKUP(table, field=value, return_field)" },
  { name: "CONCAT", description: "Combine text: CONCAT(a, b, c)" },
  { name: "LENGTH", description: "Text length: LENGTH(text)" },
];

const OPERATORS = ["+", "-", "*", "/", "=", "!=", ">", "<", ">=", "<=", "&&", "||"];

export function FormulaWizard({
  isOpen,
  onClose,
  onSave,
  initialFormula = "",
  availableFields = [],
  availableLookupTables = [],
  availableFunctions = AVAILABLE_FUNCTIONS.map((f) => f.name),
}: FormulaWizardProps) {
  const [formula, setFormula] = useState(initialFormula);
  const [tokens, setTokens] = useState<FormulaToken[]>([]);
  const [selectedFunction, setSelectedFunction] = useState<string>("");
  const [selectedField, setSelectedField] = useState<string>("");
  const [selectedOperator, setSelectedOperator] = useState<string>("");
  const [selectedLookupTable, setSelectedLookupTable] = useState<string>("");
  const [numberInput, setNumberInput] = useState<string>("");
  const [textInput, setTextInput] = useState<string>("");

  // Parse formula into tokens on load
  useEffect(() => {
    if (initialFormula) {
      setFormula(initialFormula);
      parseFormula(initialFormula);
    }
  }, [initialFormula, isOpen]);

  const parseFormula = (f: string) => {
    // Simple parser - would need to be enhanced for complex formulas
    const newTokens: FormulaToken[] = [];
    const parts = f.match(/\$\{[\w.]+\}|[A-Z_]+\(|[)(\s,+\-*/=!><&|]+|"[^"]*"|'[^']*'|\d+(\.\d+)?|[a-zA-Z_]\w*/g) || [];

    for (const part of parts) {
      if (part.match(/^\s+$/)) continue; // skip whitespace

      if (part.startsWith("${") && part.endsWith("}")) {
        newTokens.push({
          type: "field",
          value: part,
          label: part.slice(2, -1),
        });
      } else if (availableFunctions.includes(part.replace("(", ""))) {
        newTokens.push({
          type: "function",
          value: part.replace("(", ""),
          label: part.replace("(", ""),
        });
      } else if (OPERATORS.includes(part)) {
        newTokens.push({
          type: "operator",
          value: part,
          label: part,
        });
      } else if (/^\d+(\.\d+)?$/.test(part)) {
        newTokens.push({
          type: "number",
          value: part,
          label: part,
        });
      } else if (part.match(/^["'].*["']$/)) {
        newTokens.push({
          type: "text",
          value: part,
          label: part.slice(1, -1),
        });
      } else if (part !== "(" && part !== ")" && part !== ",") {
        newTokens.push({
          type: "field",
          value: `\${${part}}`,
          label: part,
        });
      }
    }

    setTokens(newTokens);
  };

  const addField = () => {
    if (!selectedField) return;
    const field = availableFields.find((f) => f.name === selectedField);
    if (field) {
      const newToken: FormulaToken = {
        type: "field",
        value: `\${${selectedField}}`,
        label: selectedField,
      };
      setTokens([...tokens, newToken]);
      updateFormula([...tokens, newToken]);
      setSelectedField("");
    }
  };

  const addFunction = () => {
    if (!selectedFunction) return;
    const newToken: FormulaToken = {
      type: "function",
      value: selectedFunction,
      label: selectedFunction,
    };
    setTokens([...tokens, newToken]);
    updateFormula([...tokens, newToken]);
    setSelectedFunction("");
  };

  const addOperator = () => {
    if (!selectedOperator) return;
    const newToken: FormulaToken = {
      type: "operator",
      value: selectedOperator,
      label: selectedOperator,
    };
    setTokens([...tokens, newToken]);
    updateFormula([...tokens, newToken]);
    setSelectedOperator("");
  };

  const addNumber = () => {
    if (!numberInput) return;
    const newToken: FormulaToken = {
      type: "number",
      value: numberInput,
      label: numberInput,
    };
    setTokens([...tokens, newToken]);
    updateFormula([...tokens, newToken]);
    setNumberInput("");
  };

  const addText = () => {
    if (!textInput) return;
    const newToken: FormulaToken = {
      type: "text",
      value: `"${textInput}"`,
      label: textInput,
    };
    setTokens([...tokens, newToken]);
    updateFormula([...tokens, newToken]);
    setTextInput("");
  };

  const addLookup = () => {
    if (!selectedLookupTable) return;
    const table = availableLookupTables.find((t) => t.id === selectedLookupTable);
    if (table) {
      const tableName = table.tableName || table.name;
      if (!tableName) return;
      const newToken: FormulaToken = {
        type: "lookup",
        value: `LOOKUP(${tableName}, , )`,
        label: `LOOKUP(${tableName})`,
      };
      setTokens([...tokens, newToken]);
      updateFormula([...tokens, newToken]);
      setSelectedLookupTable("");
    }
  };

  const removeToken = (index: number) => {
    const newTokens = tokens.filter((_, i) => i !== index);
    setTokens(newTokens);
    updateFormula(newTokens);
  };

  const updateFormula = (newTokens: FormulaToken[]) => {
    const formulaStr = newTokens.map((t) => t.value).join(" ");
    setFormula(formulaStr);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(formula);
  };

  const handleSave = () => {
    if (formula.trim()) {
      onSave(formula);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Formula Wizard</DialogTitle>
          <DialogDescription>
            Build formulas visually by selecting fields, functions, and operators
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6">
          {/* Left side: Builder */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-2">Add Fields</h3>
              <div className="flex gap-2">
                <Select value={selectedField} onValueChange={setSelectedField}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select field..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFields.map((field) => (
                      <SelectItem key={field.name} value={field.name}>
                        {field.name} ({field.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={addField} size="sm" variant="outline">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Add Functions</h3>
              <div className="flex gap-2">
                <Select value={selectedFunction} onValueChange={setSelectedFunction}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select function..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFunctions.map((fn) => {
                      const funcDef = AVAILABLE_FUNCTIONS.find((f) => f.name === fn);
                      return (
                        <SelectItem key={fn} value={fn}>
                          {fn} {funcDef ? ` - ${funcDef.description}` : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Button onClick={addFunction} size="sm" variant="outline">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Add Operators</h3>
              <div className="flex gap-2 flex-wrap">
                {OPERATORS.map((op) => (
                  <Button
                    key={op}
                    size="sm"
                    variant={selectedOperator === op ? "default" : "outline"}
                    onClick={() => {
                      const newToken: FormulaToken = {
                        type: "operator",
                        value: op,
                        label: op,
                      };
                      setTokens([...tokens, newToken]);
                      updateFormula([...tokens, newToken]);
                    }}
                  >
                    {op}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Add Numbers</h3>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Enter number..."
                  value={numberInput}
                  onChange={(e) => setNumberInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addNumber();
                  }}
                  step="0.01"
                />
                <Button onClick={addNumber} size="sm" variant="outline">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Add Text</h3>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Enter text..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addText();
                  }}
                />
                <Button onClick={addText} size="sm" variant="outline">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {availableLookupTables.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Add Lookup</h3>
                <div className="flex gap-2">
                  <Select
                    value={selectedLookupTable}
                    onValueChange={setSelectedLookupTable}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select lookup table..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableLookupTables.map((table) => (
                        <SelectItem key={table.id} value={table.id}>
                          {table.tableName || table.name} {table.category ? `(${table.category})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={addLookup} size="sm" variant="outline">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Right side: Formula preview and tokens */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-2">Formula</h3>
              <div className="bg-gray-50 border rounded p-3 min-h-[80px]">
                <code className="text-sm font-mono break-words">{formula || "No formula yet"}</code>
              </div>
              <Button onClick={copyToClipboard} size="sm" className="mt-2 w-full" variant="outline">
                <Copy className="w-4 h-4 mr-2" />
                Copy Formula
              </Button>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Formula Tokens ({tokens.length})</h3>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {tokens.length === 0 ? (
                  <p className="text-xs text-gray-500">Add tokens using the builder on the left</p>
                ) : (
                  tokens.map((token, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded px-3 py-2"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-xs font-semibold text-blue-600 whitespace-nowrap">
                          {token.type}
                        </span>
                        <span className="text-sm truncate">{token.label || token.value}</span>
                      </div>
                      <Button
                        onClick={() => removeToken(index)}
                        size="sm"
                        variant="ghost"
                        className="ml-2"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <h4 className="text-xs font-semibold mb-2 text-blue-900">Tips</h4>
              <ul className="text-xs text-blue-800 space-y-1">
                <li>• Use fields like $&#123;fieldName&#125; to reference questionnaire fields</li>
                <li>• Operators connect values: +, -, *, /, =, !=, &gt;, &lt;, etc.</li>
                <li>• Functions perform calculations: SUM, MULTIPLY, IF, MAX, MIN, etc.</li>
                <li>• LOOKUP() retrieves values from lookup tables</li>
                <li>• Build complex formulas by combining tokens</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!formula.trim()}>
            Save Formula
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
