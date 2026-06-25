"""Pre-warm the response cache for every supplier so the deployed demo serves
any supplier instantly, without a live run.

Run locally with a key, then commit data/cache/*.json and redeploy:

    export ANTHROPIC_API_KEY=sk-ant-...
    python scripts/prewarm_cache.py                 # all 25 suppliers
    python scripts/prewarm_cache.py --only SUP-001 SUP-003
    python scripts/prewarm_cache.py --attempts 4    # more retries per supplier

The embedding store is built once and reused across every supplier, so this is
far cheaper than 25 separate fresh runs. Each supplier still makes live web
searches, so expect a few minutes total and some token cost.
"""
import os, sys, json, argparse
from profile_core.loader import load_suppliers
from pipeline.graph import run_assessment
from backend.api import state_to_response, CACHE_DIR


def warm(supplier_id, attempts):
    last = None
    for i in range(attempts):
        state = run_assessment(supplier_id)            # live fresh run
        resp = state_to_response(state, cached=False)
        last = resp
        if resp["brief"] is not None and not resp["violations"]:
            return resp, True
        print(f"  attempt {i + 1}: violations={resp['violations'][:2]} -> retrying")
    return last, False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*", help="subset of supplier ids")
    ap.add_argument("--attempts", type=int, default=3)
    args = ap.parse_args()

    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("Set ANTHROPIC_API_KEY before running.")

    os.makedirs(CACHE_DIR, exist_ok=True)
    ids = [s["supplier_id"] for s in load_suppliers()]
    if args.only:
        keep = set(args.only)
        ids = [i for i in ids if i in keep]

    clean, review = [], []
    for sid in ids:
        print(f"warming {sid} ...")
        resp, ok = warm(sid, args.attempts)
        path = os.path.join(CACHE_DIR, f"{sid}.json")
        with open(path, "w") as f:
            json.dump(resp, f, indent=2)
        (clean if ok else review).append(sid)
        print(f"  -> {'clean' if ok else 'WROTE WITH VIOLATIONS'}  {path}")

    print(f"\nDone. clean={len(clean)}  needs-review={len(review)}")
    if review:
        print("Review these (violations or no brief):", ", ".join(review))


if __name__ == "__main__":
    main()
