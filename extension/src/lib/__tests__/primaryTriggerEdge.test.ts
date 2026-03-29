import { describe, expect, it } from "vitest";
import { TriggerEngine, defaultTriggerConfig } from "../triggerEngine";
import type { TriggerContext } from "../types";

const minute = 60 * 1000;

const baseContext = (overrides: Partial<TriggerContext> = {}): TriggerContext => ({
  now: 0,
  previousSession: null,
  currentSession: null,
  activeMsLastHour: 0,
  activeMsSinceStart: 0,
  switchesLast2Min: 0,
  ...overrides
});

describe("TriggerEngine primary edge cases", () => {
  it("does not fire primary without session switch", () => {
    const engine = new TriggerEngine(defaultTriggerConfig);
    const context = baseContext({
      now: 20 * minute,
      previousSession: {
        tabId: 1,
        domain: "a.com",
        startTime: 0,
        endTime: 10 * minute,
        durationMs: 10 * minute
      },
      currentSession: {
        tabId: 2,
        domain: "a.com",
        startTime: 10 * minute,
        endTime: 20 * minute,
        durationMs: 10 * minute
      },
      activeMsLastHour: 20 * minute
    });
    expect(engine.evaluate(context)).toBeNull();
  });
});
