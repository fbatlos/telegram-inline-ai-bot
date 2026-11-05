export interface UsageEntry {
  day: string;
  used: number;
}

/** Storage backend for usage counters. Implementations: JsonUsageStore (file) or none (memory). */
export interface UsageStore {
  read(): Record<string, UsageEntry>;
  write(data: Record<string, UsageEntry>): void;
}

/** Per-user daily request limit. Counters reset when the UTC date changes. */
export class DailyLimiter {
  private counts: Map<string, UsageEntry>;

  constructor(
    private readonly dailyLimit: number,
    private readonly now: () => Date = () => new Date(),
    private readonly store?: UsageStore,
  ) {
    if (!Number.isInteger(dailyLimit) || dailyLimit < 0) {
      throw new RangeError("dailyLimit must be a non-negative integer");
    }
    this.counts = new Map(Object.entries(store?.read() ?? {}));
  }

  /** Returns true and counts the request if the user is under the limit. */
  tryConsume(userId: number): boolean {
    const day = this.now().toISOString().slice(0, 10);
    const key = String(userId);
    const entry = this.counts.get(key);
    const used = entry && entry.day === day ? entry.used : 0;
    if (used >= this.dailyLimit) return false;
    this.counts.set(key, { day, used: used + 1 });
    this.persist(day);
    return true;
  }

  /** Writes only today's counters, so the file does not grow forever. */
  private persist(day: string): void {
    if (!this.store) return;
    const today: Record<string, UsageEntry> = {};
    for (const [key, entry] of this.counts) {
      if (entry.day === day) today[key] = entry;
    }
    this.counts = new Map(Object.entries(today));
    this.store.write(today);
  }
}
