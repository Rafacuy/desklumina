import { create, all } from "mathjs";
import { t, tf } from "../utils/i18n";
import { logger } from "../logger";
import type { ToolExecutionResult } from "../types";

//create a restricted mathjs instance
const math = create(all as any, {
  matrix: "Array",
  number: "number",
  precision: 10,
});

const MAX_EXPRESSION_LENGTH = 2048;
const TIMEOUT_MS = 500;

/**
 * Validates the expression for forbidden shell patterns
 */
function containsForbiddenPattern(expression: string): boolean {
  const forbidden = ["$(", "$((", "`", "|", ";", ">", "<"];
  return forbidden.some((pattern) => expression.includes(pattern));
}

/**
 * Formats the numeric result according to the precision policy
 */
function formatNumericResult(value: any): string {
  if (typeof value !== "number") {
    return String(value);
  }

  const absValue = Math.abs(value);

  // Results exceeding 1e15 or below 1e-10 must be rendered in scientific notation
  if (absValue >= 1e15 || (absValue > 0 && absValue < 1e-10)) {
    return value.toExponential(9).replace(/\.0+e/, "e").replace(/(\.\d+?)0+e/, "$1e");
  }

  // Integer normalization
  if (Number.isInteger(value)) {
    return value.toString();
  }

  // Default precision: 10 significant figures
  return math.format(value, {
    precision: 10,
  });
}

/**
* Prime factorize a positive integer
* Returns formatted string e.g. "2^3 × 3 × 7"
*/
function primeFactorization(n: number): string {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error("factor() requires a positive integer");
  }
  if (n === 1) return "1";

  const factors = new Map<number, number>();
  let remaining = n;

  for (let d = 2; d * d <= remaining; d++) {
    while (remaining % d === 0) {
      factors.set(d, (factors.get(d) ?? 0) + 1);
      remaining = remaining / d;
    }
  }
  if (remaining > 1) {
    factors.set(remaining, (factors.get(remaining) ?? 0) + 1);
  }

  return [...factors.entries()]
    .map(([p, e]) => (e > 1 ? `${p}^${e}` : `${p}`))
    .join(" × ");
}

math.import({ factor: (n: number) => primeFactorization(n) }, { override: false });

/**
 * Evaluate a mathematical expression safely
 */
export async function mathTool(expression: string): Promise<ToolExecutionResult> {
  let normalizedExpression = expression.trim();

  // Support "X% of Y" syntax
  // replace "X% of " with "(X/100) * "
  if (normalizedExpression.includes("% of ")) {
    normalizedExpression = normalizedExpression.replace(/(\d+(?:\.\d+)?)%\s+of\s+/g, "($1/100) * ");
  }

  //validate non-empty
  if (!normalizedExpression) {
    return {
      tool: "math",
      result: `❌ ${t("math.error.empty_expression")}`,
      success: false,
      status: "empty_expression",
      expression: normalizedExpression,
    };
  }

  // Validate length
  if (normalizedExpression.length > MAX_EXPRESSION_LENGTH) {
    return {
      tool: "math",
      result: `❌ ${tf("math.error.input_too_long", { max: MAX_EXPRESSION_LENGTH })}`,
      success: false,
      status: "parse_error",
      expression: normalizedExpression,
    };
  }

  // Validate forbidden patterns
  if (containsForbiddenPattern(normalizedExpression)) {
    logger.warn("math", `Forbidden pattern detected in expression: ${normalizedExpression}`);
    return {
      tool: "math",
      result: `❌ ${t("math.error.forbidden_pattern")}`,
      success: false,
      status: "parse_error",
      expression: normalizedExpression,
    };
  }

  try {
    // Evaluate in a sandboxed context with timeout
    // We use a Promise to implement the timeout
    const evaluationPromise = new Promise<{ result: any; numeric?: number }>((resolve, reject) => {
      try {
        const scope = {}; //Empty scope per evaluation
        const result = math.evaluate(normalizedExpression, scope);
        
        let numericResult: number | undefined;
        if (typeof result === "number") {
          numericResult = result;
        } else if (result && typeof result.toNumber === "function") {
          numericResult = result.toNumber();
        }

        resolve({ result, numeric: numericResult });
      } catch (error) {
        reject(error);
      }
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("TIMEOUT")), TIMEOUT_MS);
    });

    const { result, numeric } = await Promise.race([evaluationPromise, timeoutPromise]) as { result: any; numeric?: number };

    // Check for division by zero or infinity
    if (numeric !== undefined && !Number.isFinite(numeric)) {
      if (numeric === Infinity || numeric === -Infinity) {
        //If the expression was something like 100 / 0, it's division by zero
        // If it's just a very large number, it might be overflow
        const isDivisionByZero = normalizedExpression.includes("/ 0") || normalizedExpression.includes("/0");
        const status = isDivisionByZero ? "division_by_zero" : "overflow";
        const reason = isDivisionByZero ? t("math.error.division_by_zero") : t("math.error.overflow");
        
        return {
          tool: "math",
          result: `❌ ${reason}`,
          success: false,
          status,
          expression: normalizedExpression,
        };
      }
    }

    //Format the result
    let formattedResult: string;
    if (result && typeof result.format === "function") {
      formattedResult = result.format();
    } else {
      formattedResult = formatNumericResult(result);
    }

    // Special handling for units
    if (result && result.value !== undefined && result.unit !== undefined) {
      formattedResult = tf("math.unit_result", {
        value: formatNumericResult(result.value),
        unit: result.unit,
      });
    }

    return {
      tool: "math",
      result: formattedResult,
      success: true,
      status: "ok",
      expression: normalizedExpression,
      numericResult: numeric,
    };

  } catch (error) {
    const err = error as any;
    
    if (err.message === "TIMEOUT") {
      logger.warn("math", `Evaluation timed out: ${normalizedExpression}`);
      return {
        tool: "math",
        result: `❌ ${t("math.error.timeout")}`,
        success: false,
        status: "timeout",
        expression: normalizedExpression,
      };
    }

    // Classify errors
    let status = "parse_error";
    let reason = tf("math.error.parse", { expression: normalizedExpression });

    if (err.message?.includes("Division by zero")) {
      status = "division_by_zero";
      reason = t("math.error.division_by_zero");
    } else if (err.message?.includes("too large") || err.message?.includes("Infinity")) {
      status = "overflow";
      reason = t("math.error.overflow");
    } else if (err.message?.includes("not supported")) {
      status = "unsupported";
      reason = tf("math.error.unsupported", { hint: err.message });
    }

    return {
      tool: "math",
      result: `❌ ${reason}`,
      success: false,
      status,
      expression: normalizedExpression,
    };
  }
}
