import { expect, test, describe, beforeAll } from "bun:test";
import { mathTool } from "../src/tools/math";
import { getRegisteredTools } from "../src/tools/registry";
import { TOOL_CONTRACTS } from "../src/tools/contracts";

describe("Math Tool", () => {
  test("Basic arithmetic", async () => {
    const result = await mathTool("248 * 37 + 9");
    expect(result.success).toBe(true);
    expect(result.result).toBe("9185");
    expect(result.numericResult).toBe(9185);
  });

  test("Order of operations", async () => {
    const result1 = await mathTool("2 + 3 * 4");
    expect(result1.result).toBe("14");

    const result2 = await mathTool("(2 + 3) * 4");
    expect(result2.result).toBe("20");
  });

  test("Scientific functions", async () => {
    const result = await mathTool("sin(pi / 6)");
    expect(result.success).toBe(true);
    // mathjs sin(pi/6) might have small drift
    expect(result.result).toBe("0.5");
    expect(result.numericResult).toBeCloseTo(0.5, 10);
  });

  test("Logarithms", async () => {
    const result = await mathTool("log(1000, 10)");
    expect(result.result).toBe("3");
  });

  test("Statistical functions", async () => {
    const result = await mathTool("mean([12, 45, 33, 28, 51])");
    expect(result.result).toBe("33.8");
  });

  test("Unit conversion", async () => {
    const result = await mathTool("100 km to miles");
    expect(result.success).toBe(true);
    expect(result.result).toContain("miles");
    expect(result.result).toContain("62.13711922"); // Default precision 10 sig figs
  });

  test("Percentage", async () => {
    const result = await mathTool("15% of 340");
    expect(result.success).toBe(true);
    expect(result.result).toBe("51");
  });

  test("Multi-step expression", async () => {
    // (sqrt(2^10 + 144) - 4) / 3 = (sqrt(1168) - 4) / 3 = (34.176015 - 4) / 3 = 10.05867166
    const result = await mathTool("(sqrt(2^10 + 144) - 4) / 3");
    expect(result.result).toBe("10.05867166");
  });

  test("Large numbers (Scientific notation)", async () => {
    const result = await mathTool("10^16");
    expect(result.result).toBe("1e+16");
  });

  test("Small numbers (Scientific notation)", async () => {
    const result = await mathTool("10^-11");
    expect(result.result).toBe("1e-11");
  });

  test("Division by zero", async () => {
    const result = await mathTool("100 / 0");
    expect(result.success).toBe(false);
    expect(result.status).toBe("division_by_zero");
  });

  test("Empty expression", async () => {
    const result = await mathTool("   ");
    expect(result.success).toBe(false);
    expect(result.status).toBe("empty_expression");
  });

  test("Parse error", async () => {
    const result = await mathTool("2 + * 3");
    expect(result.success).toBe(false);
    expect(result.status).toBe("parse_error");
  });

  test("Forbidden patterns - Shell substitution", async () => {
    const result = await mathTool("$(echo 5+3)");
    expect(result.success).toBe(false);
    expect(result.status).toBe("parse_error");
    expect(result.result).toContain("disallowed pattern");
  });

  test("Forbidden patterns - Backticks", async () => {
    const result = await mathTool("`ls` + 1");
    expect(result.success).toBe(false);
    expect(result.status).toBe("parse_error");
  });

  test("Forbidden patterns - Pipes", async () => {
    const result = await mathTool("1 | bc");
    expect(result.success).toBe(false);
    expect(result.status).toBe("parse_error");
  });

  test("Registry integration", () => {
    expect(getRegisteredTools()).toContain("math");
    const contract = TOOL_CONTRACTS.find(c => c.name === "math");
    expect(contract).toBeDefined();
  });
});
