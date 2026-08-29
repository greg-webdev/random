export class RateLimiter {
  public readonly PERIOD: number;
  public readonly LIMIT: number;
  public readonly LOCKOUT_LIMIT: number;
  public readonly LOCKOUT_DURATION: number;

  private readonly LIMITERS = new Map<string, RateLimitEntry>();

  public constructor (period: number, limit: number, lockoutLimit: number, lockoutDuration: number) {
    this.PERIOD = period;
    this.LIMIT = limit;
    this.LOCKOUT_LIMIT = lockoutLimit;
    this.LOCKOUT_DURATION = lockoutDuration;
  }

  public limit (addr: string): RateLimit {
    let etr: RateLimitEntry | undefined = this.LIMITERS.get(addr);
    if (etr === undefined) this.LIMITERS.set(addr, etr = new RateLimitEntry());
    else etr.update(this);
    if (etr.LOCKED) {
      return RateLimit.LOCKOUT;
    } else {
      if (++etr.COUNT >= this.LOCKOUT_LIMIT) {
        etr.COUNT = 0;
        etr.LOCKED = true;
        etr.LOCKED_TIMER = Date.now();
        return RateLimit.LIMIT_NOW_LOCKOUT;
      } else {
        return etr.COUNT > this.LIMIT ? RateLimit.LIMIT : RateLimit.NONE;
      }
    }
  }

  public update (): void {
    for (const [address, etr] of this.LIMITERS) {
      etr.update(this);
      if (!etr.LOCKED && etr.COUNT === 0) this.LIMITERS.delete(address);
    }
  }

  public reset (): void {
    this.LIMITERS.clear();
  }
}

export enum RateLimit {
  NONE,
  LIMIT,
  LIMIT_NOW_LOCKOUT,
  LOCKOUT
}

class RateLimitEntry {
  public TIMER: number = Date.now();
  public COUNT: number = 0;
  public LOCKED_TIMER: number = 0;
  public LOCKED: boolean = false;

  public update (limiter: RateLimiter): void {
    const millis: number = Date.now();
    if (this.LOCKED) {
      if (millis - this.LOCKED_TIMER > limiter.LOCKOUT_DURATION) {
        this.LOCKED = false;
        this.LOCKED_TIMER = 0;
        this.COUNT = 0;
        this.TIMER = millis;
      }
    } else {
      const p: number = limiter.PERIOD / limiter.LIMIT;
      if (this.COUNT > 0 && p > 0) {
        const elapsed: number = millis - this.TIMER;
        const tokens: number = Math.floor(elapsed / p);
        if (tokens > 0) {
          this.COUNT = Math.max(0, this.COUNT - tokens);
          this.TIMER += tokens * p;
          if (this.TIMER > millis) this.TIMER = millis;
        }
      } else {
        this.TIMER = millis;
      }
    }
  }
}
