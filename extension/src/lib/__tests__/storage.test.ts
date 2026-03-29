import { describe, expect, it } from "vitest";
import { appendArrayItem, storage } from "../storage";

describe("storage", () => {
  it("appends items to arrays", async () => {
    await storage.set({});
    const result = await appendArrayItem("eventLog", { id: 1 });
    expect(result.length).toBe(1);
    const result2 = await appendArrayItem("eventLog", { id: 2 });
    expect(result2.length).toBe(2);
  });
});
