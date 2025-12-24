/**
 * Parametric Formula Evaluator
 * 
 * Evaluates formulas for component positioning and sizing.
 * Formulas can reference:
 * - Product dimensions: product.width, product.height, product.depth
 * - Other components by code: FRAME_LEFT.width, RAIL_TOP.height
 * - Named variables: frameWidth, gap, tennonLength
 * - Math operations: +, -, *, /, (), abs, min, max
 * 
 * Example formulas:
 * - "product.width - FRAME_LEFT.width - FRAME_RIGHT.width + gap * 2"
 * - "RAIL_TOP.positionZ + RAIL_TOP.height + gap"
 * - "product.width - frameWidth * 2 - STILE_LEFT.width - STILE_RIGHT.width + tennonLength * 2"
 */

export interface FormulaContext {
  product: {
    width: number;
    height: number;
    depth: number;
    [key: string]: number;
  };
  components: {
    [code: string]: {
      positionX: number;
      positionY: number;
      positionZ: number;
      width: number;
      height: number;
      depth: number;
      [key: string]: number;
    };
  };
  variables: {
    [name: string]: number;
  };
}

export class FormulaEvaluator {
  private context: FormulaContext;

  constructor(context: FormulaContext) {
    this.context = context;
  }

  /**
   * Evaluate a formula string and return the computed number
   */
  evaluate(formula: string | null | undefined): number {
    if (!formula || typeof formula !== 'string') {
      return 0;
    }

    try {
      // Sanitize and prepare formula
      const sanitized = this.sanitizeFormula(formula);
      const resolved = this.resolveReferences(sanitized);
      
      // Safely evaluate mathematical expression
      return this.safeEval(resolved);
    } catch (error) {
      console.error('Formula evaluation error:', error, 'Formula:', formula);
      return 0;
    }
  }

  /**
   * Sanitize formula to prevent code injection
   */
  private sanitizeFormula(formula: string): string {
    // Remove any potential harmful code
    const cleaned = formula
      .replace(/[;&|<>]/g, '') // Remove command separators and redirects
      .replace(/\beval\b/gi, '') // Remove eval
      .replace(/\bfunction\b/gi, '') // Remove function keyword
      .replace(/\bimport\b/gi, '') // Remove import
      .replace(/\brequire\b/gi, '') // Remove require
      .trim();

    return cleaned;
  }

  /**
   * Resolve component and variable references to their numeric values
   */
  private resolveReferences(formula: string): string {
    let resolved = formula;

    // Replace product references: product.width → 800
    resolved = resolved.replace(/product\.(\w+)/g, (match, prop) => {
      const value = this.context.product[prop];
      return value !== undefined ? String(value) : '0';
    });

    // Replace component references: FRAME_LEFT.width → 45
    resolved = resolved.replace(/([A-Z_][A-Z0-9_]*)\.(\w+)/g, (match, code, prop) => {
      const component = this.context.components[code];
      if (component && component[prop] !== undefined) {
        return String(component[prop]);
      }
      return '0';
    });

    // Replace variable references: frameWidth → 45
    resolved = resolved.replace(/\b([a-z][a-zA-Z0-9]*)\b/g, (match, varName) => {
      // Check if it's a math function (abs, min, max, etc.)
      if (['abs', 'min', 'max', 'floor', 'ceil', 'round', 'sqrt', 'pow'].includes(varName.toLowerCase())) {
        return match; // Keep math functions as-is
      }

      const value = this.context.variables[varName];
      return value !== undefined ? String(value) : match;
    });

    return resolved;
  }

