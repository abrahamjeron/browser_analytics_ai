import { describe, expect, it } from "vitest";
import { SessionTracker } from "../sessionTracker";

const minute = 60 * 1000;

describe("SessionTracker", () => {
  it("ends sessions on switch", () => {
    const tracker = new SessionTracker();
    tracker.startOrSwitchSession({ tabId: 1, domain: "a.com", timestamp: 0 });
    const ended = tracker.startOrSwitchSession({
      tabId: 2,
      domain: "b.com",
      timestamp: 5 * minute
    });
    expect(ended).not.toBeNull();
    expect(ended?.domain).toBe("a.com");
    expect(ended?.durationMs).toBe(5 * minute);
  });

  it("calculates active duration within window", () => {
    const tracker = new SessionTracker();
    tracker.startOrSwitchSession({ tabId: 1, domain: "a.com", timestamp: 0 });
    tracker.startOrSwitchSession({ tabId: 2, domain: "b.com", timestamp: 10 * minute });
    tracker.startOrSwitchSession({ tabId: 3, domain: "c.com", timestamp: 20 * minute });
    const active = tracker.getActiveDurationMs(60 * minute, 30 * minute);
    expect(active).toBe(30 * minute);
  });

  it("counts switches in a window", () => {
    const tracker = new SessionTracker();
    tracker.startOrSwitchSession({ tabId: 1, domain: "a.com", timestamp: 0 });
    tracker.startOrSwitchSession({ tabId: 2, domain: "b.com", timestamp: 1 * minute });
    tracker.startOrSwitchSession({ tabId: 3, domain: "c.com", timestamp: 2 * minute });
    tracker.startOrSwitchSession({ tabId: 4, domain: "d.com", timestamp: 3 * minute });
    const count = tracker.getSwitchCount(2 * minute, 3 * minute);
    expect(count).toBe(3);
  });
});
