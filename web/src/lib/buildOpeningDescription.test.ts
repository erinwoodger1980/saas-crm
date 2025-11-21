import assert from "node:assert/strict";
import { buildOpeningDescription } from "./buildOpeningDescription";

const result = buildOpeningDescription(
  {
    productType: "casement window",
    colour: "white",
    glazingStyle: "astragal bars",
    description: null,
  },
  {
    timber: "Painted Accoya",
    glass: "Double glazed",
    ironmongery: "Satin chrome",
    finish: "Factory-painted RAL 9016",
  }
);

assert.equal(
  result,
  "Painted Accoya casement window, white, Double glazed with astragal bars, Satin chrome ironmongery, Factory-painted RAL 9016."
);

console.log("buildOpeningDescription test passed");
