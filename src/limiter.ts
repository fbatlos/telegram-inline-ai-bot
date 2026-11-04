/** Per-user daily request limit. Counters reset when the UTC date changes. */
export class DailyLimiter {
  private readonly counts = new Map<number, { day: string; used: number }>();

  constructor(
    private readonly dailyLimit: number,
    private readonly now: () => Date = () => new Date(),
  ) {
    if (!Number.isInteger(dailyLimit) || dailyLimit < 0) {
      throw new RangeError("dailyLimit must be a non-negative integer");
    }
  }

  /** Returns true and counts the request if the user is under the limit. */
  tryConsume(userId: number): boolean {
    const day = this.now().toISOString().slice(0, 10);
    const entry = this.counts.get(userId);
    const used = entry && entry.day === day ? entry.used : 0;
    if (used >= this.dailyLimit) return false;
    this.counts.set(userId, { day, used: used + 1 });
    return true;
  }
}
