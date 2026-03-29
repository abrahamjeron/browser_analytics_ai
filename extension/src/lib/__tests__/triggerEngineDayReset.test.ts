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

describe("TriggerEngine day reset", () => {
  it("resets count on new day", () => {
    const engine = new TriggerEngine(defaultTriggerConfig);
    engine.recordPrompt(Date.UTC(2026, 0, 1, 10, 0, 0), false);
    engine.recordPrompt(Date.UTC(2026, 0, 1, 11, 0, 0), false);

    const nextDay = Date.UTC(2026, 0, 2, 10, 0, 0);
    const context = baseContext({
      now: nextDay,
      switchesLast2Min: 3
    });

    expect(engine.evaluate(context)).toBe("secondary");
  });
});
