import { describe, expect, it } from "vitest";
import { parseSmtpPort } from "./email.js";

describe("email", () => {
  it("parses smtp ports strictly and falls back on invalid input", () => {
    expect(parseSmtpPort(undefined)).toBe(587);
    expect(parseSmtpPort("587")).toBe(587);
    expect(parseSmtpPort("465")).toBe(465);
    expect(parseSmtpPort("1e2")).toBe(587);
    expect(parseSmtpPort("465xyz")).toBe(587);
  });
});
