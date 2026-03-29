import { describe, expect, it } from "vitest";
import { SessionTracker } from "../sessionTracker";

const minute = 60 * 1000;

describe("SessionTracker idle", () => {
  it("ends session on idle", () => {
    const tracker = new SessionTracker();
    tracker.startOrSwitchSession({ tabId: 1, domain: "a.com", timestamp: 0 });
    const ended = tracker.setIdle(true, 3 * minute);
    expect(ended?.durationMs).toBe(3 * minute);
  });
});
