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

describe("TriggerEngine", () => {
  it("fires primary trigger on long session switch", () => {
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
        domain: "b.com",
        startTime: 10 * minute,
        endTime: 20 * minute,
        durationMs: 10 * minute
      },
      activeMsLastHour: 20 * minute
    });
    expect(engine.evaluate(context)).toBe("primary");
  });

  it("fires secondary trigger on rapid switches", () => {
    const engine = new TriggerEngine(defaultTriggerConfig);
    const context = baseContext({
      now: 5 * minute,
      switchesLast2Min: 3
    });
    expect(engine.evaluate(context)).toBe("secondary");
  });

  it("fires backup trigger after inactivity", () => {
    const engine = new TriggerEngine(defaultTriggerConfig);
    const context = baseContext({
      now: 120 * minute,
      activeMsSinceStart: 120 * minute
    });
    expect(engine.evaluate(context)).toBe("backup");
  });

  it("respects min gap between prompts", () => {
    const engine = new TriggerEngine(defaultTriggerConfig);
    engine.recordPrompt(0, false);
    const context = baseContext({
      now: 10 * minute,
      switchesLast2Min: 3
    });
    expect(engine.evaluate(context)).toBeNull();
  });

  it("respects max per day", () => {
    const engine = new TriggerEngine(defaultTriggerConfig);
    for (let i = 0; i < defaultTriggerConfig.maxPerDay; i += 1) {
      engine.recordPrompt(i * minute, false);
    }
    const context = baseContext({
      now: 200 * minute,
      switchesLast2Min: 3
    });
    expect(engine.evaluate(context)).toBeNull();
  });

  it("suppresses after ignored streak", () => {
    const engine = new TriggerEngine(defaultTriggerConfig);
    engine.recordPrompt(0, true);
    engine.recordPrompt(30 * minute, true);
    const context = baseContext({
      now: 200 * minute,
      switchesLast2Min: 3
    });
    expect(engine.evaluate(context)).toBeNull();
  });
});
