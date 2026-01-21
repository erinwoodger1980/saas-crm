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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMemo, useState, useEffect } from "react";
import { Plus, Trash2, Copy } from "lucide-react";

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
  availableLookupTables: Array<{ id: string; tableName?: string; name?: string; category?: string; columns?: string[] }>;
  availableFunctions?: string[];
}

const AVAILABLE_FUNCTIONS = [
  { name: "SUM", description: "Add numbers: SUM(a, b, c)" },
  { name: "MULTIPLY", description: "Multiply numbers: MULTIPLY(a, b)" },
  { name: "DIVIDE", description: "Divide: DIVIDE(a, b)" },
  { name: "SUBTRACT", description: "Subtract: SUBTRACT(a, b)" },
  { name: "AND", description: "All true: AND(a, b, c)" },
  { name: "OR", description: "Any true: OR(a, b, c)" },
  { name: "IF", description: "Conditional: IF(condition, true_value, false_value)" },
  { name: "MAX", description: "Maximum: MAX(a, b, c)" },
  { name: "MIN", description: "Minimum: MIN(a, b, c)" },
  { name: "ROUND", description: "Round: ROUND(number, decimals)" },
  { name: "CEIL", description: "Round up: CEIL(number)" },
  { name: "FLOOR", description: "Round down: FLOOR(number)" },
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
  const [lookupMatches, setLookupMatches] = useState<Array<{ tableColumn: string; fieldName: string }>>([
    { tableColumn: "", fieldName: "" },
  ]);
  const [lookupReturnColumn, setLookupReturnColumn] = useState<string>("");
  const [numberInput, setNumberInput] = useState<string>("");
  const [textInput, setTextInput] = useState<string>("");

  const [aiPrompt, setAiPrompt] = useState<string>("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNotes, setAiNotes] = useState<string>("");
  const [aiIssues, setAiIssues] = useState<string[]>([]);

  const sortedAvailableFields = useMemo(() => {
    return [...(availableFields || [])].sort((a, b) =>
      String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { sensitivity: 'base' })
    );
  }, [availableFields]);

  const sortedAvailableFunctions = useMemo(() => {
    return [...(availableFunctions || [])]
      .filter((fn) => fn && fn !== 'LOOKUP')
      .sort((a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: 'base' }));
  }, [availableFunctions]);

  const sortedAvailableLookupTables = useMemo(() => {
    return [...(availableLookupTables || [])].sort((a, b) => {
      const an = String(a?.tableName || a?.name || '');
      const bn = String(b?.tableName || b?.name || '');
      return an.localeCompare(bn, undefined, { sensitivity: 'base' });
    });
  }, [availableLookupTables]);

  const selectedLookupTableObj = useMemo(
    () => (availableLookupTables || []).find((t) => t.id === selectedLookupTable),
    [availableLookupTables, selectedLookupTable]
  );

  const lookupTableColumns = useMemo(
    () => (Array.isArray(selectedLookupTableObj?.columns) ? selectedLookupTableObj!.columns! : []),
    [selectedLookupTableObj]
  );

  const sortedLookupTableColumns = useMemo(() => {
    return [...(lookupTableColumns || [])].sort((a, b) =>
      String(a).localeCompare(String(b), undefined, { sensitivity: 'base' })
    );
  }, [lookupTableColumns]);

  // Parse formula into tokens on load
  useEffect(() => {
    if (initialFormula) {
      setFormula(initialFormula);
      parseFormula(initialFormula);
    }
  }, [initialFormula, isOpen]);

  useEffect(() => {
    // keep token list somewhat in sync when user types directly
    if (!isOpen) return;
    parseFormula(formula);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formula, isOpen]);

  const parseFormula = (f: string) => {
    // Simple parser - would need to be enhanced for complex formulas
    const newTokens: FormulaToken[] = [];
    const parts = f.match(/\$\{[\w.]+\}|[A-Z_]+\(|[()\s,]+|[+\-*/=!><&|]+|"[^"]*"|'[^']*'|\d+(\.\d+)?|[a-zA-Z_]\w*/g) || [];

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

      const conditions = lookupMatches
        .map((m) => {
          const col = String(m.tableColumn || "").trim();
          const field = String(m.fieldName || "").trim();
          if (!col || !field) return null;
          return `${col}=\${${field}}`;
        })
        .filter(Boolean)
        .join("&");

      const returnCol = String(lookupReturnColumn || "").trim();
      if (!returnCol) return;

      const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\"/g, '\\"');
      const newToken: FormulaToken = {
        type: "lookup",
        value: `LOOKUP("${esc(tableName)}", "${esc(conditions)}", "${esc(returnCol)}")`,
        label: `LOOKUP(${tableName})`,
      };
      setTokens([...tokens, newToken]);
      updateFormula([...tokens, newToken]);
      setSelectedLookupTable("");
      setLookupMatches([{ tableColumn: "", fieldName: "" }]);
      setLookupReturnColumn("");
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

  async function callAi(mode: "generate" | "check") {
    try {
      setAiBusy(true);
      setAiNotes("");
      setAiIssues([]);
      const res = await fetch('/api/ai/formula-helper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          prompt: aiPrompt,
          formula,
          availableFields,
          availableLookupTables,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setAiNotes(json?.error || 'AI request failed');
        return;
      }

      const nextFormula = typeof json.formula === 'string' ? json.formula.trim() : '';
      const notes = typeof json.notes === 'string' ? json.notes : '';
      const issues = Array.isArray(json.issues) ? json.issues.map((s: any) => String(s)).filter(Boolean) : [];
      const suggestedFix = typeof json.suggestedFix === 'string' ? json.suggestedFix.trim() : '';

      setAiNotes(notes);
      setAiIssues(issues);

      if (mode === 'generate' && nextFormula) {
        setFormula(nextFormula);
      }
      if (mode === 'check' && issues.length && suggestedFix) {
        // don't auto-overwrite; provide as note
        setAiNotes((prev) => `${prev ? prev + "\n\n" : ""}Suggested fix:\n${suggestedFix}`);
      }
    } catch (e: any) {
      setAiNotes(e?.message || 'AI request failed');
    } finally {
      setAiBusy(false);
    }
  }

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
                    {sortedAvailableFields.map((field) => (
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
              <p className="text-xs text-slate-500 mb-2">For math/text functions. Use the Lookup section below for LOOKUP.</p>
              <div className="flex gap-2">
                <Select value={selectedFunction} onValueChange={setSelectedFunction}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select function..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedAvailableFunctions.map((fn) => {
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
                <h3 className="text-sm font-semibold mb-2">Lookup</h3>
                <p className="text-xs text-slate-500 mb-2">Build a LOOKUP by choosing match columns and a return column.</p>
                <div className="flex gap-2 items-start">
                  <Select
                    value={selectedLookupTable}
                    onValueChange={setSelectedLookupTable}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select lookup table..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sortedAvailableLookupTables.map((table) => (
                        <SelectItem key={table.id} value={table.id}>
                          {table.tableName || table.name} {table.category ? `(${table.category})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={addLookup}
                    size="sm"
                    variant="outline"
                    disabled={
                      !selectedLookupTable ||
                      !lookupReturnColumn ||
                      lookupMatches.some((m) => !String(m.tableColumn || "").trim() || !String(m.fieldName || "").trim())
                    }
                    title="Add this lookup to the formula"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {selectedLookupTable && (
                  <div className="mt-3 space-y-3 rounded-md border p-3">
                    <div>
                      <div className="text-xs font-semibold mb-2">Match columns</div>
                      <div className="space-y-2">
                        {lookupMatches.map((m, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <Select
                              value={m.tableColumn}
                              onValueChange={(v) =>
                                setLookupMatches((prev) => prev.map((x, i) => (i === idx ? { ...x, tableColumn: v } : x)))
                              }
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Lookup table column..." />
                              </SelectTrigger>
                              <SelectContent>
                                {sortedLookupTableColumns.map((c) => (
                                  <SelectItem key={c} value={c}>
                                    {c}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <Select
                              value={m.fieldName}
                              onValueChange={(v) =>
                                setLookupMatches((prev) => prev.map((x, i) => (i === idx ? { ...x, fieldName: v } : x)))
                              }
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Match to field..." />
                              </SelectTrigger>
                              <SelectContent>
                                {sortedAvailableFields.map((field) => (
                                  <SelectItem key={field.name} value={field.name}>
                                    {field.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setLookupMatches((prev) =>
                                  prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)
                                );
                              }}
                              disabled={lookupMatches.length <= 1}
                              title="Remove match"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLookupMatches((prev) => [...prev, { tableColumn: "", fieldName: "" }])}
                          disabled={lookupTableColumns.length === 0}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add match
                        </Button>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold mb-2">Return column</div>
                      <Select value={lookupReturnColumn} onValueChange={setLookupReturnColumn}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select return column..." />
                        </SelectTrigger>
                        <SelectContent>
                          {sortedLookupTableColumns.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right side: Formula preview and tokens */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-2">Formula</h3>
              <Textarea
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                placeholder="Type a formula here (recommended for IF / complex formulas)…"
                className="font-mono text-sm"
                rows={6}
              />
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
                <li>• Use the Lookup section to add LOOKUP()</li>
                <li>• Build complex formulas by combining tokens</li>
              </ul>
            </div>

            <div className="border rounded p-3">
              <h4 className="text-sm font-semibold mb-2">AI Helper</h4>
              <p className="text-xs text-slate-500 mb-2">Describe what you want in plain English; AI will suggest a formula using available fields and lookup tables.</p>
              <Textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder='e.g. "If Doorset Type is Doorset then add 10% to Line Price; otherwise use Line Price"'
                rows={3}
              />
              <div className="flex gap-2 mt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={aiBusy || !aiPrompt.trim()}
                  onClick={() => callAi('generate')}
                >
                  Generate Formula
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={aiBusy || !formula.trim()}
                  onClick={() => callAi('check')}
                >
                  Check Formula
                </Button>
              </div>

              {(aiNotes || aiIssues.length > 0) && (
                <div className="mt-3 bg-slate-50 border rounded p-2 text-xs whitespace-pre-wrap">
                  {aiIssues.length > 0 && (
                    <div className="mb-2">
                      <div className="font-semibold">Issues</div>
                      <ul className="list-disc pl-5">
                        {aiIssues.map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {aiNotes && (
                    <div>
                      <div className="font-semibold">Notes</div>
                      <div>{aiNotes}</div>
                    </div>
                  )}
                </div>
              )}
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
