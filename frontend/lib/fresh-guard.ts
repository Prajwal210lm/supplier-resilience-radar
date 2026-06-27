// Client-side guard for live ("Force fresh research") runs. Each fresh run costs
// API credits and can fail validation, so we allow ONE fresh run per supplier per
// browser, tracked in localStorage. This stops normal repeat use; it does NOT stop
// a determined user who clears their storage. That tradeoff is fine for a demo —
// the backend API secret covers casual direct abuse of the fresh endpoint.

const KEY = "srr_fresh_used";

export function readFreshUsed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

// Record that `id` has now used its single fresh run, and return the updated set.
// Reads the latest value from storage first so concurrent updates don't clobber.
export function addFreshUsed(id: string): Set<string> {
  const set = readFreshUsed();
  set.add(id);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify([...set]));
    } catch {
      /* storage disabled or full — the guard is best-effort */
    }
  }
  return set;
}
