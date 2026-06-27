import { describe, expect, it } from "vitest";
import { parseOptionalPositiveDecimal, parseOptionalPositiveInteger } from "./form-numbers";

describe("form-numbers", () => {
  it("parses positive integers strictly", () => {
    expect(parseOptionalPositiveInteger("12")).toBe(12);
    expect(parseOptionalPositiveInteger("1e2")).toBeUndefined();
    expect(parseOptionalPositiveInteger("12.5")).toBeUndefined();
    expect(parseOptionalPositiveInteger("0")).toBeUndefined();
  });

  it("parses positive decimals strictly", () => {
    expect(parseOptionalPositiveDecimal("12.5")).toBe(12.5);
    expect(parseOptionalPositiveDecimal("0.75")).toBe(0.75);
    expect(parseOptionalPositiveDecimal("1e2")).toBeUndefined();
    expect(parseOptionalPositiveDecimal("12.5abc")).toBeUndefined();
  });
});
