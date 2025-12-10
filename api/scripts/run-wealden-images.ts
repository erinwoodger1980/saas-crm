#!/usr/bin/env tsx
/**
 * Wrapper to run process-wealden-images from API context
 * (where sharp, openai, replicate are installed)
 */

import { execSync } from "child_process";
import path from "path";

const scriptPath = path.join(__dirname, "..", "..", "scripts", "process-wealden-images.ts");

console.log("Running Wealden image pipeline from API context...\n");

try {
  execSync(`tsx "${scriptPath}"`, {
    cwd: path.join(__dirname, "..", ".."),
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_PATH: path.join(__dirname, "..", "node_modules"),
    },
  });
} catch (error) {
  console.error("Pipeline failed:", error);
  process.exit(1);
}
