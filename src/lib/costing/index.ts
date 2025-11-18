// Core calculation modules
export * from "./derived-dimensions";
export * from "./apertures-and-glass";
export * from "./sample-aperture-rules";

// High-level orchestration (exports unified DoorCostingInput)
export {
  type DoorCostingInput,
  type DoorCostingRules,
  type DoorCostingContext,
  type CostingWarnings,
  calculateDoorCostingContext,
  hasBlockingWarnings,
  getWarningMessages,
} from "./door-costing-engine";