  /**
   * Safely evaluate a mathematical expression
   * Only allows numbers, operators, and whitelisted Math functions
   */
  private safeEval(expression: string): number {
    // Replace Math functions with Math. prefix
    const withMath = expression
      .replace(/\babs\(/g, 'Math.abs(')
      .replace(/\bmin\(/g, 'Math.min(')
      .replace(/\bmax\(/g, 'Math.max(')
      .replace(/\bfloor\(/g, 'Math.floor(')
      .replace(/\bceil\(/g, 'Math.ceil(')
      .replace(/\bround\(/g, 'Math.round(')
      .replace(/\bsqrt\(/g, 'Math.sqrt(')
      .replace(/\bpow\(/g, 'Math.pow(');

    // Validate expression only contains safe characters
    if (!/^[\d\s+\-*/.(),Math]+$/.test(withMath.replace(/Math\.\w+/g, ''))) {
      throw new Error(`Invalid characters in expression: ${expression}`);
    }

    // Use Function constructor (safer than eval) with restricted scope
    const func = new Function('Math', `"use strict"; return (${withMath});`);
    const result = func(Math);

    if (typeof result !== 'number' || !isFinite(result)) {
      throw new Error(`Expression did not evaluate to a finite number: ${expression}`);
    }

    return result;
  }

  /**
   * Extract all component references from a formula
   * Returns array of component codes that need to be evaluated first
   */
  static extractComponentDependencies(formula: string | null | undefined): string[] {
    if (!formula || typeof formula !== 'string') {
      return [];
    }

    const dependencies: string[] = [];
    const regex = /([A-Z_][A-Z0-9_]*)\.(\w+)/g;
    let match;

    while ((match = regex.exec(formula)) !== null) {
      const code = match[1];
      if (!dependencies.includes(code)) {
        dependencies.push(code);
      }
    }

    return dependencies;
  }

  /**
   * Topologically sort components based on their formula dependencies
   * Returns components in evaluation order (dependencies first)
   */
  static sortByDependencies(
    components: Array<{ code: string; formulas: string[] }>
  ): Array<{ code: string; formulas: string[] }> {
    const graph = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    // Build dependency graph
    for (const comp of components) {
      if (!inDegree.has(comp.code)) {
        inDegree.set(comp.code, 0);
      }

      const deps = new Set<string>();
      for (const formula of comp.formulas) {
        const formulaDeps = this.extractComponentDependencies(formula);
        formulaDeps.forEach(d => deps.add(d));
      }

      graph.set(comp.code, Array.from(deps));

      // Increment in-degree for each dependency
      for (const dep of deps) {
        inDegree.set(dep, (inDegree.get(dep) || 0) + 1);
      }
    }

    // Kahn's algorithm for topological sort
    const queue: string[] = [];
    const sorted: string[] = [];

    // Find all nodes with in-degree 0
    for (const [code, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(code);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);

      const deps = graph.get(current) || [];
      for (const dep of deps) {
        const newDegree = (inDegree.get(dep) || 0) - 1;
        inDegree.set(dep, newDegree);
        if (newDegree === 0) {
          queue.push(dep);
        }
      }
    }

    // Check for cycles
    if (sorted.length !== components.length) {
      console.warn('Circular dependency detected in component formulas');
      return components; // Return original order if cycle detected
    }

    // Return components in sorted order
    return sorted.map(code => components.find(c => c.code === code)!).filter(Boolean);
  }
}

/**
 * Helper to evaluate all component dimensions and positions in dependency order
 */
export function evaluateComponentTree(
  components: Array<{
    code: string;
    positionXFormula?: string | null;
    positionYFormula?: string | null;
    positionZFormula?: string | null;
    widthFormula?: string | null;
    heightFormula?: string | null;
    depthFormula?: string | null;
  }>,
  productDimensions: { width: number; height: number; depth: number },
  variables: { [name: string]: number } = {}
): Array<{
  code: string;
  positionX: number;
  positionY: number;
  positionZ: number;
  width: number;
  height: number;
  depth: number;
}> {
  // Prepare components with all formulas for sorting
  const compsWithFormulas = components.map(c => ({
    code: c.code,
    formulas: [
      c.positionXFormula,
      c.positionYFormula,
      c.positionZFormula,
      c.widthFormula,
      c.heightFormula,
      c.depthFormula
    ].filter((f): f is string => Boolean(f))
  }));

  // Sort by dependencies
  const sorted = FormulaEvaluator.sortByDependencies(compsWithFormulas);

  // Build evaluation context
  const context: FormulaContext = {
    product: productDimensions,
    components: {},
    variables
  };

  const results: Array<{
    code: string;
    positionX: number;
    positionY: number;
    positionZ: number;
    width: number;
    height: number;
    depth: number;
  }> = [];

  // Evaluate each component in order
  for (const sortedComp of sorted) {
    const comp = components.find(c => c.code === sortedComp.code);
    if (!comp) continue;

    const evaluator = new FormulaEvaluator(context);

    const evaluated = {
      code: comp.code,
      positionX: evaluator.evaluate(comp.positionXFormula),
      positionY: evaluator.evaluate(comp.positionYFormula),
      positionZ: evaluator.evaluate(comp.positionZFormula),
      width: evaluator.evaluate(comp.widthFormula),
      height: evaluator.evaluate(comp.heightFormula),
      depth: evaluator.evaluate(comp.depthFormula)
    };

    // Add to context for subsequent evaluations
    context.components[comp.code] = evaluated;
    results.push(evaluated);
  }

  return results;
}
