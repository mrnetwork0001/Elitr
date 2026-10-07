// Per-endpoint pacing for read-only Binance Web3 API calls made by the dashboard-facing modules
// (rwaBoard, walletApi). The gateway allows 5 requests/s per endpoint by default
// (binance-web3-llms-full.txt "Rate Limits"); we stay at <= 4/s per path by serialising calls
// to the same path with a minimum gap. Different paths run independently.

const MIN_GAP_MS = 260;
const chains = new Map<string, Promise<unknown>>();
const lastAt = new Map<string, number>();

export function throttled<T>(path: string, fn: () => Promise<T>, gapMs = MIN_GAP_MS): Promise<T> {
  const prev = chains.get(path) ?? Promise.resolve();
  const next = prev
    .catch(() => undefined)
    .then(async () => {
      const wait = (lastAt.get(path) ?? 0) + gapMs - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      lastAt.set(path, Date.now());
      return fn();
    });
  chains.set(path, next);
  return next;
}

/** A value cached for `ttlMs`, with at most one fetch in flight. Errors are not cached. */
export class Cached<T> {
  private value: { at: number; v: T } | null = null;
  private inflight: Promise<T> | null = null;

  constructor(
    private readonly ttlMs: number,
    private readonly load: () => Promise<T>,
  ) {}

  get fresh(): boolean {
    return !!this.value && Date.now() - this.value.at < this.ttlMs;
  }

  peek(): T | null {
    return this.value?.v ?? null;
  }

  async get(force = false): Promise<T> {
    if (!force && this.fresh) return this.value!.v;
    if (this.inflight) return this.inflight;
    this.inflight = this.load()
      .then((v) => {
        this.value = { at: Date.now(), v };
        return v;
      })
      .finally(() => {
        this.inflight = null;
      });
    return this.inflight;
  }
}

export const errText = (e: unknown): string => {
  const m = e instanceof Error ? e.message : String(e);
  const cause = e instanceof Error && e.cause instanceof Error ? ` (${e.cause.message})` : "";
  return `${m}${cause}`.slice(0, 300);
};
