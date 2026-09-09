import { describe, expect, it } from "vitest";

import { healthMessage } from "./health";

describe("healthMessage", () => {
  it("reports a healthy API", () => {
    expect(healthMessage("ok")).toBe("API healthy");
  });
});
