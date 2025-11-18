"use client";

import { useState } from "react";
import { Calculator, Info } from "lucide-react";
import {
  calculateDerivedDimensions,
  type DoorCostingInput,
  type DerivedDimensions,
  type LeafConfiguration,
} from "@/lib/costing/derived-dimensions";
import {
  SampleDimensionRules,
  FRAME_TYPES,
  FRAME_MATERIALS,
  FIRE_RATINGS,
  CORE_TYPES,
} from "@/lib/costing/sample-rules";

const LEAF_CONFIGURATIONS: { value: LeafConfiguration; label: string }[] = [
  { value: "Leaf Only", label: "Leaf Only" },
  { value: "Single", label: "Single Door" },
  { value: "Leaf & a Half", label: "Leaf & a Half" },
  { value: "Double", label: "Double Door" },
];

export default function CostingCalculatorPage() {
  const [input, setInput] = useState<DoorCostingInput>({
    doorsetType: "New Build",
    frameWidthMm: 926,
    frameHeightMm: 2040,
    frameType: "Standard",
    leafConfiguration: "Single",
    numberOfLeaves: 1,
    numberOfSidelight1: 0,
    sidelight1WidthMm: null,
    numberOfSidelight2: 0,
    sidelight2WidthMm: null,
    fanlightQty: 0,
    fanlightHeightMm: null,
    wallThicknessMm: 150,
    frameMaterial: "MDF",
    liningThicknessJambsMm: 25,
    liningThicknessHeadsMm: 25,
    doorUndercutMm: 10,
    masterLeafWidthMm: 826,
    masterLeafAreaM2: 1.69,
    slaveLeafAreaM2: null,
    leafWeightPerM2Kg: 18,
    coreType: "Chipboard",
    coreThicknessMm: 44,
    lippingMaterialSelected: true,
    quantity: 1,
    fireRating: "",
    acousticRatingDb: null,
  });

  const [results, setResults] = useState<DerivedDimensions | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const rules = new SampleDimensionRules();

  const handleCalculate = () => {
    const calculated = calculateDerivedDimensions(input, rules);
    setResults(calculated);
  };

  const updateInput = (field: keyof DoorCostingInput, value: any) => {
    setInput((prev) => ({ ...prev, [field]: value }));
  };

  const formatNumber = (value: number | null): string => {
    if (value === null) return "—";
    return value.toFixed(2);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Calculator className="w-8 h-8 text-blue-600" />
                Door Costing Calculator
              </h1>
              <p className="text-gray-600 mt-1">
                Calculate derived dimensions from door specifications
              </p>
            </div>
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Info className="w-4 h-4" />
              {showHelp ? "Hide" : "Show"} Help
            </button>
          </div>

          {showHelp && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">How to Use</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Enter door frame dimensions and specifications</li>
                <li>• Select frame type, material, and configuration</li>
                <li>• Click Calculate to see derived dimensions</li>
                <li>
                  • Results show opening sizes, leaf dimensions, core sizing,
                  and weights
                </li>
                <li>
                  • This tool uses sample lookup tables - production version
                  would use your database
                </li>
              </ul>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Form */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Input Specifications
            </h2>

            <div className="space-y-4">
              {/* Frame Dimensions */}
              <div className="border-b pb-4">
                <h3 className="font-medium text-gray-900 mb-3">
                  Frame Dimensions
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Frame Width (mm)
                    </label>
                    <input
                      type="number"
                      value={input.frameWidthMm || ""}
                      onChange={(e) =>
                        updateInput("frameWidthMm", Number(e.target.value) || null)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Frame Height (mm)
                    </label>
                    <input
                      type="number"
                      value={input.frameHeightMm || ""}
                      onChange={(e) =>
                        updateInput("frameHeightMm", Number(e.target.value) || null)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Wall Thickness (mm)
                    </label>
                    <input
                      type="number"
                      value={input.wallThicknessMm || ""}
                      onChange={(e) =>
                        updateInput("wallThicknessMm", Number(e.target.value) || null)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Lining Thickness (mm)
                    </label>
                    <input
                      type="number"
                      value={input.liningThicknessJambsMm || ""}
                      onChange={(e) =>
                        updateInput(
                          "liningThicknessJambsMm",
                          Number(e.target.value) || null
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Configuration */}
              <div className="border-b pb-4">
                <h3 className="font-medium text-gray-900 mb-3">Configuration</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Frame Type
                    </label>
                    <select
                      value={input.frameType || ""}
                      onChange={(e) => updateInput("frameType", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      {FRAME_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Leaf Configuration
                    </label>
                    <select
                      value={input.leafConfiguration}
                      onChange={(e) =>
                        updateInput(
                          "leafConfiguration",
                          e.target.value as LeafConfiguration
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      {LEAF_CONFIGURATIONS.map((config) => (
                        <option key={config.value} value={config.value}>
                          {config.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Frame Material
                    </label>
                    <select
                      value={input.frameMaterial || ""}
                      onChange={(e) => updateInput("frameMaterial", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      {FRAME_MATERIALS.map((mat) => (
                        <option key={mat.value} value={mat.value}>
                          {mat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fire Rating
                    </label>
                    <select
                      value={input.fireRating || ""}
                      onChange={(e) => updateInput("fireRating", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      {FIRE_RATINGS.map((rating) => (
                        <option key={rating.value} value={rating.value}>
                          {rating.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Leaf Details */}
              <div className="border-b pb-4">
                <h3 className="font-medium text-gray-900 mb-3">Leaf Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Master Leaf Width (mm)
                    </label>
                    <input
                      type="number"
                      value={input.masterLeafWidthMm || ""}
                      onChange={(e) =>
                        updateInput("masterLeafWidthMm", Number(e.target.value) || null)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Master Leaf Area (m²)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={input.masterLeafAreaM2 || ""}
                      onChange={(e) =>
                        updateInput("masterLeafAreaM2", Number(e.target.value) || null)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Leaf Weight (kg/m²)
                    </label>
                    <input
                      type="number"
                      value={input.leafWeightPerM2Kg || ""}
                      onChange={(e) =>
                        updateInput("leafWeightPerM2Kg", Number(e.target.value) || null)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Slave Leaf Area (m²)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={input.slaveLeafAreaM2 || ""}
                      onChange={(e) =>
                        updateInput("slaveLeafAreaM2", Number(e.target.value) || null)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Core & Lipping */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Core & Lipping</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Core Type
                    </label>
                    <select
                      value={input.coreType || ""}
                      onChange={(e) => updateInput("coreType", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      {CORE_TYPES.map((core) => (
                        <option key={core.value} value={core.value}>
                          {core.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Core Thickness (mm)
                    </label>
                    <input
                      type="number"
                      value={input.coreThicknessMm || ""}
                      onChange={(e) =>
                        updateInput("coreThicknessMm", Number(e.target.value) || null)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Lipping Material
                    </label>
                    <select
                      value={input.lippingMaterialSelected ? "1" : "0"}
                      onChange={(e) => updateInput("lippingMaterialSelected", e.target.value === "1")}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="0">No Lipping</option>
                      <option value="1">With Lipping</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Quantity
                    </label>
                    <input
                      type="number"
                      value={input.quantity}
                      onChange={(e) =>
                        updateInput("quantity", Number(e.target.value) || 1)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleCalculate}
              className="w-full mt-6 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              <Calculator className="w-5 h-5" />
              Calculate Dimensions
            </button>
          </div>

          {/* Results Panel */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Calculated Results
            </h2>

            {!results ? (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                  <Calculator className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>Enter specifications and click Calculate</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Opening Dimensions */}
                <div className="border-b pb-4">
                  <h3 className="font-medium text-gray-900 mb-3">
                    Opening Dimensions
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <ResultRow label="S/O Width" value={results.soWidthMm} unit="mm" />
                    <ResultRow
                      label="S/O Height"
                      value={results.soHeightMm}
                      unit="mm"
                    />
                    <ResultRow
                      label="O/F Width"
                      value={results.openingWidthMm}
                      unit="mm"
                    />
                    <ResultRow
                      label="O/F Height"
                      value={results.openingHeightMm}
                      unit="mm"
                    />
                  </div>
                </div>

                {/* Frame Details */}
                <div className="border-b pb-4">
                  <h3 className="font-medium text-gray-900 mb-3">Frame Details</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <ResultRow
                      label="Frame Thickness"
                      value={results.frameThicknessMm}
                      unit="mm"
                    />
                    <ResultRow
                      label="Extension Lining (Visible)"
                      value={results.extensionVisibleWidthMm}
                      unit="mm"
                    />
                    <ResultRow
                      label="Extension Lining (Actual)"
                      value={results.extensionActualWidthMm}
                      unit="mm"
                    />
                  </div>
                </div>

                {/* Leaf Dimensions */}
                <div className="border-b pb-4">
                  <h3 className="font-medium text-gray-900 mb-3">
                    Leaf Dimensions
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <ResultRow
                      label="Slave Leaf Width"
                      value={results.slaveLeafWidthMm}
                      unit="mm"
                    />
                    <ResultRow
                      label="Leaf Thickness"
                      value={results.leafThicknessMm}
                      unit="mm"
                    />
                    <ResultRow
                      label="Lipping Width"
                      value={results.lippingWidthMm}
                      unit="mm"
                    />
                  </div>
                </div>

                {/* Core Sizing */}
                <div className="border-b pb-4">
                  <h3 className="font-medium text-gray-900 mb-3">Core Sizing</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <ResultRow
                      label="Core Width"
                      value={results.coreWidthMm}
                      unit="mm"
                      status={results.coreSizeStatus}
                    />
                    <ResultRow
                      label="Core Height"
                      value={results.coreHeightMm}
                      unit="mm"
                      status={results.coreSizeStatus}
                    />
                  </div>
                  {results.coreSizeStatus === "CHECK_PRICE" && (
                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                      ⚠️ Non-standard core size - check pricing with supplier
                    </div>
                  )}
                  {results.coreSizeStatus === "NOT_APPLICABLE" && (
                    <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-600">
                      ℹ️ Core sizing not applicable for this configuration
                    </div>
                  )}
                </div>

                {/* Weight Calculations */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">
                    Weight Calculations
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <ResultRow
                      label="Leaf Weight Density"
                      value={results.leafWeightPerM2Kg}
                      unit="kg/m²"
                    />
                    <ResultRow
                      label="Master Leaf Weight"
                      value={results.masterLeafWeightKg}
                      unit="kg"
                    />
                    <ResultRow
                      label="Slave Leaf Weight"
                      value={results.slaveLeafWeightKg}
                      unit="kg"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultRow({
  label,
  value,
  unit,
  status,
}: {
  label: string;
  value: number | null;
  unit: string;
  status?: string | null;
}) {
  const getStatusColor = () => {
    if (!status || status === "OK") return "";
    if (status === "CHECK_PRICE") return "text-yellow-600";
    if (status === "NOT_APPLICABLE") return "text-gray-400";
    return "text-gray-500";
  };

  return (
    <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded">
      <span className="text-sm text-gray-700">{label}</span>
      <span className={`text-sm font-semibold ${getStatusColor()}`}>
        {value === null ? "—" : `${value.toFixed(1)} ${unit}`}
      </span>
    </div>
  );
}
