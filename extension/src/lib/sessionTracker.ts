import type { Session, SwitchEvent } from "./types";

interface SessionStart {
  tabId: number;
  domain: string;
  timestamp: number;
}

export class SessionTracker {
  private current: Session | null = null;
  private sessions: Session[] = [];
  private switches: SwitchEvent[] = [];
  private activeStart: number | null = null;

  startOrSwitchSession(input: SessionStart): Session | null {
    const ended = this.endCurrentSession(input.timestamp);
    this.current = {
      tabId: input.tabId,
      domain: input.domain,
      startTime: input.timestamp,
      endTime: input.timestamp,
      durationMs: 0
    };
    if (ended) {
      this.switches.push({
        timestamp: input.timestamp,
        fromDomain: ended.domain,
        toDomain: input.domain
      });
    }
    if (this.activeStart === null) {
      this.activeStart = input.timestamp;
    }
    return ended;
  }

  endCurrentSession(timestamp: number): Session | null {
    if (!this.current) {
      return null;
    }
    const ended: Session = {
      ...this.current,
      endTime: timestamp,
      durationMs: Math.max(0, timestamp - this.current.startTime)
    };
    this.sessions.push(ended);
    this.current = null;
    return ended;
  }

  setIdle(isIdle: boolean, timestamp: number): Session | null {
    if (isIdle) {
      return this.endCurrentSession(timestamp);
    }
    if (this.activeStart === null) {
      this.activeStart = timestamp;
    }
    return null;
  }

  getCurrentSession(): Session | null {
    return this.current;
  }

  getPreviousSession(): Session | null {
    if (this.sessions.length === 0) {
      return null;
    }
    return this.sessions[this.sessions.length - 1];
  }

  getActiveDurationMs(windowMs: number, now: number): number {
    const windowStart = now - windowMs;
    let total = 0;
    for (const session of this.sessions) {
      if (session.endTime <= windowStart) {
        continue;
      }
      const start = Math.max(session.startTime, windowStart);
      const end = Math.min(session.endTime, now);
      total += Math.max(0, end - start);
    }
    if (this.current) {
      const start = Math.max(this.current.startTime, windowStart);
      total += Math.max(0, now - start);
    }
    return total;
  }

  getActiveDurationSinceStart(now: number): number {
    if (this.activeStart === null) {
      return 0;
    }
    return Math.max(0, now - this.activeStart);
  }

  getSwitchCount(windowMs: number, now: number): number {
    const windowStart = now - windowMs;
    return this.switches.filter((event) => event.timestamp >= windowStart).length;
  }
}
