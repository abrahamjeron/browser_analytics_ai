export type TriggerType = "primary" | "secondary" | "backup";

export interface Session {
  tabId: number;
  domain: string;
  startTime: number;
  endTime: number;
  durationMs: number;
}

export interface SwitchEvent {
  timestamp: number;
  fromDomain: string;
  toDomain: string;
}

export interface TriggerContext {
  now: number;
  previousSession: Session | null;
  currentSession: Session | null;
  activeMsLastHour: number;
  activeMsSinceStart: number;
  switchesLast2Min: number;
}

export interface TriggerState {
  lastPromptAt: number | null;
  ignoredStreak: number;
  triggersToday: number;
  lastPromptDayKey: string | null;
}

export interface TriggerConfig {
  minSessionMs: number;
  minActiveMsLastHour: number;
  secondarySwitchCount: number;
  secondaryWindowMs: number;
  backupNoPromptMs: number;
  maxPerDay: number;
  minGapMs: number;
  suppressAfterIgnored: number;
}
