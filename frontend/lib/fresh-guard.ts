// Client-side guard for live ("Force fresh research") runs. Each fresh run costs
// API credits and can fail validation, so a visitor gets ONE live run across ALL
// suppliers combined, tracked by a single flag in localStorage. This stops normal
// repeat use; it does NOT stop a determined user who clears their storage. That
// tradeoff is fine for a demo: the backend API secret covers casual direct abuse
// of the fresh endpoint.

const KEY = "srr_fresh_used_global";

// True once this browser has spent its single global live run.
export function hasUsedFresh(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

// Record that the single global live run has now been spent.
export function markFreshUsed(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    /* storage disabled or full — the guard is best-effort */
  }
}
