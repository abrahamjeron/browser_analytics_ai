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

describe("TriggerEngine ignored streak reset", () => {
  it("resets ignored streak after accepted prompt", () => {
    const engine = new TriggerEngine(defaultTriggerConfig);
    engine.recordPrompt(0, true);
    engine.recordPrompt(30 * minute, true);
    engine.recordPrompt(60 * minute, false);
    const context = baseContext({
      now: 200 * minute,
      switchesLast2Min: 3
    });
    expect(engine.evaluate(context)).toBe("secondary");
  });
});
