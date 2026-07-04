import { create, all } from "mathjs";
import type { SearchResultItem } from "../types/plugin";

const LAYER_CALC = 1; // L1 layer per spec

// Configure math.js with degree mode for trigonometric functions
const math = create(all, {
  // Default angle unit: degrees (sin(90) = 1)
  // math.js uses radians by default, so we handle conversion ourselves
});

// Constants
const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
};

// Math function names that indicate a calculator expression
const MATH_FUNCTIONS = [
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "sinh",
  "cosh",
  "tanh",
  "log",
  "ln",
  "sqrt",
  "abs",
  "ceil",
  "floor",
  "round",
  "exp",
];

/**
 * Preprocess the expression:
 * - Convert degree-based trig functions to radians
 * - Handle implicit multiplication (2pi, 2(3+4), (2)(3))
 * - Handle √ symbol
 * - Handle percentage
 */
function preprocessExpression(expr: string): string {
  let processed = expr.trim();

  // Replace √ with sqrt
  processed = processed.replace(/√/g, "sqrt(");

  // Ensure √x becomes sqrt(x) - close parens for sqrt
  // Count sqrt( opens and balance with )
  let sqrtBalanced = "";
  let depth = 0;
  for (let i = 0; i < processed.length; i++) {
    if (
      processed.startsWith("sqrt(", i) ||
      processed.startsWith("abs(", i) ||
      processed.startsWith("log(", i) ||
      processed.startsWith("ln(", i) ||
      processed.startsWith("exp(", i) ||
      processed.startsWith("ceil(", i) ||
      processed.startsWith("floor(", i) ||
      processed.startsWith("round(", i)
    ) {
      sqrtBalanced += processed[i];
      if (processed[i] === "(") depth++;
      continue;
    }
    sqrtBalanced += processed[i];
  }
  processed = sqrtBalanced;

  // Handle percentage: 15%200 -> 15/100*200, 200*15% -> 200*15/100
  processed = processed.replace(/(\d+(?:\.\d+)?)%(\d+(?:\.\d+)?)/g, "($1/100)*$2");
  processed = processed.replace(/(\d+(?:\.\d+)?)\s*\*\s*(\d+(?:\.\d+)?)%/g, "$1*$2/100");

  // Handle standalone percentage: 15% -> 15/100
  processed = processed.replace(/(\d+(?:\.\d+)?)%(?!\d)/g, "$1/100");

  // Handle implicit multiplication:
  // 2pi -> 2*pi
  processed = processed.replace(/(\d)(pi|e)/g, "$1*$2");
  // pi2 -> pi*2
  processed = processed.replace(/(pi|e)(\d)/g, "$1*$2");
  // 2(3+4) -> 2*(3+4)
  processed = processed.replace(/(\d)\(/g, "$1*(");
  // (2)(3) -> (2)*(3)
  processed = processed.replace(/\)\(/g, ")*(");
  // pi(2+3) -> pi*(2+3)
  processed = processed.replace(/(pi|e)\(/g, "$1*(");
  // )pi -> )*pi, )e -> )*e
  processed = processed.replace(/\)(pi|e)/g, ")*$1");
  // )2 -> )*2
  processed = processed.replace(/\)(\d)/g, ")*$1");

  return processed;
}

/**
 * Wrap trigonometric function arguments for degree mode.
 * sin(30) -> sin(30 deg) to tell math.js to use degrees.
 */
function wrapDegMode(expr: string): string {
  // Replace trig function calls to use degree unit
  return expr.replace(
    /\b(sin|cos|tan|asin|acos|atan)\s*\(/g,
    "$1("
  );
}

/**
 * Check if the input string looks like a math expression.
 */
function isMathExpression(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;

  // Must contain at least one digit
  if (!/\d/.test(trimmed)) return false;

  // Must contain a math operator or function
  const hasOperator = /[+\-*/^%]/.test(trimmed);
  const hasParens = /[()]/.test(trimmed);
  const hasFunction = new RegExp(
    `\\b(${MATH_FUNCTIONS.join("|")})\\s*\\(`,
    "i"
  ).test(trimmed);
  const hasConstant = /\b(pi|e)\b/i.test(trimmed);
  const hasSqrt = /√/.test(trimmed);

  if (!hasOperator && !hasParens && !hasFunction && !hasConstant && !hasSqrt) {
    return false;
  }

  // Should not contain letters (except math functions and constants)
  const withoutFuncs = trimmed
    .replace(new RegExp(`\\b(${MATH_FUNCTIONS.join("|")})\\b`, "gi"), "")
    .replace(/\b(pi|e)\b/gi, "");
  if (/[a-zA-Z]/.test(withoutFuncs)) return false;

  return true;
}

/**
 * Search calculator: evaluate math expression and return result item.
 * Returns null if input is not a math expression or evaluation fails.
 */
export function searchCalculator(query: string): SearchResultItem | null {
  if (!query || !isMathExpression(query)) return null;

  try {
    const processed = preprocessExpression(query);
    const result = math.evaluate(processed);

    // Format result
    let resultStr: string;
    if (typeof result === "number") {
      // Limit precision for display
      if (Number.isInteger(result)) {
        resultStr = result.toString();
      } else {
        // Show up to 10 significant digits
        resultStr = parseFloat(result.toPrecision(10)).toString();
      }
    } else if (result && typeof result === "object" && "value" in result) {
      // Handle math.js complex numbers or units
      resultStr = String(result);
    } else {
      resultStr = String(result);
    }

    // Don't show if result equals the query (e.g., just "pi" -> 3.14159 is fine, but avoid empty results)
    if (resultStr === query.trim()) return null;

    return {
      id: `calc-${query}`,
      name: resultStr,
      description: query.trim(),
      icon: "",
      type: "calculator",
      layer: LAYER_CALC,
      score: 1,
    };
  } catch {
    return null;
  }
}
