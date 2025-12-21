/**
 * Expression Evaluator
 * 
 * Safe evaluation of template expressions with #variable token replacement
 * Supports: + - * / ( ) and numeric literals
 * NO eval() - uses a simple recursive descent parser
 */

export interface EvaluationContext {
  globals: Record<string, number | string | boolean>;
  localOverrides?: Record<string, number | string | boolean>;
}

/**
 * Evaluate an expression string with #token replacement
 * Examples:
 *   "#pw" → globals.pw
 *   "#ph - 100" → globals.ph - 100
 *   "(#pw - #stileW * 2) / 2" → (globals.pw - globals.stileW * 2) / 2
 */
export function evaluateExpression(
  expr: string | number | boolean,
  context: EvaluationContext
): number | string | boolean {
  // If already a primitive, return it
  if (typeof expr === 'number' || typeof expr === 'boolean') {
    return expr;
  }
  
  if (typeof expr !== 'string') {
    throw new Error(`Invalid expression type: ${typeof expr}`);
  }
  
  // Trim whitespace
  expr = expr.trim();
  
  // If it's a string literal (quoted), return the string
  if ((expr.startsWith('"') && expr.endsWith('"')) || 
      (expr.startsWith("'") && expr.endsWith("'"))) {
    return expr.slice(1, -1);
  }
  
  // If it's a boolean literal
  if (expr === 'true') return true;
  if (expr === 'false') return false;
  
  // Replace #tokens with values
  const replaced = replaceTokens(expr, context);
  
  // If result is a pure number string after replacement, parse it
  const numMatch = replaced.match(/^-?\d+\.?\d*$/);
  if (numMatch) {
    return parseFloat(replaced);
  }
  
  // If it contains operators, parse as math expression
  if (/[\+\-\*\/\(\)]/.test(replaced)) {
    return parseMathExpression(replaced);
  }
  
  // Otherwise treat as string literal
  return replaced;
}

/**
 * Replace #tokens with their values from context
 */
function replaceTokens(expr: string, context: EvaluationContext): string {
  const combined = { ...context.globals, ...context.localOverrides };
  
  // Match #variableName (letters, numbers, underscores)
  return expr.replace(/#([a-zA-Z_][a-zA-Z0-9_]*)/g, (match, varName) => {
    const value = combined[varName];
    
    if (value === undefined) {
      throw new Error(`Undefined variable: ${varName} in expression "${expr}"`);
    }
    
    // Convert to string representation
    if (typeof value === 'number') {
      return value.toString();
    }
    if (typeof value === 'boolean') {
      return value ? '1' : '0';
    }
    if (typeof value === 'string') {
      // If the string is numeric, use it directly in math
      const num = parseFloat(value);
      if (!isNaN(num)) {
        return num.toString();
      }
      // Otherwise quote it (shouldn't happen in math expressions)
      return `"${value}"`;
    }
    
    throw new Error(`Invalid variable type for ${varName}: ${typeof value}`);
  });
}

/**
 * Parse and evaluate a mathematical expression
 * Supports: + - * / ( )
 * Uses recursive descent parser
 */
function parseMathExpression(expr: string): number {
  expr = expr.replace(/\s+/g, ''); // Remove all whitespace
  
  let pos = 0;
  
  function peek(): string | null {
    return pos < expr.length ? expr[pos] : null;
  }
  
  function consume(): string {
    return expr[pos++];
  }
  
  function parseNumber(): number {
    let numStr = '';
    let char = peek();
    
    // Handle negative numbers
    if (char === '-') {
      numStr += consume();
      char = peek();
    }
    
    // Parse digits and decimal point
    while (char !== null && /[\d.]/.test(char)) {
      numStr += consume();
      char = peek();
    }
    
    const num = parseFloat(numStr);
    if (isNaN(num)) {
      throw new Error(`Invalid number: ${numStr} at position ${pos}`);
    }
    
    return num;
  }
  
  function parseFactor(): number {
    const char = peek();
    
    if (char === '(') {
      consume(); // '('
      const result = parseExpression();
      if (peek() !== ')') {
        throw new Error(`Expected ')' at position ${pos}`);
      }
      consume(); // ')'
      return result;
    }
    
    if (char === '-' || (char !== null && /\d/.test(char))) {
      return parseNumber();
    }
    
    throw new Error(`Unexpected character '${char}' at position ${pos}`);
  }
  
  function parseTerm(): number {
    let result = parseFactor();
    
    while (true) {
      const char = peek();
      if (char === '*') {
        consume();
        result *= parseFactor();
      } else if (char === '/') {
        consume();
        const divisor = parseFactor();
        if (divisor === 0) {
          throw new Error('Division by zero');
        }
        result /= divisor;
      } else {
        break;
      }
    }
    
    return result;
  }
  
  function parseExpression(): number {
    let result = parseTerm();
    
    while (true) {
      const char = peek();
      if (char === '+') {
        consume();
        result += parseTerm();
      } else if (char === '-') {
        consume();
        result -= parseTerm();
      } else {
        break;
      }
    }
    
    return result;
  }
  
  const result = parseExpression();
  
  if (pos < expr.length) {
    throw new Error(`Unexpected characters after expression: ${expr.slice(pos)}`);
  }
  
  return result;
}

/**
 * Evaluate a dimension object with x, y, z expressions
 */
export function evaluateDims(
  dims: { x: string; y: string; z: string },
  context: EvaluationContext
): { x: number; y: number; z: number } {
  return {
    x: evaluateExpression(dims.x, context) as number,
    y: evaluateExpression(dims.y, context) as number,
    z: evaluateExpression(dims.z, context) as number,
  };
}

/**
 * Evaluate a position object
 */
export function evaluatePos(
  pos: { x: string; y: string; z: string },
  context: EvaluationContext
): { x: number; y: number; z: number } {
  return {
    x: evaluateExpression(pos.x, context) as number,
    y: evaluateExpression(pos.y, context) as number,
    z: evaluateExpression(pos.z, context) as number,
  };
}

/**
 * Evaluate a rotation object (optional)
 */
export function evaluateRot(
  rot: { x: string; y: string; z: string } | undefined,
  context: EvaluationContext
): { x: number; y: number; z: number } {
  if (!rot) {
    return { x: 0, y: 0, z: 0 };
  }
  
  return {
    x: evaluateExpression(rot.x, context) as number,
    y: evaluateExpression(rot.y, context) as number,
    z: evaluateExpression(rot.z, context) as number,
  };
}

/**
 * Helper to convert TemplateGlobals to simple Record for evaluation
 */
export function flattenGlobals(
  globals: Record<string, { value: number | string | boolean; [key: string]: any }>
): Record<string, number | string | boolean> {
  const result: Record<string, number | string | boolean> = {};
  
  for (const [key, config] of Object.entries(globals)) {
    result[key] = config.value;
  }
  
  return result;
}
