import { describe, expect, it } from "vitest";
import type { AppInfo } from "../types";

describe("AppInfo contract", () => {
  it("describes the desktop bridge response", () => {
    const info: AppInfo = { name: "LocalView", version: "0.1.0", environment: "development" };
    expect(info.name).toBe("LocalView");
    expect(info.environment).toBe("development");
  });
});
