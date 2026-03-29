import type { TriggerConfig, TriggerContext, TriggerState, TriggerType } from "./types";

export const defaultTriggerConfig: TriggerConfig = {
  minSessionMs: 5 * 60 * 1000,
  minActiveMsLastHour: 15 * 60 * 1000,
  secondarySwitchCount: 3,
  secondaryWindowMs: 2 * 60 * 1000,
  backupNoPromptMs: 90 * 60 * 1000,
  maxPerDay: 4,
  minGapMs: 20 * 60 * 1000,
  suppressAfterIgnored: 2
};

export class TriggerEngine {
  private config: TriggerConfig;
  private state: TriggerState;

  constructor(config: TriggerConfig = defaultTriggerConfig) {
    this.config = config;
    this.state = {
      lastPromptAt: null,
      ignoredStreak: 0,
      triggersToday: 0,
      lastPromptDayKey: null
    };
  }

  evaluate(context: TriggerContext): TriggerType | null {
    if (!this.canTrigger(context.now)) {
      return null;
    }

    if (this.isPrimary(context)) {
      return "primary";
    }

    if (this.isSecondary(context)) {
      return "secondary";
    }

    if (this.isBackup(context)) {
      return "backup";
    }

    return null;
  }

  recordPrompt(now: number, ignored: boolean): void {
    const dayKey = this.getDayKey(now);
    if (this.state.lastPromptDayKey !== dayKey) {
      this.state.triggersToday = 0;
      this.state.lastPromptDayKey = dayKey;
    }
    this.state.lastPromptAt = now;
    this.state.triggersToday += 1;
    this.state.ignoredStreak = ignored ? this.state.ignoredStreak + 1 : 0;
  }

  getState(): TriggerState {
    return { ...this.state };
  }

  private canTrigger(now: number): boolean {
    const dayKey = this.getDayKey(now);
    if (this.state.lastPromptDayKey !== dayKey) {
      this.state.triggersToday = 0;
      this.state.lastPromptDayKey = dayKey;
    }

    if (this.state.triggersToday >= this.config.maxPerDay) {
      return false;
    }

    if (this.state.ignoredStreak >= this.config.suppressAfterIgnored) {
      return false;
    }

    if (this.state.lastPromptAt !== null) {
      const sinceLast = now - this.state.lastPromptAt;
      if (sinceLast < this.config.minGapMs) {
        return false;
      }
    }

    return true;
  }

  private isPrimary(context: TriggerContext): boolean {
    const prev = context.previousSession;
    const current = context.currentSession;
    if (!prev || !current) {
      return false;
    }
    if (prev.domain === current.domain) {
      return false;
    }
    if (prev.durationMs < this.config.minSessionMs) {
      return false;
    }
    if (context.activeMsLastHour < this.config.minActiveMsLastHour) {
      return false;
    }
    return true;
  }

  private isSecondary(context: TriggerContext): boolean {
    return context.switchesLast2Min >= this.config.secondarySwitchCount;
  }

  private isBackup(context: TriggerContext): boolean {
    if (this.state.lastPromptAt === null) {
      return context.activeMsSinceStart >= this.config.backupNoPromptMs;
    }
    return context.now - this.state.lastPromptAt >= this.config.backupNoPromptMs;
  }

  private getDayKey(timestamp: number): string {
    const date = new Date(timestamp);
    return [date.getFullYear(), date.getMonth() + 1, date.getDate()].join("-");
  }
}
