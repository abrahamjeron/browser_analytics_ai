import { SessionTracker } from "./lib/sessionTracker";
import { appendArrayItem } from "./lib/storage";
import { TriggerEngine, defaultTriggerConfig } from "./lib/triggerEngine";

const tracker = new SessionTracker();
const engine = new TriggerEngine(defaultTriggerConfig);

const EVENT_KEY = "eventLog";
const PROMPT_KEY = "promptLog";

const parseDomain = (url?: string): string | null => {
  if (!url) {
    return null;
  }
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
};

const logEvent = async (event: Record<string, unknown>): Promise<void> => {
  await appendArrayItem(EVENT_KEY, event);
};

const logPrompt = async (prompt: Record<string, unknown>): Promise<void> => {
  await appendArrayItem(PROMPT_KEY, prompt);
};

const evaluateTriggers = async (now: number): Promise<void> => {
  const context = {
    now,
    previousSession: tracker.getPreviousSession(),
    currentSession: tracker.getCurrentSession(),
    activeMsLastHour: tracker.getActiveDurationMs(60 * 60 * 1000, now),
    activeMsSinceStart: tracker.getActiveDurationSinceStart(now),
    switchesLast2Min: tracker.getSwitchCount(2 * 60 * 1000, now)
  };
  const trigger = engine.evaluate(context);
  if (!trigger) {
    return;
  }
  engine.recordPrompt(now, false);
  await logPrompt({
    timestamp: now,
    type: trigger,
    context
  });
};

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  const domain = parseDomain(tab.url);
  if (!domain) {
    return;
  }
  const now = Date.now();
  tracker.startOrSwitchSession({ tabId, domain, timestamp: now });
  await logEvent({
    type: "tab_activated",
    timestamp: now,
    tabId,
    domain
  });
  await evaluateTriggers(now);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url) {
    return;
  }
  const domain = parseDomain(changeInfo.url);
  if (!domain) {
    return;
  }
  const now = Date.now();
  tracker.startOrSwitchSession({ tabId, domain, timestamp: now });
  await logEvent({
    type: "tab_updated",
    timestamp: now,
    tabId,
    domain
  });
  await evaluateTriggers(now);
});

chrome.idle.onStateChanged.addListener(async (state) => {
  const now = Date.now();
  const ended = tracker.setIdle(state !== "active", now);
  if (ended) {
    await logEvent({
      type: "idle_end_session",
      timestamp: now,
      domain: ended.domain,
      durationMs: ended.durationMs
    });
  }
});
