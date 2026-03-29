import { describe, expect, it } from "vitest";
import { SessionTracker } from "../sessionTracker";

const minute = 60 * 1000;

describe("SessionTracker active start", () => {
  it("tracks active duration since start", () => {
    const tracker = new SessionTracker();
    tracker.startOrSwitchSession({ tabId: 1, domain: "a.com", timestamp: 0 });
    const active = tracker.getActiveDurationSinceStart(45 * minute);
    expect(active).toBe(45 * minute);
  });
});
